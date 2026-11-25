export const access="public";
export const methods=["POST"];

const clean=(v,n=100000)=>String(v??"").replace(/\u0000/g,"").slice(0,n);
const safePath=path=>{
  const p=String(path||"").replace(/\\/g,"/").trim();
  return /^[a-zA-Z0-9._/-]{1,160}$/.test(p)&&!p.startsWith("/")&&!p.split("/").includes("..")&&!/(^|\/)(?:node_modules|\.git)(?:\/|$)|(^|\/)(?:\.env|.*secret.*|.*credential.*)$/i.test(p);
};
const isModule=source=>/^\s*(?:import\s|export\s)/m.test(source);

function validateJavaScript(source){
  if(isModule(source))return {ok:true,validated:false,detail:"ES module syntax detected; syntax compilation is deferred to the project bundler."};
  try{new Function(source);return {ok:true,validated:true,detail:"JavaScript parsed successfully (compile-only; not executed)."};}
  catch(error){return {ok:false,validated:true,detail:String(error?.message||error)};}
}
function balanced(source,open,close){
  let depth=0,quote="",escape=false,lineComment=false,blockComment=false;
  for(let i=0;i<source.length;i++){
    const c=source[i],n=source[i+1];
    if(lineComment){if(c==="\n")lineComment=false;continue;}
    if(blockComment){if(c==="*"&&n==="/"){blockComment=false;i++;}continue;}
    if(quote){if(escape){escape=false;continue;}if(c==="\\"){escape=true;continue;}if(c===quote)quote="";continue;}
    if(c==="/"&&n==="/"){lineComment=true;i++;continue;}
    if(c==="/"&&n==="*"){blockComment=true;i++;continue;}
    if(c==="'"||c==='"'||c==="\x60"){quote=c;continue;}
    if(c===open)depth++;
    if(c===close&&--depth<0)return false;
  }
  return depth===0&&!quote&&!blockComment;
}

export default async function(req,res){
  if(req.method!=="POST")return res.status(405).json({ok:false,error:"POST required"});
  const request=clean(req.body?.request,10000).trim();
  const input=Array.isArray(req.body?.files)?req.body.files:[];
  if(!request||!input.length||input.length>20)return res.status(400).json({ok:false,error:"A build request and 1–20 generated files are required."});
  const seen=new Set(),files=[];
  for(const item of input){
    const path=String(item?.path||"").replace(/\\/g,"/").trim();
    if(!safePath(path))return res.status(422).json({ok:false,error:"Unsafe or unsupported project path: "+path});
    if(seen.has(path))return res.status(422).json({ok:false,error:"Duplicate project file: "+path});
    seen.add(path);
    const content=clean(item?.content,600000);
    if(!content.trim())return res.status(422).json({ok:false,error:"Generated file is empty: "+path});
    files.push({path,content});
  }
  const totalBytes=files.reduce((n,f)=>n+new TextEncoder().encode(f.content).length,0);
  if(totalBytes>1800000)return res.status(413).json({ok:false,error:"Generated project exceeds the 1.8 MB assembly limit."});

  const all=files.map(f=>f.path+"\n"+f.content).join("\n");
  const webIntent=/\b(?:website|web site|web app|web application|html page|landing page|frontend|front-end|browser app)\b/i.test(request);
  const pythonIntent=/\bpython\b/i.test(request);
  const jsIntent=/\b(?:javascript|typescript|node\.js|node app)\b/i.test(request);
  const hasHtml=files.some(f=>/\.html?$/i.test(f.path));
  const hasPython=files.some(f=>/\.py$/i.test(f.path));
  const hasJs=files.some(f=>/\.(?:js|mjs|cjs|jsx|ts|tsx)$/i.test(f.path));
  if(webIntent&&!hasHtml)return res.status(422).json({ok:false,error:"This request is for a website/web app, but no HTML entry file was generated."});
  if(pythonIntent&&!hasPython)return res.status(422).json({ok:false,error:"This request requires Python source, but no .py file was generated."});
  if(jsIntent&&!hasJs)return res.status(422).json({ok:false,error:"This request requires JavaScript/TypeScript source, but no matching source file was generated."});
  if(!hasHtml&&!hasPython&&!hasJs&&!files.some(f=>/\.(?:java|kt|go|rs|rb|php|cs|cpp|c|swift|sql|sh|yaml|yml|json|md)$/i.test(f.path))){
    return res.status(422).json({ok:false,error:"No recognizable source, configuration, or project file was generated."});
  }

  const checks=[],warnings=[];
  checks.push({name:"Project files supplied",ok:files.length>0,detail:files.length+" file(s) received."});
  checks.push({name:"Safe project paths",ok:true,detail:"All paths passed traversal and restricted-file checks."});
  checks.push({name:"No obvious placeholder",ok:!/(TODO|LOREM IPSUM|REPLACE ME|COMING SOON)/i.test(all),detail:"Placeholder scan across generated files."});
  if(webIntent||hasHtml){
    const htmlFile=files.find(f=>/\.html?$/i.test(f.path));
    const html=htmlFile?.content||"";
    checks.push({name:"HTML document structure",ok:/<html\b/i.test(html)&&/<\/html\s*>/i.test(html)&&/<body\b/i.test(html),detail:"Basic document structure check."});
    if(/<meta\b[^>]*name=["']viewport["']/i.test(html)===false)warnings.push("No responsive viewport meta tag was found.");
    for(const ref of [...html.matchAll(/(?:src|href)=["']([^"'#]+)["']/gi)].map(m=>m[1])){
      if(/^(?:https?:|data:|#|\/\/)/i.test(ref))continue;
      const target=ref.split(/[?#]/)[0].replace(/^\.\//,"");
      if(target&&!files.some(f=>f.path===target)&&!files.some(f=>f.path.endsWith("/"+target)))warnings.push("Local asset reference not included in generated files: "+ref);
    }
  }
  for(const file of files){
    const ext=(file.path.split(".").pop()||"").toLowerCase();
    if(["js","cjs","mjs"].includes(ext)){
      const result=validateJavaScript(file.content);
      checks.push({name:"JavaScript syntax · "+file.path,ok:result.ok,detail:result.detail});
      if(!result.validated)warnings.push(file.path+": "+result.detail);
    }else if(["jsx","ts","tsx"].includes(ext)){
      warnings.push(file.path+": JSX/TypeScript requires a project transpiler; this endpoint does not claim to compile it.");
    }else if(ext==="css"){
      const ok=balanced(file.content,"{","}");
      checks.push({name:"CSS block structure · "+file.path,ok,detail:ok?"CSS braces are balanced.":"Unbalanced CSS braces detected."});
    }else if(ext==="json"){
      let ok=true,detail="JSON parsed successfully.";
      try{JSON.parse(file.content)}catch(error){ok=false;detail=String(error?.message||error)}
      checks.push({name:"JSON syntax · "+file.path,ok,detail});
    }else if(ext==="py"){
      const ok=/(?:^|\n)\s*(?:import\s|from\s|def\s|class\s|if\s+__name__)/m.test(file.content);
      checks.push({name:"Python source structure · "+file.path,ok,detail:ok?"Recognizable Python module/program structure found.":"No Python import, function, class or main-entry structure was found."});
      warnings.push(file.path+": Python syntax was structurally inspected but not executed by this endpoint.");
    }else if(ext==="java"){
      const declared=file.content.match(/\bpublic\s+(?:(?:final|abstract|sealed)\s+)?(?:class|interface|enum|record)\s+([A-Za-z_$][\w$]*)/);
      const typePresent=/\b(?:class|interface|enum|record)\s+[A-Za-z_$][\w$]*/.test(file.content);
      const expected=file.path.split("/").pop().replace(/\.java$/i,"");
      const nameMatches=!declared||declared[1]===expected;
      const ok=typePresent&&nameMatches;
      checks.push({name:"Java source structure · "+file.path,ok,detail:!typePresent?"No Java class, interface, enum or record declaration was found.":nameMatches?"Java type declaration matches the source filename.":"Public Java type "+declared[1]+" must be saved as "+declared[1]+".java."});
      warnings.push(file.path+": Java compiler execution is not available in this endpoint.");
    }else if(["kt","go","rs","rb","php","cs","cpp","c","swift","sql","sh"].includes(ext)){
      warnings.push(file.path+": static structure accepted; execution/compiler validation is not available in this endpoint.");
    }
  }
  const passed=checks.filter(x=>x.ok).length,total=checks.length,failed=checks.filter(x=>!x.ok);
  if(failed.length)return res.status(422).json({ok:false,error:"Generated code failed validation: "+failed.map(x=>x.name+" — "+x.detail).join("; "),files,manifest:files.map(f=>({path:f.path,bytes:new TextEncoder().encode(f.content).length})),totalBytes,validation:{checks,passed,total,passRate:passed/total,warnings,failed}});
  return res.json({ok:true,files,manifest:files.map(f=>({path:f.path,bytes:new TextEncoder().encode(f.content).length})),totalBytes,validation:{checks,passed,total,passRate:passed/total,warnings,executionTested:false,note:"Static validation only. Run the generated project in its preview/runtime before declaring it fully tested."},engine:"HAxBRO CodeWriter quality validator v2",generatedBy:"HAxBRO Code Writer pipeline"});
}