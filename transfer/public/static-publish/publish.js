(() => {
  const $ = (id) => document.getElementById(id);
  const zone=$("dropzone"), zip=$("zipInput"), folder=$("folderInput"), filesInput=$("filesInput");
  const summary=$("fileSummary"), fileList=$("fileList"), status=$("status"), publish=$("publishBtn");
  let entries=[];
  const MAX=6*1024*1024;
  const say=(s)=>status.textContent=s;
  const safePath=(raw)=>{
    const p=String(raw||"").split("\\").join("/").replace(/^\/+/,"");
    if(!p||p.split("/").some(x=>!x||x==="."||x===".."))throw Error("The upload contains an unsafe file path.");
    return p;
  };
  const toBase64=(bytes)=>{let s="";for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);};
  const isText=(p)=>/\.(html?|css|m?js|json|txt|svg|xml|webmanifest|md|csv|ya?ml|toml|map|sql)$/i.test(p);
  async function unzip(file){
    const bytes=new Uint8Array(await file.arrayBuffer()),v=new DataView(bytes.buffer);let end=-1;
    for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65558);i--)if(v.getUint32(i,true)===0x06054b50){end=i;break;}
    if(end<0)throw Error("This ZIP archive is invalid.");
    const count=v.getUint16(end+10,true);let off=v.getUint32(end+16,true),out=[],total=0;
    if(count>100)throw Error("ZIP contains more than 100 files.");
    for(let n=0;n<count;n++){
      if(v.getUint32(off,true)!==0x02014b50)throw Error("The ZIP directory is damaged.");
      const method=v.getUint16(off+10,true),packedSize=v.getUint32(off+20,true),size=v.getUint32(off+24,true),nl=v.getUint16(off+28,true),el=v.getUint16(off+30,true),cl=v.getUint16(off+32,true),local=v.getUint32(off+42,true);
      const name=new TextDecoder().decode(bytes.subarray(off+46,off+46+nl));off+=46+nl+el+cl;if(!name||name.endsWith("/"))continue;
      if(method!==0&&method!==8)throw Error("Unsupported ZIP compression: "+name);
      total+=size;if(total>MAX)throw Error("Unpacked website exceeds 6 MB.");
      const ln=v.getUint16(local+26,true),le=v.getUint16(local+28,true),start=local+30+ln+le,packed=bytes.subarray(start,start+packedSize);
      let data;if(method===0)data=packed.slice();else{if(!window.DecompressionStream)throw Error("This browser cannot unpack this ZIP. Choose the folder instead.");data=new Uint8Array(await new Response(new Blob([packed]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer());}
      if(data.length!==size)throw Error("ZIP verification failed: "+name);
      out.push({path:safePath(name),bytes:data});
    }return out;
  }
  function normalize(items){
    if(!items.length)return items;
    const first=items[0].path.split("/")[0];
    if(first&&items.every(x=>x.path.startsWith(first+"/")))items.forEach(x=>x.path=x.path.slice(first.length+1));
    if(!items.some(x=>x.path.toLowerCase()==="index.html")){
      const html=items.find(x=>/^index\.htm$/i.test(x.path))||items.find(x=>/\.html?$/i.test(x.path));
      if(html){html.path="index.html";items=items.filter(x=>x!==html);items.unshift(html);}
    }return items;
  }
  async function read(list){
    const arr=Array.from(list||[]);if(!arr.length)return [];
    if(arr.length===1&&/\.zip$/i.test(arr[0].name))return normalize(await unzip(arr[0]));
    if(arr.length>100)throw Error("Choose no more than 100 files.");
    let total=0;const out=[];
    for(const f of arr){const path=safePath(f.webkitRelativePath||f.name),bytes=new Uint8Array(await f.arrayBuffer());total+=bytes.length;if(total>MAX)throw Error("Website exceeds the 6 MB upload limit.");out.push({path,bytes});}
    return normalize(out);
  }
  function show(items){
    entries=items;summary.hidden=false;fileList.replaceChildren();
    items.slice(0,14).forEach(x=>{const li=document.createElement("li");li.textContent=x.path;fileList.appendChild(li);});
    if(items.length>14){const li=document.createElement("li");li.textContent="and "+(items.length-14)+" more…";fileList.appendChild(li);}
    const total=items.reduce((n,x)=>n+x.bytes.length,0),index=items.some(x=>x.path==="index.html");
    $("fileCount").textContent=items.length+" files · "+(total/1024).toFixed(1)+" KB";
    $("indexNotice").textContent=index?"Homepage ready: index.html":"No HTML homepage found. Add an .html file to publish.";
    publish.disabled=!index;say(index?"Your homepage is ready to publish.":"Add an HTML file so we can create your homepage.");
  }
  async function select(list){try{publish.disabled=true;say("Reading and preparing your files…");const items=await read(list);if(!items.length){say("No files selected.");return;}show(items);}catch(e){entries=[];summary.hidden=true;publish.disabled=true;say(e.message||"Could not read these files.");}}
  $("zipBtn").onclick=e=>{e.stopPropagation();zip.click();};$("folderBtn").onclick=e=>{e.stopPropagation();folder.click();};$("filesBtn").onclick=e=>{e.stopPropagation();filesInput.click();};
  zip.onchange=e=>select(e.target.files);folder.onchange=e=>select(e.target.files);filesInput.onchange=e=>select(e.target.files);
  zone.onclick=e=>{if(!e.target.closest("button"))filesInput.click();};zone.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();filesInput.click();}};
  ["dragenter","dragover"].forEach(t=>zone.addEventListener(t,e=>{e.preventDefault();zone.classList.add("dragover");}));
  ["dragleave","drop"].forEach(t=>zone.addEventListener(t,e=>{e.preventDefault();zone.classList.remove("dragover");}));
  zone.addEventListener("drop",e=>{if(e.dataTransfer.files.length)select(e.dataTransfer.files);});
  $("clearBtn").onclick=()=>{entries=[];summary.hidden=true;publish.disabled=true;zip.value=folder.value=filesInput.value="";say("Choose your website files to get started.");};
  publish.onclick=async()=>{
    if(!entries.length||publish.disabled)return;publish.disabled=true;publish.textContent="Publishing…";say("Preparing and publishing your website…");
    try{
      const payload=entries.map(x=>isText(x.path)?{path:x.path,content:new TextDecoder().decode(x.bytes)}:{path:x.path,contentBase64:toBase64(x.bytes)});
      const res=await fetch("/api/public-deploy",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({name:"HAxBRO Website",files:payload})});
      const data=await res.json().catch(()=>({}));if(!res.ok||!data.ok||!data.url)throw Error(data.error||"Publishing failed.");
      say("Your website is live.");const result=$("result");result.hidden=false;result.replaceChildren();
      const strong=document.createElement("strong");strong.textContent="Published successfully";const a=document.createElement("a");a.href=data.url;a.target="_blank";a.rel="noopener noreferrer";a.textContent=data.url;
      const copy=document.createElement("button");copy.textContent="Copy link";copy.onclick=()=>navigator.clipboard?.writeText(data.url);result.append(strong,a,copy);publish.textContent="Published ✓";
    }catch(e){say("Could not publish: "+(e.message||"Unknown error"));publish.disabled=false;publish.textContent="Publish website ↗";}
  };
})();