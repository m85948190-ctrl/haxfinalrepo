(function(){
"use strict";
const $=id=>document.getElementById(id);
let project=null,active=0,blueprint=null;
function status(text){$("status").textContent=text;}
function updateLearning(){const n=window.HAxBROCodeWriterLocal.learning().length;$("learnCount").textContent=n;}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function render(){
if(!project)return;
$("outputTitle").textContent=project.name;$("outputSub").textContent=project.kind+" · generated "+new Date(project.createdAt).toLocaleString();
$("fileCount").textContent=project.files.length;$("lineCount").textContent=project.lineCount;
$("downloadZip").disabled=false;
$("fileList").innerHTML=project.files.map((f,i)=>'<button type="button" data-file="'+i+'" class="'+(i===active?'active':'')+'">'+esc(f.path)+'</button>').join("");
$("fileList").querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{active=Number(b.dataset.file);renderFile();}));
renderFile();
$("reviewItems").innerHTML=project.review.map(x=>'<div class="review-item"><b>'+esc(x.level.toUpperCase())+'</b><span>'+esc(x.file+' — '+x.message)+'</span></div>').join("");
$("reviewState").textContent=project.review.some(x=>x.level==="error")?"ISSUES FOUND":"CHECKS COMPLETE";
const html=project.files.find(f=>f.path==="index.html"),css=project.files.find(f=>f.path==="styles.css"),js=project.files.find(f=>f.path==="app.js");
if(html){$("previewPanel").hidden=false;let doc=html.content.replace(/<link[^>]+href=["']styles\.css["'][^>]*>/i,"<style>"+(css?css.content:"")+"</style>").replace(/<script[^>]+src=["']app\.js["'][^>]*><\/script>/i,"<script>"+(js?js.content:"")+"</script>");$("preview").srcdoc=doc;}else{$("previewPanel").hidden=true;}
}
function renderFile(){if(!project)return;const f=project.files[active];$("activeFile").textContent=f.path;$("source").value=f.content;$("copyFile").disabled=false;$("downloadFile").disabled=false;$("fileList").querySelectorAll("button").forEach((b,i)=>b.classList.toggle("active",i===active));}
function download(name,data,type){const blob=new Blob([data],{type:type||"text/plain;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);}
function crc32(bytes){let c=-1;for(let i=0;i<bytes.length;i++){c^=bytes[i];for(let j=0;j<8;j++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^-1)>>>0;}
function zip(files){
const enc=new TextEncoder(),parts=[],central=[];let offset=0;
function u16(n){return[n&255,(n>>>8)&255];}function u32(n){return[n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255];}
files.forEach(f=>{const name=enc.encode(f.path),data=enc.encode(f.content),crc=crc32(data),local=[80,75,3,4,...u16(20),0,0,...u16(0),...u16(0),...u16(0),...u32(crc),...u32(data.length),...u32(data.length),...u16(name.length),0,0,...name];parts.push(new Uint8Array(local),data);const dir=[80,75,1,2,...u16(20),...u16(20),0,0,...u16(0),...u16(0),...u16(0),...u32(crc),...u32(data.length),...u32(data.length),...u16(name.length),0,0,0,0,0,0,0,0,...u32(0),...u32(offset),...name];central.push(new Uint8Array(dir));offset+=local.length+data.length;});
const centralSize=central.reduce((n,x)=>n+x.length,0),end=new Uint8Array([80,75,5,6,0,0,0,0,...u16(files.length),...u16(files.length),...u32(centralSize),...u32(offset),0,0]);return new Blob([...parts,...central,end],{type:"application/zip"});
}
$("language").addEventListener("change",()=>{$("styleWrap").style.display=$("language").value==="html"?"block":"none";});
$("generate").addEventListener("click",()=>{
try{$("generate").disabled=true;status("Understanding your request and preparing a project blueprint…");blueprint=window.HAxBROUnderstanding.parse($("request").value);$("understanding").hidden=false;$("blueprintText").textContent=window.HAxBROUnderstanding.explain(blueprint);$("blueprintMeta").textContent="Detected features: "+(blueprint.features.join(", ")||"none")+" · Pages: "+(blueprint.pages.join(", ")||"not specified")+" · Entities: "+(blueprint.dataEntities.join(", ")||"not specified")+" · Complexity: "+blueprint.complexity;status("Blueprint ready. Code Writer is generating the project…");project=window.HAxBROCodeWriterLocal.generate({request:$("request").value,language:$("language").value,name:$("projectName").value,style:$("design").value,blueprint});active=0;render();status("Generated "+project.files.length+" source files. "+project.lineCount+" lines. No network or model was used.");}
catch(e){status("Not generated: "+e.message);$("outputSub").textContent=e.message;}
finally{$("generate").disabled=false;}
});
$("saveLesson").addEventListener("click",()=>{const lesson=$("lesson").value.trim();if(!lesson){status("Write a correction or lesson first.");return;}const count=window.HAxBROCodeWriterLocal.remember({request:$("request").value,language:$("language").value,lesson:lesson,example:project?project.files[0].content:""});$("lesson").value="";updateLearning();status("Saved locally. "+count+" learning notes are stored in this browser.");});
$("source").addEventListener("input",()=>{if(!project)return;project.files[active].content=$("source").value;project.lineCount=project.files.reduce((n,f)=>n+f.content.split("\n").length,0);$("lineCount").textContent=project.lineCount;project.review=window.HAxBROCodeWriterLocal.review(project);$("reviewItems").innerHTML=project.review.map(x=>'<div class="review-item"><b>'+esc(x.level.toUpperCase())+'</b><span>'+esc(x.file+" — "+x.message)+'</span></div>').join("");$("reviewState").textContent=project.review.some(x=>x.level==="error")?"ISSUES FOUND":"CHECKS COMPLETE";const h=project.files.find(f=>f.path==="index.html"),c=project.files.find(f=>f.path==="styles.css"),j=project.files.find(f=>f.path==="app.js");if(h){$("previewPanel").hidden=false;const doc=h.content.replace(/<link[^>]+href=["\x27]styles\.css["\x27][^>]*>/i,"<style>"+(c?c.content:"")+"</style>").replace(/<script[^>]+src=["\x27]app\.js["\x27]><\/script>/i,"<script>"+(j?j.content:"")+"</script>");$("preview").srcdoc=doc;}});
$("copyFile").addEventListener("click",async()=>{if(!project)return;try{await navigator.clipboard.writeText(project.files[active].content);status("Copied "+project.files[active].path);}catch(e){status("Clipboard permission unavailable. Select and copy the source from the editor.");}});
$("downloadFile").addEventListener("click",()=>{if(project)download(project.files[active].path.split("/").pop(),project.files[active].content);});
$("downloadZip").addEventListener("click",()=>{if(project){const blob=zip(project.files),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=project.name.toLowerCase().replace(/[^a-z0-9]+/g,"-")+".zip";a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);}});
updateLearning();$("styleWrap").style.display="none";
})();