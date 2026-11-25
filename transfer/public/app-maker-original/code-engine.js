(function(){
function clean(v,n){return String(v==null?"":v).replace(/\u0000/g,"").slice(0,n||12000).trim()}
function emit(h,s,d){try{if(h&&h.onStage)h.onStage(s,d)}catch(e){}}
function fallbackSpec(request){
    const q=clean(request,1800),lower=q.toLowerCase();
    const palette={yellow:"#FDE047",gold:"#FACC15",red:"#DC2626",blue:"#2563EB",cyan:"#0891B2",green:"#16A34A",purple:"#7C3AED",pink:"#DB2777",orange:"#EA580C",black:"#111827",white:"#FFFFFF",navy:"#172554"};
    function color(match,fallback){return match&&palette[String(match[1]).toLowerCase()]||fallback}
    const bgMatch=q.match(/\b(yellow|gold|red|blue|cyan|green|purple|pink|orange|black|white|navy)\s+(?:page\s+)?(?:background|backdrop|canvas|bg)\b/i);
    const headMatch=q.match(/\b(yellow|gold|red|blue|cyan|green|purple|pink|orange|black|white|navy)\s+(?:page\s+)?(?:header|hero|banner|top bar)\b/i);
    const colors=(lower.match(/\b(yellow|gold|red|blue|cyan|green|purple|pink|orange|black|white|navy)\b/g)||[]);
    const background=color(bgMatch,colors.length?palette[colors[0]]:"#F8FAFC");
    const header=color(headMatch,colors.length>1?palette[colors[1]]:"#2563EB");
    const countMatch=q.match(/\b(\d{1,2}|one|two|three|four|five|six|seven|eight)\s+(?:project\s+)?cards?\b/i);
    const numberWords={one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8};
    const count=Math.max(1,Math.min(8,Number(countMatch?.[1])||numberWords[String(countMatch?.[1]||"").toLowerCase()]||3));
    const portfolio=/\bportfolio\b/i.test(lower);
    const contact=/\bcontact\b/i.test(lower);
    const cards=Array.from({length:count},(_,i)=>({title:portfolio?"Project "+(i+1):"Feature "+(i+1),description:portfolio?"A selected project.":"A useful feature of this product."}));
    const sections=[{type:"hero",title:portfolio?"My Portfolio":(q.match(/\b(?:called|named)\s+([A-Z][\w -]{1,35})/i)?.[1]||"Welcome"),description:portfolio?"Selected work, projects and ways to get in touch.":q.slice(0,180),actions:[{label:contact?"Contact me":"Get started",action:"notice"}]}];
    if(countMatch||portfolio)sections.push({type:"cards",title:portfolio?"Selected Projects":"Highlights",items:cards});
    sections.push({type:"footer",title:portfolio?"Let's work together":"Get in touch",description:contact?"Have a project in mind? Get in touch.":"Built with HAxBRO CodeWriter."});
    return {name:portfolio?"Portfolio":"New website",purpose:q,productType:"website",features:[...(portfolio?["Portfolio landing page"]:["Responsive landing page"]),...(contact?["Contact call to action"]:[])],design:{background:background,header:header,primary:header,surface:"#FFFFFF",text:"#111827"},pages:[{title:"Home",sections}]};
  }
  function enforceExplicitRequirements(spec,request){
    const q=clean(request,1800),lower=q.toLowerCase();
    const palette={yellow:"#FDE047",gold:"#FACC15",red:"#DC2626",blue:"#2563EB",cyan:"#0891B2",green:"#16A34A",purple:"#7C3AED",pink:"#DB2777",orange:"#EA580C",black:"#111827",white:"#FFFFFF",navy:"#172554"};
    const bgMatch=q.match(/\b(yellow|gold|red|blue|cyan|green|purple|pink|orange|black|white|navy)\s+(?:page\s+)?(?:background|backdrop|canvas|bg)\b/i);
    const headerMatch=q.match(/\b(yellow|gold|red|blue|cyan|green|purple|pink|orange|black|white|navy)\s+(?:page\s+)?(?:header|hero|banner|top bar)\b/i);
    spec.design=spec.design&&typeof spec.design==="object"?spec.design:{};
    if(bgMatch)spec.design.background=palette[bgMatch[1].toLowerCase()];
    if(headerMatch){spec.design.header=palette[headerMatch[1].toLowerCase()];spec.design.primary=palette[headerMatch[1].toLowerCase()];}
    if(!Array.isArray(spec.pages)||!spec.pages.length)spec.pages=[{title:"Home",sections:[]}];
    const page=spec.pages[0];page.sections=Array.isArray(page.sections)?page.sections:[];
    const countMatch=q.match(/\b(\d{1,2}|one|two|three|four|five|six|seven|eight)\s+(?:project\s+)?cards?\b/i);
    const words={one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8};
    if(countMatch){
      const count=Math.max(1,Math.min(8,Number(countMatch[1])||words[String(countMatch[1]).toLowerCase()]||3));
      let cardSection=page.sections.find(s=>String(s?.type||"").toLowerCase()==="cards"||/project|card/i.test(String(s?.title||"")));
      if(!cardSection){cardSection={type:"cards",title:/\bportfolio\b/i.test(lower)?"Selected Projects":"Projects",items:[]};page.sections.push(cardSection);}
      const existing=Array.isArray(cardSection.items)?cardSection.items:[];
      cardSection.type="cards";
      cardSection.items=Array.from({length:count},(_,i)=>existing[i]||{title:/\bportfolio\b/i.test(lower)?"Project "+(i+1):"Card "+(i+1),description:"A project highlight."});
    }
    if(/\bcontact\b/i.test(lower)){
      let hero=page.sections.find(s=>String(s?.type||"").toLowerCase()==="hero");
      if(!hero){hero={type:"hero",title:spec.name||"Welcome",description:spec.purpose||q};page.sections.unshift(hero);}
      const actions=Array.isArray(hero.actions)?hero.actions:[];
      if(!actions.some(a=>/contact/i.test(String(a?.label||""))))actions.push({label:"Contact me",action:"notice"});
      hero.actions=actions;
    }
    return spec;
  }
  function parse(raw){
 var s=clean(raw).replace(/^\s*json\s*/i,"");
 var a=s.indexOf("{"),b=s.lastIndexOf("}");if(a<0||b<=a)throw Error("Qwen returned no JSON specification.");
 var x;try{x=JSON.parse(s.slice(a,b+1))}catch(e){throw Error("Qwen's specification is not valid JSON.")}
 if(!x.pages||!Array.isArray(x.pages)||!x.pages.length)throw Error("Qwen's specification has no pages.");
 x.pages=x.pages.slice(0,6).map(function(p){p=p||{};var sections=Array.isArray(p.sections)?p.sections:(Array.isArray(p.components)?p.components:[]);if(!sections.length){sections=[{type:"hero",title:p.title||x.name||"Your application",description:p.description||x.purpose||"A custom application generated from your request."}];if(Array.isArray(x.features)&&x.features.length)sections.push({type:"cards",title:"Features",items:x.features.slice(0,6).map(function(v){return typeof v==="string"?{title:v,description:""}:v})})}return {title:p.title||x.name||"Home",sections:sections.slice(0,24)}});return x
}
async function qwenEngine(h){
 var owner=window.HAxBROKai51Bootstrap;try{if(!owner)owner=window.parent.HAxBROKai51Bootstrap}catch(e){}
 if(!owner||!owner.prepare)throw Error("The shared KAI model session is unavailable. Open App Maker from the HAxBRO main workspace after KAI has loaded.");
 emit(h,"model","Reusing the already-loaded shared Qwen3 model. No second model download will start.");
 var engine=await owner.prepare({onStage:function(s,d){emit(h,s,d)}});
 if(engine&&engine.generate)return engine;
 try{if(window.HAxBROKai51Engine&&window.HAxBROKai51Engine.generate)return window.HAxBROKai51Engine}catch(e){}
 try{if(window.parent&&window.parent.HAxBROKai51Engine&&window.parent.HAxBROKai51Engine.generate)return window.parent.HAxBROKai51Engine}catch(e){}
 throw Error("The shared Qwen model is not ready for CodeWriter. Reload the main HAxBRO workspace and try again.");
}
function compileSpec(spec,hooks){
 emit(hooks,"codewriter","Independent CodeWriter is compiling the Qwen specification into project files.");
 var writer=window.HAxBROCodeWriterEngine;if(!writer||!writer.compile)throw Error("Independent CodeWriter engine is not loaded.");
 var started=Date.now(),data=writer.compile(spec),html="",css="",js="";if(!Array.isArray(data.files))throw Error("CodeWriter returned no files array.");
 data.files.forEach(function(f){if(f.path==="index.html")html=f.content;if(f.path==="style.css")css=f.content;if(f.path==="app.js")js=f.content});
 var checks=[["HTML",/^<!doctype html>/i.test(html)],["Viewport",/name="viewport"/i.test(html)],["Separate CSS",/style\.css/i.test(html)&&css.length>400],["Separate JS",/app\.js/i.test(html)&&js.length>80],["Sections",/<section\b/i.test(html)],["Nonblank",html.replace(/<[^>]+>/g," ").trim().length>30]];
 var passed=checks.filter(function(x){return x[1]}).length;if(passed!==checks.length){emit(hooks,"codewriter-error","CodeWriter produced files but structural validation failed: "+passed+"/"+checks.length+".");throw Error("CodeWriter output failed structural checks ("+passed+"/"+checks.length+"): "+checks.filter(function(x){return !x[1]}).map(function(x){return x[0]}).join(", ")+".")}
 data.validation={passed:passed,total:checks.length,checks:checks.map(function(x){return {name:x[0],ok:x[1]}}),compileMs:Date.now()-started};
 data.agent={name:"HAxBRO CodeWriter",provider:"Independent local code-generation engine",model:"CodeWriter 1.2",local:true,externalModel:false,qwenRole:"natural-language specification only"};
 data.steps=["Qwen interpreted the human request into a technical specification","Qwen did not generate source code","Independent CodeWriter generated HTML, CSS and JavaScript","Generated files passed structural validation"];
 emit(hooks,"codewriter-done","CodeWriter generated "+data.files.length+" files (HTML, CSS and JavaScript) and passed "+passed+"/"+checks.length+" structural checks.");return data
}
function codeLanguage(request) {
 const q=String(request||"").toLowerCase();
 if (/\bpython\b/.test(q)) return {name:"python",ext:"py"};
 if (/\bjavascript\b|\bnode(?:\.js)?\b/.test(q)) return {name:"javascript",ext:"js"};
 if (/\btypescript\b/.test(q)) return {name:"typescript",ext:"ts"};
 if (/\bhtml\b/.test(q)) return {name:"html",ext:"html"};
 if (/\bcss\b/.test(q)) return {name:"css",ext:"css"};
 if (/\bjava\b/.test(q)) return {name:"java",ext:"java"};
 if (/\bsql\b/.test(q)) return {name:"sql",ext:"sql"};
 if (/\brust\b/.test(q)) return {name:"rust",ext:"rs"};
 if (/\bgolang\b|\blanguage go\b/.test(q)) return {name:"go",ext:"go"};
 if (/\bphp\b/.test(q)) return {name:"php",ext:"php"};
 if (/\bruby\b/.test(q)) return {name:"ruby",ext:"rb"};
 if (/\bbash\b|\bshell script\b/.test(q)) return {name:"bash",ext:"sh"};
 if (/\b(?:code|script|program|function|class|algorithm|cli|command[- ]line)\b/.test(q)) return {name:"python",ext:"py"};
 return null;
}
function isCodeRequest(request){var q=String(request||"").toLowerCase();var productIntent=/\b(?:app|application|website|web app|platform|system|portal|dashboard|store|marketplace|workspace)\b/i.test(q);var explicitSource=/\b(?:write|generate|create|make|implement)\b.{0,70}\b(?:source code|code|script|program|function|class|algorithm|cli|command[- ]line tool)\b/i.test(q)||/\b(?:python|javascript|typescript|java|sql|rust|golang|php|ruby|bash)\s+(?:source|code|script|program|file)\b/i.test(q);return !productIntent&&explicitSource&&!!codeLanguage(q);}
async function buildSingleCodeArtifact(request,engine,hooks,options,forcedLanguage) {
 const lang=forcedLanguage||codeLanguage(request);
 if(!lang) throw Error("Specify the programming language so CodeWriter can create the correct source file.");
 emit(hooks,"codewriter","Generating native "+lang.name+" source code with the shared local KAI model.");
 const prompt="You are HAxBRO CodeWriter, a senior software engineer. Produce a comprehensive, production-minded, complete and runnable "+lang.name+" implementation for the exact request below. Do not artificially shorten the program. Implement every requested subsystem, module, edge case, input validation path, error path and test. Use clear modular structure, sensible naming, documentation where useful, and standard libraries unless a dependency is necessary. Output source code only: no Markdown fences, explanation or JSON. Never use TODOs, pseudocode, stubs or placeholders.\nREQUEST:\n"+request+(lang.name==="java"?" The required source filename is Main.java; use a public class named Main.":"")+(lang.name==="python"?" The source filename is main.py; include a clear main entry point when appropriate.":"")+"\nWrite the complete implementation now.";
 let progress=0;
 const maxTokens=Math.min(2048,Math.max(1024,Math.ceil(request.length*1.5)));
 const fence=String.fromCharCode(96).repeat(3);
 const stripFence=value=>{let out=String(value||"").trim();if(out.startsWith(fence)){out=out.slice(fence.length).replace(/^[a-z0-9_-]*\s*/i,"");const end=out.lastIndexOf(fence);if(end>=0)out=out.slice(0,end);}return out.trim();};
 let generated=await engine.generate(prompt,[],{maxTokens,timeoutMs:600000,signal:options.signal,temperature:0.1,topP:0.78,onToken:function(delta,accumulated,count){if(count>=progress+24){progress=count;emit(hooks,"codewriter","Writing native "+lang.name+" source · approximately "+count+" tokens generated.");}}});
 let source=stripFence(generated?.response||generated?.text||generated||"");
 // Continue in bounded segments when the local model reaches its token ceiling.
 // Only the tail is carried forward, so large source files do not need a huge context prompt.
 for(let segment=0;segment<3&&Number(generated?.tokens||0)>=Number(generated?.tokenBudget||maxTokens)*0.78;segment++){
   emit(hooks,"codewriter","Extending the "+lang.name+" program · segment "+(segment+2)+" of 4.");
   const tail=source.slice(-1400);
   const continuationPrompt="Continue the exact "+lang.name+" source file for the original request below. The source has reached the end of the supplied excerpt; continue from that point without repeating any existing lines. Preserve all names, APIs, data structures and behavior. Complete any unfinished blocks and include the remaining requested features and tests. Output only source code, with no Markdown fences or explanation.\n\nORIGINAL REQUEST:\n"+request+"\n\nCURRENT SOURCE ENDING (context only; do not repeat it):\n"+tail+"\n\nContinue with the next new source lines now.";
   const continuation=await engine.generate(continuationPrompt,[],{maxTokens,timeoutMs:240000,signal:options.signal,temperature:0.08,topP:0.72,onToken:function(delta,accumulated,count){if(count%32===0)emit(hooks,"codewriter","Continuing "+lang.name+" source · segment "+(segment+2)+" · approximately "+count+" tokens.");}});
   const nextPart=stripFence(continuation?.response||continuation?.text||continuation||"");
   if(nextPart.length<80)break;
   let overlap=0;const maxOverlap=Math.min(1600,source.length,nextPart.length);
   for(let n=maxOverlap;n>=80;n--){if(source.slice(-n)===nextPart.slice(0,n)){overlap=n;break;}}
   source+= (overlap?"":"\n")+nextPart.slice(overlap);
   generated=continuation;
 }
 if(source.length<120)throw Error("CodeWriter returned incomplete "+lang.name+" source. The incomplete output was not marked ready.");
 if(/(?:TODO|YOUR_CODE_HERE|IMPLEMENT_ME)/i.test(source))throw Error("CodeWriter output contains an unfinished placeholder. No incomplete project was marked ready.");
 if(lang.name==="python"&&!/(?:^|\n)\s*(?:import |from |def |class |if __name__)/m.test(source))throw Error("The Python output did not contain a recognizable program structure.");
 if(lang.name==="python"&&/\bunittest\b/i.test(request)){const tests=(source.match(/^\s*def\s+test_/gm)||[]).length;if(!/import\s+unittest/.test(source)||!/unittest\.TestCase/.test(source)||tests<3)throw Error("The Python source did not include the requested unittest.TestCase suite with at least three test methods.");}
 const requestedFilename=(request.match(/\b([a-z0-9_-]+\.(?:py|js|ts|java|sql|rs|go|php|rb|sh|html|css))\b/i)||[])[1];
 const defaultNames={python:"main.py",java:"Main.java",javascript:"index.js",typescript:"index.ts",html:"source.html",css:"style.css",sql:"schema.sql",rust:"main.rs",go:"main.go",php:"index.php",ruby:"main.rb",bash:"main.sh"};
 const filename=requestedFilename||defaultNames[lang.name]||"haxbro_code."+lang.ext;
 const spec={name:"Code output",purpose:"Native "+lang.name+" source generated from the user's request.",productType:lang.name+" source code",features:["Native "+lang.name+" source file","Downloadable source artifact"],design:{background:"#F4F7FB",surface:"#FFFFFF",primary:"#2563EB",text:"#152238"},pages:[{title:"Code output",sections:[{type:"hero",title:"Native "+lang.name+" source generated",description:"The source file "+filename+" is included in the build artifacts. Review and test it before production use."}]}]};
 const data=compileSpec(spec,hooks);
 data.files.push({path:filename,content:source});
 emit(hooks,"backend-validation","Validating the generated source file and preview bundle.");
 const validationRequest=forcedLanguage?"Write a "+lang.name+" source program":request;
 let response=await fetch("/api/code-writer",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({request:validationRequest,files:data.files})});
 let backend=await response.json().catch(function(){return {}});
 let repaired=false;
 if(!response.ok||!backend.ok||!Array.isArray(backend.files)){
   const validationError=String(backend.error||"Generated source failed static validation.");
   emit(hooks,"codewriter-repair","CodeWriter found a validation error. Asking local Qwen for one targeted repair: "+validationError.slice(0,180));
   const repairPrompt="You are repairing a program that failed a real static validator. Return the COMPLETE corrected "+lang.name+" source only, with no Markdown fences or explanation. Preserve the original requested behavior; fix every reported error; do not remove features; do not add TODOs or placeholders.\nORIGINAL USER REQUEST:\n"+request+"\nVALIDATOR ERROR:\n"+validationError+"\nPREVIOUS SOURCE:\n"+source+"\nReturn the full corrected source now.";
   const repair=await engine.generate(repairPrompt,[],{maxTokens,timeoutMs:240000,signal:options.signal,temperature:0.05,topP:0.72,onToken:function(delta,accumulated,count){if(count%32===0)emit(hooks,"codewriter-repair","Applying the validation repair · "+count+" tokens.");}});
   let repairedSource=String(repair?.response||repair?.text||repair||"").trim();
   const fence=String.fromCharCode(96).repeat(3);
   if(repairedSource.startsWith(fence)){repairedSource=repairedSource.slice(fence.length).replace(/^[a-z0-9_-]*\s*/i,"");const end=repairedSource.lastIndexOf(fence);if(end>=0)repairedSource=repairedSource.slice(0,end);}
   repairedSource=repairedSource.trim();
   if(repairedSource.length<120||/(?:TODO|YOUR_CODE_HERE|IMPLEMENT_ME)/i.test(repairedSource))throw Error("CodeWriter repair returned incomplete or placeholder source. Original project output was not marked ready.");
   source=repairedSource;
   const sourceIndex=data.files.findIndex(file=>file.path===filename);
   if(sourceIndex<0)throw Error("CodeWriter could not locate the source file for repair.");
   data.files[sourceIndex]={path:filename,content:source};
   response=await fetch("/api/code-writer",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({request:validationRequest,files:data.files})});
   backend=await response.json().catch(function(){return {}});
   if(!response.ok||!backend.ok||!Array.isArray(backend.files))throw Error("CodeWriter repair did not pass validation: "+String(backend.error||"validation failed"));
   repaired=true;
 }
 data.files=backend.files;data.validation=backend.validation;data.backendValidation={engine:backend.engine,generatedBy:backend.generatedBy,manifest:backend.manifest,totalBytes:backend.totalBytes};
 data.name="Code output";data.summary="Native "+lang.name+" source generated locally by KAI 51. Download "+filename+" from the build artifacts.";
 data.codeLanguage=lang.name;data.sourceFile=filename;data.codeFiles=[{path:filename,content:source}];data.sourceBytes=new TextEncoder().encode(source).length;
 data.agent={name:"HAxBRO CodeWriter",provider:"Shared on-device KAI model",model:"Qwen3-0.6B · local",local:true,externalModel:false};
 data.steps=["Detected requested programming language: "+lang.name,"Generated native source code with the shared local Qwen model",repaired?"Applied one targeted repair using the backend validation error":"Initial source passed backend validation","Validated the source file and preview bundle"];
 emit(hooks,"codewriter-done","Generated "+filename+" · "+source.length+" characters · backend checks passed "+backend.validation.passed+"/"+backend.validation.total+".");
 return data;
}
async function buildCodeArtifact(request,engine,hooks,options){
 const definitions=[
  {name:"python",ext:"py",test:/\bpython\b/i},
  {name:"java",ext:"java",test:/\bjava\b/i},
  {name:"typescript",ext:"ts",test:/\btypescript\b/i},
  {name:"javascript",ext:"js",test:/\bjavascript\b|\bnode(?:\.js)?\b/i},
  {name:"html",ext:"html",test:/\bhtml\b/i},
  {name:"css",ext:"css",test:/\bcss\b/i},
  {name:"sql",ext:"sql",test:/\bsql\b/i},
  {name:"rust",ext:"rs",test:/\brust\b/i},
  {name:"go",ext:"go",test:/\bgolang\b|\blanguage go\b/i},
  {name:"php",ext:"php",test:/\bphp\b/i},
  {name:"ruby",ext:"rb",test:/\bruby\b/i},
  {name:"bash",ext:"sh",test:/\bbash\b|\bshell script\b/i}
 ];
 const selected=definitions.filter(item=>item.test.test(request));
 const languages=selected.length>1?selected:[codeLanguage(request)].filter(Boolean);
 if(!languages.length)throw Error("Specify the programming language so CodeWriter can create the correct source file.");
 if(languages.length===1)return buildSingleCodeArtifact(request,engine,hooks,options,languages[0]);
 emit(hooks,"codewriter","Multiple requested languages detected: "+languages.map(x=>x.name).join(", ")+". Generating a separate native source file for each.");
 const artifacts=[];
 for(const language of languages){
  emit(hooks,"codewriter","Generating the "+language.name+" implementation.");
  artifacts.push(await buildSingleCodeArtifact(request,engine,hooks,options,language));
 }
 const first=artifacts[0];
 const previewFiles=first.files.filter(file=>["index.html","style.css","app.js"].includes(file.path));
 const codeFiles=artifacts.map(artifact=>artifact.files.find(file=>file.path===artifact.sourceFile)).filter(Boolean);
 const combinedFiles=[...previewFiles,...codeFiles];
 emit(hooks,"backend-validation","Validating the complete multi-language project and all source files together.");
 const response=await fetch("/api/code-writer",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({request:"Multi-language CodeWriter project",files:combinedFiles})});
 const backend=await response.json().catch(()=>({}));
 if(!response.ok||!backend.ok||!Array.isArray(backend.files))throw Error(backend.error||"The combined Java/Python source project failed backend validation.");
 first.files=backend.files;
 first.codeFiles=codeFiles;
 first.codeLanguages=languages.map(x=>x.name);
 first.codeLanguage=languages.map(x=>x.name).join(" + ");
 first.sourceFile=codeFiles[0]?.path||"";
 first.sourceBytes=codeFiles.reduce((sum,file)=>sum+new TextEncoder().encode(file.content).length,0);
 first.name="Multi-language code project";
 first.summary="Generated separate native source files for "+languages.map(x=>x.name).join(" and ")+".";
 first.validation=backend.validation;
 first.backendValidation={engine:backend.engine,generatedBy:backend.generatedBy,manifest:backend.manifest,totalBytes:backend.totalBytes};
 first.steps=["Detected "+languages.length+" requested programming languages","Generated each language as a separate source file using local Qwen3","Validated the combined source project with the HAxBRO CodeWriter backend"];
 emit(hooks,"codewriter-done","Generated "+codeFiles.map(file=>file.path).join(" and ")+" · combined backend checks passed "+backend.validation.passed+"/"+backend.validation.total+".");
 return first;
}
async function buildNativeFastPath(request,options,hooks){
 try{
  emit(hooks,"native-builder",options.existing?"Checking the native modification path while preserving the existing project.":"Checking the fast local product compiler for a supported working app.");
  const response=await fetch("/api/app-continue",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt:request,product:options.existing||null})});
  const data=await response.json().catch(function(){return {}});
  const kind=String(data.understanding?.productType||"");
  const supported=["calculator","productivity","notes","timer","dashboard","web analyzer","ai workspace"].includes(kind);
  const files=Array.isArray(data.nativePreview?.files)?data.nativePreview.files:[];
  if(!response.ok||!data.ready||!supported||!files.length)return null;
  emit(hooks,"native-builder","KAI selected the "+kind+" product path and generated a working native application.");
  const checked=await fetch("/api/code-writer",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({request:request,files:files})});
  const validation=await checked.json().catch(function(){return {}});
  if(!checked.ok||!validation.ok||!Array.isArray(validation.files)){
    emit(hooks,"native-builder-fallback","The native product did not pass backend validation; continuing to the Qwen specification route.");
    return null;
  }
  emit(hooks,"backend-validation-done","The native app passed "+validation.validation.passed+"/"+validation.validation.total+" backend checks.");
  return {
   name:String(data.nativePreview.name||"HAxBRO App"),
   summary:String(data.nativePreview.summary||data.reply||"Working app generated by KAI."),
   files:validation.files,
   plan:{intent:request,productType:kind,architecture:"KAI Native Product Compiler → CodeWriter backend validation",features:[],screens:["Main workspace"]},
   validation:validation.validation,
   backendValidation:{engine:validation.engine,generatedBy:validation.generatedBy,manifest:validation.manifest,totalBytes:validation.totalBytes},
   agent:{name:"HAxBRO App Maker",provider:"KAI Native Product Compiler",model:"Local native compiler",local:true,externalModel:false},
   steps:["KAI classified the requested product","Native Product Compiler generated working HTML, CSS and JavaScript","CodeWriter backend validated the generated application"],
   nativeFastPath:true
  };
 }catch(error){
  emit(hooks,"native-builder-fallback","The fast local product path was unavailable; continuing to the Qwen specification route.");
  return null;
 }
}
function needsBackend(request){return new RegExp("\\b(backend|back[- ]end|full[- ]stack|server[- ]side|database|postgres(?:ql)?|mysql|sqlite|mongodb|authentication|auth system|login system|user accounts|api server|rest api|graphql|payment gateway|payments integration|cloud sync|server routes|api endpoints)\\b","i").test(String(request||""));}
async function generateBackendFiles(request,spec,engine,hooks){
 emit(hooks,"codewriter","Integrated CodeWriter is generating backend source files for App Maker.");
 const prompt="You are HAxBRO App Maker's backend CodeWriter. Generate real, runnable backend SOURCE FILES for the exact app request. This is code generation, not deployment. Do not claim any service is already running or connected. Return ONLY valid JSON with this shape: {\"files\":[{\"path\":\"server/index.js\",\"content\":\"complete source\"},{\"path\":\"db/schema.sql\",\"content\":\"complete SQL\"},{\"path\":\"package.json\",\"content\":\"valid JSON\"},{\"path\":\".env.example\",\"content\":\"safe variable names only\"},{\"path\":\"BACKEND_IMPLEMENTATION.md\",\"content\":\"run and configuration guide\"}]}. Include only necessary files. Use secure defaults, input validation, parameterized SQL, and error handling. Authentication requires password hashing and secure session/token handling with environment-based secrets. Payment requests need a real provider integration boundary and must never fake successful charges. Database requests need schema and indexes. No hard-coded secrets, TODOs, pseudocode, fake endpoints or placeholder business logic. The guide must explain install/run steps, environment variables, and infrastructure still required.\nUSER REQUEST:\n"+request+"\nAPP SPECIFICATION:\n"+JSON.stringify({name:spec?.name,purpose:spec?.purpose,productType:spec?.productType,features:spec?.features}).slice(0,3500)+"\nGenerate complete files now.";
 const result=await engine.generate(prompt,[],{maxTokens:2048,timeoutMs:0,temperature:0.08,topP:0.7,onToken:(delta,accumulated,count)=>{if(count%32===0)emit(hooks,"codewriter","Backend source generation: approximately "+count+" tokens.");}});
 const raw=String(result?.response||result?.text||result||"").trim(),start=raw.indexOf("{"),end=raw.lastIndexOf("}");
 if(start<0||end<=start)throw Error("Backend CodeWriter did not return a valid file bundle. The build was not marked complete.");
 let parsed;try{parsed=JSON.parse(raw.slice(start,end+1))}catch{throw Error("Backend CodeWriter returned malformed JSON. The build was not marked complete.");}
 const files=Array.isArray(parsed.files)?parsed.files:[];
 const valid=files.filter(f=>f&&typeof f.path==="string"&&typeof f.content==="string"&&f.content.trim()&&/^[a-zA-Z0-9._/-]{1,160}$/.test(f.path)&&!f.path.startsWith("/")&&!f.path.split("/").includes(".."));
 const hasServer=valid.some(f=>new RegExp("^server/.+\\.(js|mjs|py)$","i").test(f.path));
 if(!hasServer)throw Error("Backend CodeWriter did not produce a server entry file. The build was not marked complete.");
 if(valid.some(f=>/(TODO|LOREM IPSUM|REPLACE ME|IMPLEMENT_ME)/i.test(f.content)))throw Error("Backend CodeWriter output contains unfinished placeholders. The build was not marked complete.");
 emit(hooks,"codewriter-done","Backend source generated: "+valid.map(f=>f.path).join(", ")+".");
 return valid;
}
async function modifyExistingProject(request,existing,engine,hooks,options){
    const originals=Array.isArray(existing?.files)?existing.files.map(f=>({path:String(f.path||""),content:String(f.content||"")})):[];
    if(!originals.length)throw Error("No existing project files were supplied. The current project was not replaced.");
    emit(hooks,"understanding","Existing project detected. CodeWriter is editing its current files; it will not create a replacement project.");
    const q=String(request||"").trim(),lower=q.toLowerCase();
    const styleIntent=/\b(?:ui|interface|theme|color|colour|background|layout|spacing|font|typography|responsive|appearance)\b/i.test(q);
    const textIntent=/\b(?:title|heading|label|text|wording|copy|rename|brand name)\b/i.test(q);
    let targets=[];
    if(styleIntent)targets=originals.filter(f=>/\.css$/i.test(f.path));
    else if(textIntent)targets=originals.filter(f=>/\.html?$/i.test(f.path)).slice(0,1);
    else if(/\b(?:feature|button|form|behavior|function|interaction|logic|workflow|validation|search|filter|export|add|remove|delete|save|edit)\b/i.test(q)){
      targets=originals.filter(f=>/\.js$/i.test(f.path)&&!/^server\//i.test(f.path)).slice(0,1);
      const html=originals.find(f=>/\.html?$/i.test(f.path));if(html&&/\b(?:add|remove|new|field|screen|panel|form|button)\b/i.test(q))targets.push(html);
    }
    if(!targets.length)targets=originals.filter(f=>/\.(?:html?|css|js)$/i.test(f.path)).slice(0,2);
    if(!targets.length)throw Error("No editable HTML, CSS or JavaScript file was found. The original project remains unchanged.");
    const updated=new Map();
    for(const file of targets){
      if(file.content.length>14000)throw Error("The existing file "+file.path+" is too large for a safe local rewrite. The original project remains unchanged.");
      emit(hooks,"codewriter","Editing the existing file "+file.path+" while preserving its current structure and features.");
      const prompt="You are a senior engineer modifying an EXISTING application. This is NOT a new-project task. Rewrite the COMPLETE file below, applying ONLY the user's requested change. Preserve all unrelated code, existing behavior, IDs, selectors, data structures, integrations, accessibility and responsive behavior. Do not add a new app, new heading that merely repeats the request, TODOs, placeholders, pseudocode or explanations. Return ONLY the full replacement file contents, without Markdown fences.\nUSER CHANGE:\n"+q+"\nEXISTING FILE PATH:\n"+file.path+"\nCURRENT COMPLETE FILE:\n"+file.content+"\nReturn the complete modified "+file.path+" now.";
      const generated=await engine.generate(prompt,[],{maxTokens:2048,timeoutMs:600000,signal:options.signal,temperature:0.05,topP:0.72,onToken:(delta,accumulated,count)=>{if(count%32===0)emit(hooks,"codewriter","Updating "+file.path+" · approximately "+count+" tokens.");}});
      let content=String(generated?.response||generated?.text||generated||"").trim();
      const fence=String.fromCharCode(96).repeat(3);
      if(content.startsWith(fence)){content=content.slice(fence.length).replace(/^[a-z0-9_-]*\s*/i,"");const end=content.lastIndexOf(fence);if(end>=0)content=content.slice(0,end).trim();}
      if(content.startsWith("{")){try{const parsed=JSON.parse(content);if(typeof parsed.content==="string")content=parsed.content;}catch{}}
      if(content.length<Math.min(80,Math.floor(file.content.length*0.25)))throw Error("CodeWriter returned an incomplete rewrite for "+file.path+". The original project was preserved.");
      if(/(?:TODO|IMPLEMENT_ME|YOUR_CODE_HERE|LOREM IPSUM)/i.test(content))throw Error("The proposed edit for "+file.path+" contains unfinished placeholders. The original project was preserved.");
      if(/\.html?$/i.test(file.path)&&(!/<html\b/i.test(content)||!/<\/html\s*>/i.test(content)))throw Error("The proposed HTML edit is incomplete. The original project was preserved.");
      updated.set(file.path,content);
    }
    const files=originals.map(f=>({...f,content:updated.get(f.path)||f.content}));
    const validationResponse=await fetch("/api/code-writer",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({request:"Modify the existing application in place",files})});
    const validation=await validationResponse.json().catch(()=>({}));
    if(!validationResponse.ok||!validation.ok||!Array.isArray(validation.files))throw Error("The existing-project modification failed validation: "+String(validation.error||"unknown validation error")+". Original preview preserved.");
    emit(hooks,"codewriter-done","Modified "+Array.from(updated.keys()).join(", ")+" and preserved "+(files.length-updated.size)+" unchanged project file(s).");
    return {
      name:String(existing.name||"Existing application"),
      summary:"Modified the existing application in place: "+q,
      files:validation.files,
      modifiedFiles:Array.from(updated.keys()),
      validation:validation.validation,
      backendValidation:{engine:validation.engine,generatedBy:validation.generatedBy,manifest:validation.manifest,totalBytes:validation.totalBytes},
      plan:{intent:q,productType:"existing project modification",architecture:"Existing project inspection → targeted file edits → static validation",features:[],screens:[]},
      agent:{name:"HAxBRO App Maker",provider:"Qwen local · existing-project CodeWriter",local:true,existingProjectEdit:true},
      steps:["Loaded the complete existing project file set","Edited only the files relevant to the requested change","Preserved every other existing file","Validated the complete modified project"]
    };
  }
  async function build(request,history,hooks,options){
 hooks=hooks||{};options=options||{};var q=clean(request,1800);if(!q)throw Error("Describe what you want to create.");
 if(!window.HAxBROCodeWriterEngine||!window.HAxBROCodeWriterEngine.compile)throw Error("Independent CodeWriter engine is not loaded.");
 emit(hooks,"understanding","Matching your idea against the complete existing App Maker template library. No local language model is used for this build.");
 if(!options.existing?.files?.length){if(!window.HAxBROTemplateFactory||typeof window.HAxBROTemplateFactory.render!=="function"||typeof window.HAxBROTemplateFactory.list!=="function")throw Error("The existing App Maker template engine is not loaded. KAI was not called.");
   var starterList=window.HAxBROTemplateFactory.list();
   if(!Array.isArray(starterList)||!starterList.length)throw Error("The existing App Maker template library did not load. No substitute template was used.");
   var guided=window.HAxBROGuidedTemplateChoice;
   var stopWords=new Set(["the","and","for","with","that","this","make","build","create","please","app","application","website","tool","platform","using","called","named","want","need","me","my","a","an","of","to","in","on","from","into"]);
   var tokens=q.toLowerCase().match(/[a-z0-9]+/g)||[];
   var useful=tokens.filter(function(w){return !stopWords.has(w)&&w.length>2});
   var ranked=starterList.map(function(t){
     var hay=(t.name+" "+t.description+" "+t.category+" "+t.layout).toLowerCase();
     var score=useful.reduce(function(n,w){return n+(hay.includes(w)?3:0)},0);
     if(/\b(ai|chatbot|assistant|copilot|llm|chat)\b/i.test(q)&&t.id==="pro-021")score+=18;
     if(/\b(ai|artificial intelligence)\b/i.test(q)&&/\b(workspace|workbench|studio|chat|assistant|copilot)\b/i.test(q)&&t.id==="pro-021")score+=60;
     if(/\b(ai|artificial intelligence)\b/i.test(q)&&/\b(workspace|workbench|studio|chat|assistant|copilot)\b/i.test(q)&&t.id==="ai-black")score+=34;
     if(/\b(ai|artificial intelligence)\b/i.test(q)&&/\b(workspace|workbench|studio|chat|assistant|copilot)\b/i.test(q)&&t.id==="ai-blue")score+=32;
     if(/\b(ai|artificial intelligence)\b/i.test(q)&&/\b(agent|workflow|automation)\b/i.test(q)&&t.id==="pro-022")score+=65;
     if(/\b(ai|artificial intelligence)\b/i.test(q)&&/\b(writer|writing|content|copywriting)\b/i.test(q)&&t.id==="writer")score+=65;
     if(/\b(ai|artificial intelligence)\b/i.test(q)&&/\b(image|picture|art|visual)\b/i.test(q)&&t.id==="pro-029")score+=65;
     if(/\b(agent|automation|workflow)\b/i.test(q)&&t.id==="pro-022")score+=20;
     if(/\b(api|endpoint|rest|request tester|api tester)\b/i.test(q)&&t.id==="pro-030")score+=20;
     if(/\b(ide|code editor|online editor|coding workspace)\b/i.test(q)&&t.id==="pro-024")score+=20;
     if(/\b(database|sql|tables|records)\b/i.test(q)&&t.id==="pro-026")score+=20;
     if(/\b(prompt|prompt library)\b/i.test(q)&&t.id==="pro-027")score+=20;
     if(/\b(document|pdf|knowledge base|knowledge)\b/i.test(q)&&t.id==="pro-028")score+=12;
     if(/\b(image|image generator|image studio)\b/i.test(q)&&t.id==="pro-029")score+=20;
     if(/\b(server|uptime|monitor|monitoring)\b/i.test(q)&&t.id==="pro-031")score+=20;
     if(/\b(expense|spending|transactions)\b/i.test(q)&&t.id==="pro-036")score+=20;
     if(/\b(finance|money|personal finance|cash flow)\b/i.test(q)&&t.id==="pro-035")score+=20;
     if(/\b(crm|customer|leads|sales)\b/i.test(q)&&t.id==="pro-002")score+=20;
     if(/\b(store|shop|ecommerce|e-commerce|products|cart)\b/i.test(q)&&t.id==="pro-011")score+=20;
     if(/\b(invoice|billing|payments)\b/i.test(q)&&t.id==="pro-005")score+=20;
     if(/\b(analytics|metrics|kpi|dashboard)\b/i.test(q)&&t.id==="pro-001")score+=12;
     return {template:t,score:score};
   }).sort(function(a,b){return b.score-a.score});
   var guidedIsCurrent=guided&&(!guided.query||guided.query.trim().toLowerCase()===q.trim().toLowerCase());
   var chosen=guidedIsCurrent&&starterList.find(function(t){return t.id===guided.id})||ranked[0]?.template;
   if(!chosen)throw Error("The request could not be matched to an existing template. No placeholder was generated.");
   var explicitName=q.match(/\b(?:called|named|name it|call it)\s+["']?([^"'.,!?;\n]{2,60})/i);
   var derived=q.replace(/^\s*(please\s+)?(build|make|create|design|develop)\s+(me\s+)?/i,"").split(/\b(?:for|with|that|which|using|including)\b/i)[0].replace(/\b(a|an|the)\b/gi," ").replace(/\s+/g," ").trim();
   var appName=String(explicitName?.[1]||derived||chosen.name).trim().split(/\s+/).slice(0,7).map(function(w){return w.charAt(0).toUpperCase()+w.slice(1)}).join(" ");
   if(appName.length<2||appName.length>64)appName=chosen.name;
   emit(hooks,"architect","Selected "+chosen.name+" ("+chosen.id+") from the existing template library. Applying your requested name: "+appName+".");
   var data=window.HAxBROTemplateFactory.render(chosen.id,appName,window.HAxBROSelectedAppTemplate?.theme||"Studio Light");
   data.plan={intent:q,productType:chosen.category==="ai"?"AI application":chosen.category+" application",architecture:"Existing generated template -> rename -> CodeWriter validation",features:[chosen.description],screens:[chosen.name]};
   data.agent={name:"HAxBRO App Maker",provider:"existing generated template library",model:"Existing template renderer",local:true,externalModel:false,templateOnly:true};
   data.steps=["Matched the request to one of the existing generated template library","Copied the selected template into the new project","Changed the application name while preserving the template's existing layout and interactions","Validated the generated HTML with CodeWriter"];
   emit(hooks,"build","Copied "+chosen.name+" and renamed it "+appName+".");
   var templateCheck=await fetch("/api/code-writer",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({request:q,files:data.files})});
   var templateValidation=await templateCheck.json().catch(function(){return {}});
   if(!templateCheck.ok||!templateValidation.ok||!Array.isArray(templateValidation.files))throw Error("The selected existing template did not pass CodeWriter validation: "+String(templateValidation.error||"validation failed"));
   data.files=templateValidation.files;data.validation=templateValidation.validation;data.backendValidation={engine:templateValidation.engine,generatedBy:templateValidation.generatedBy,manifest:templateValidation.manifest,totalBytes:templateValidation.totalBytes};
   emit(hooks,"complete","Existing template copied, renamed and validated. No Qwen call was made.");
   return data;
 }
 if(!options.existing?.files?.length&&/\b(?:hpro|hepro|hero)\s*ai\b/i.test(q)){
   emit(hooks,"architect","Recognized the Hero AI workspace request. Building the actual chat workspace blueprint, not a prompt-only landing page.");
   var heroCatalog=Array.isArray(window.HAxBROAppTemplateCatalog)?window.HAxBROAppTemplateCatalog:[];
   var heroTemplate=heroCatalog.find(function(t){return /ai chatbot|chatbot|ai workspace/i.test(String(t.name||"")+" "+String(t.category||"")+" "+String(t.layout||""))})||null;
   var heroSpec={name:"Hero AI",purpose:"A working AI chat workspace where people connect their own provider API key, choose an AI provider and model, hold interactive conversations, and keep conversation history locally.",productType:"AI chatbot workspace",features:["Interactive AI chat with real provider responses","Bring your own OpenAI, Groq or OpenRouter API key","Choose and edit the model","Thinking, response and error states","Local conversation history with clear-history control","API key is not stored in conversation history"],selectedTemplateId:heroTemplate?.id||"",selectedTemplateReason:"AI chatbot workspace is the closest internal starter; the chat workflow and provider controls are purpose-built.",design:{background:"#F7F8FA",surface:"#FFFFFF",primary:"#2563EB",text:"#111827",fontFamily:"Inter,system-ui,sans-serif"},pages:[{title:"Hero AI Workspace",sections:[{type:"nav",brand:"Hero AI",items:[{title:"Workspace",href:"#workspace"}]},{type:"hero",id:"top",eyebrow:"YOUR AI WORKSPACE",title:"Meet Hero AI",description:"A focused AI workspace powered by the provider and model you choose. Bring your own API key and start a real conversation."},{type:"chat",id:"workspace",title:"Chat with Hero AI",description:"Choose your provider, enter your API key and start chatting.",assistantName:"Hero AI",defaultModel:"gpt-4o-mini",instructions:"You are Hero AI, a capable, clear and accurate AI assistant. Understand the user's intent, answer directly, explain reasoning when useful, and never invent facts or claim actions you did not perform."},{type:"footer",title:"Hero AI",description:"Your workspace. Your provider. Your conversations."}]}]};
   var heroData=compileSpec(heroSpec,hooks);
   emit(hooks,"backend-validation","Validating Hero AI HTML, CSS and interactive chat logic.");
   var heroResponse=await fetch("/api/code-writer",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({request:"Build Hero AI, a working AI chatbot workspace with provider API-key connection, model selection, chat, and local conversation history.",files:heroData.files})});
   var heroValidation=await heroResponse.json().catch(function(){return {}});
   if(!heroResponse.ok||!heroValidation.ok||!Array.isArray(heroValidation.files))throw Error("Hero AI did not pass real project validation: "+String(heroValidation.error||"unknown validation error"));
   heroData.files=heroValidation.files;heroData.validation=heroValidation.validation;heroData.backendValidation={engine:heroValidation.engine,generatedBy:heroValidation.generatedBy,manifest:heroValidation.manifest,totalBytes:heroValidation.totalBytes};
   heroData.templateId=heroTemplate?.id||"";heroData.templateName=heroTemplate?.name||"";heroData.templateCategory=heroTemplate?.category||"";heroData.templateLayout=heroTemplate?.layout||"";heroData.templateReason=heroSpec.selectedTemplateReason;
   heroData.plan={intent:heroSpec.purpose,productType:heroSpec.productType,architecture:"Hero AI workspace blueprint → CodeWriter HTML/CSS/JS compiler → backend static validation",features:heroSpec.features,screens:["Hero AI Workspace"]};
   heroData.agent={name:"HAxBRO App Maker",provider:"Hero AI workspace blueprint + CodeWriter",model:"HAxBRO CodeWriter",local:true,externalModel:false,byok:true};
   heroData.steps=["Recognized Hero AI as an AI chatbot workspace","Generated the actual chat interface and provider controls","Connected chat requests to the HAxBRO AI provider bridge","Added local conversation history without saving the API key","Validated the generated HTML, CSS and JavaScript"];
   emit(hooks,"complete","Hero AI workspace generated and passed "+heroValidation.validation.passed+"/"+heroValidation.validation.total+" backend checks.");
   return heroData;
  }
  var engine=null;
 if(isCodeRequest(q)){engine=await qwenEngine(hooks);if(!engine||!engine.generate)throw Error("Qwen local interpreter is not ready.");if(options.existing?.files?.length)return await modifyExistingProject(q,options.existing,engine,hooks,options);emit(hooks,"understanding","Detected a direct programming-language request. CodeWriter will generate native source instead of a website.");return await buildCodeArtifact(q,engine,hooks,options);}
 const native=needsBackend(q)||!options.existing?.files?.length?null:await buildNativeFastPath(q,options,hooks);if(native)return native;
 engine=await qwenEngine(hooks);if(!engine||!engine.generate)throw Error("Qwen local interpreter is not ready.");
 var prior="None";if(options.existing&&options.existing.files){prior=options.existing.files.slice(0,3).map(function(f){return clean(f.path,60)+": "+clean(f.content,420)}).join("\n")}var templateCatalog=Array.isArray(window.HAxBROAppTemplateCatalog)?window.HAxBROAppTemplateCatalog:[];var rawDesignOptions=Array.isArray(window.HAxBRODesignOptions)?window.HAxBRODesignOptions:templateCatalog;var selectedTemplate=options.existing?.templateId?{id:options.existing.templateId,name:options.existing.templateName||options.existing.name,category:options.existing.templateCategory||"",theme:options.existing.theme||""}:window.HAxBROSelectedAppTemplate||null;var terms=q.toLowerCase().match(/[a-z0-9]{3,}/g)||[];var rankedOptions=rawDesignOptions.map(function(t){var hay=[t.id,t.name,t.category,t.kind,t.layout,t.description].join(" ").toLowerCase();var score=terms.reduce(function(n,w){return n+(hay.includes(w)?1:0)},0);return {t:t,score:score}}).sort(function(a,b){return b.score-a.score});var designOptions=rankedOptions.slice(0,6).map(function(x){var t=x.t;return {id:t.id,name:t.name,category:t.category,kind:t.kind}});var templateContext="INTERNAL STARTER OPTIONS (never show a gallery): "+JSON.stringify(designOptions)+"\nChoose the closest structural starter, but build the user's actual requested product and custom features. A starter is not the finished app. Never copy it unchanged or merely rename it. If editing an existing project, preserve its starter unless redesign is requested. Current starter: "+JSON.stringify(selectedTemplate);
 var schema="Act only as a requirements interpreter. Do NOT write source code. Output ONLY valid JSON, normally 250–500 tokens. Do not repeat the user request as page copy. Build a specific product specification with concrete features and screen structure. Required shape must include selectedTemplateId (one of the internal design option IDs) and selectedTemplateReason (brief fit rationale): {\"name\":\"\",\"purpose\":\"\",\"productType\":\"website/app/game/tool/etc\",\"features\":[\"\"],\"design\":{\"background\":\"#hex\",\"surface\":\"#hex\",\"primary\":\"#hex\",\"text\":\"#hex\",\"fontFamily\":\"\"},\"pages\":[{\"title\":\"\",\"sections\":[{\"type\":\"hero\",\"title\":\"\",\"description\":\"\"},{\"type\":\"cards\",\"title\":\"\",\"items\":[{\"title\":\"\",\"description\":\"\"}]}]}]}. Choose section types that fit the actual request: nav, hero, chat, ai-chat, cards, stats, form, list, table, faq, tabs, counter, calculator, footer, or content. Preserve requested details and exact design choices. Infer a useful structure; do not force a calculator or project helper. For non-website requests, express the product's screens and behaviors as suitable sections and features. If modifying an existing project, preserve its identity and features. No markdown, no explanation, no code.";schema="KAI is the product architect. Read the complete user request and design the actual product, not a renamed template. Return compact valid JSON only (about 120-180 tokens) with keys name, purpose, productType, selectedTemplateId, selectedTemplateReason, features, design {background,surface,primary,text,fontFamily}, and pages [{title,sections:[{type,title,description,items}]}]. Choose a suitable section type for the requested product. Preserve every explicit requirement, workflow and interaction. Support any app, website, tool, game or project; never force calculators or project helpers. A starter is scaffolding only: customise it substantially. No placeholder, pseudocode, or source code.";
 emit(hooks,"ponder","Qwen is producing a compact technical specification. CodeWriter will generate all source files after this step.");
 var tokenProgress=0,fallbackUsed=false,fallbackReason="";var architectPrompt=schema+"\n"+templateContext+"\nUSER REQUEST: "+q+"\nEXISTING PROJECT: "+prior+"\nJSON only.";var estimateTokens=function(value){return Math.ceil(new TextEncoder().encode(value).length/3);};while(designOptions.length&&estimateTokens(architectPrompt)>430){designOptions.pop();templateContext="INTERNAL STARTER OPTIONS (never show a gallery): "+JSON.stringify(designOptions)+"\nChoose one suitable starter as scaffolding only; build the complete custom product. Never merely copy and rename it. Current starter: "+JSON.stringify(selectedTemplate);architectPrompt=schema+"\n"+templateContext+"\nUSER REQUEST: "+q+"\nEXISTING PROJECT: "+prior+"\nJSON only.";}if(estimateTokens(architectPrompt)>760)throw Error("This request is still too large for the current local model context after removing optional template metadata. KAI has preserved your request and stopped safely.");var r=await engine.generate(architectPrompt,[],{maxTokens:256,timeoutMs:0,signal:options.signal,temperature:0.05,topP:0.65,onToken:function(delta,accumulated,count){if(count>=tokenProgress+8){tokenProgress=count;emit(hooks,"ponder","Qwen is composing the technical specification ("+count+" tokens generated).")}}}).catch(err=>{if(options.signal?.aborted)throw err;emit(hooks,"architect","KAI could not finish the product specification. Stopping instead of generating a prompt-shaped placeholder.");throw new Error("KAI could not interpret this build request: "+clean(err?.message||err,180)+". No fake or placeholder app was generated.");});
 var raw=typeof r==="string"?r:(r.response||r.text||r.content||"");var spec;
 try{spec=parse(raw)}catch(err){if(options.signal?.aborted)throw err;emit(hooks,"architect","KAI returned an invalid product specification. Stopping rather than compiling the original prompt as page content.");throw new Error("KAI returned an invalid product specification: "+clean(err?.message||err,180)+". No placeholder app was generated.")}
 spec=enforceExplicitRequirements(spec,q);var chosenTemplate=templateCatalog.find(function(t){return t.id===String(spec.selectedTemplateId||"")});if(!chosenTemplate&&!options.existing?.templateId){chosenTemplate=designOptions.find(function(t){return /custom|blank/i.test(String(t.kind||"")+" "+String(t.layout||""))})||null;}if(options.existing?.templateId&&!/\b(?:change|switch|replace|redesign|different template|new design|don't like|do not like)\b/i.test(q)){chosenTemplate=templateCatalog.find(function(t){return t.id===options.existing.templateId})||chosenTemplate;}if(options.existing?.templateId&&['change','switch','replace','redesign','different template','new design','dont like','do not like'].some(function(k){return q.toLowerCase().includes(k)})){chosenTemplate=templateCatalog.find(function(t){return t.id===String(spec.selectedTemplateId||'')})||chosenTemplate;}if(chosenTemplate){spec.selectedTemplateId=chosenTemplate.id;spec.selectedTemplateName=chosenTemplate.name;spec.selectedTemplateCategory=chosenTemplate.category;spec.selectedTemplateLayout=chosenTemplate.layout;spec.selectedTemplateReason=clean(spec.selectedTemplateReason||"Selected as the closest structural fit; all requested features remain custom.",240);}else{spec.selectedTemplateId="";spec.selectedTemplateName="";}
    emit(hooks,"architect",fallbackUsed?"Fallback specification is ready. Handing it to independent CodeWriter.":"Qwen completed the technical specification. Explicit colors, card counts and requested buttons have been checked. Handing it to independent CodeWriter.");
 var data=compileSpec(spec,hooks);data.templateId=spec.selectedTemplateId||"";data.templateName=spec.selectedTemplateName||"";data.templateCategory=spec.selectedTemplateCategory||"";data.templateLayout=spec.selectedTemplateLayout||"";data.templateReason=spec.selectedTemplateReason||"";if(needsBackend(q)){var backendFiles=await generateBackendFiles(q,spec,engine,hooks);var existingPaths=new Set(data.files.map(function(f){return f.path}));backendFiles.forEach(function(f){if(!existingPaths.has(f.path)){data.files.push(f);existingPaths.add(f.path)}});data.backendGenerated=true;data.backendFiles=backendFiles.map(function(f){return f.path});data.agent={...data.agent,provider:"HAxBRO App Maker · integrated local Qwen + CodeWriter",model:"Qwen3-0.6B local · CodeWriter compiler",qwenRole:"requirements interpretation and backend source generation",backendCodeWriter:true};data.steps.push("Integrated CodeWriter generated backend source files; runtime connection and deployment remain separate.");}emit(hooks,"backend-validation","Submitting the complete generated project, including backend source when requested, to the HAxBRO CodeWriter validator.");var backendResponse=await fetch("/api/code-writer",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({request:q,files:data.files})});var backend=await backendResponse.json().catch(function(){return {}});if(!backendResponse.ok||!backend.ok||!Array.isArray(backend.files))throw Error(backend.error||"The HAxBRO CodeWriter backend could not validate this project.");data.files=backend.files;data.validation=backend.validation;data.backendValidation={engine:backend.engine,generatedBy:backend.generatedBy,manifest:backend.manifest,totalBytes:backend.totalBytes};emit(hooks,"backend-validation-done","The HAxBRO backend accepted all "+backend.validation.passed+"/"+backend.validation.total+" generated-project checks.");data.plan={intent:clean(spec.purpose,400),productType:clean(spec.productType,80)||"custom application",architecture:needsBackend(q)?"Template-aware request → local Qwen architecture → CodeWriter frontend and backend source generation → static validation":"Template-aware request → local Qwen specification → CodeWriter project compilation → static validation",features:Array.isArray(spec.features)?spec.features:[],screens:spec.pages.map(function(p){return p.title})};
 if(fallbackUsed){data.fallback=true;data.fallbackReason=fallbackReason;data.agent={...data.agent,provider:"HAxBRO local request-preserving fallback",model:"CodeWriter fallback 1.0",qwenFallback:true};data.steps=["Qwen interpretation timed out; no false Qwen completion was claimed","A transparent fallback extracted explicit colors, card count and contact intent","Independent CodeWriter generated HTML, CSS and JavaScript","Generated files passed structural validation"]}emit(hooks,"complete",fallbackUsed?"CodeWriter generated and validated the fallback project. Review its details before publishing.":"Independent CodeWriter generated and validated the project files. Qwen only interpreted instructions.");return data
}
window.HAxBROCodeMaker=Object.freeze({version:"7.2.0-qwen-compact-spec-independent-codewriter",build:build,compileSpecification:compileSpec,parseSpecification:parse});
})();