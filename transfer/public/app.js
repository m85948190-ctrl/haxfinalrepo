import {createKai51Engine} from "/kai51-local-engine.js";

const $=id=>document.getElementById(id);
let engine=null,ready=false,busy=false,lastSources=[];
function toast(s){$("toast").textContent=s;$("toast").classList.add("show");setTimeout(()=>$("toast").classList.remove("show"),2600)}
function showChat(){ $("welcome").hidden=true;$("toolArea").hidden=true;$("chatArea").hidden=false;$("prompt").focus() }
function setStatus(s,ok=false){$("modelStatus").textContent=s;$("modelDot").classList.toggle("ready",ok);$("modelChip").textContent=ok?"Qwen3-0.6B · Ready":"Qwen3-0.6B · Not loaded";$("composerStatus").textContent=ok?"Local model ready. Your prompts stay on this device.":"Web research is available now; install Qwen for local AI chat and synthesis.";$("prompt").disabled=false;$("sendButton").disabled=false}
function progress(p,s){$("progressCard").hidden=false;$("progressPct").textContent=Math.round(p)+"%";$("progressBar").style.width=Math.max(0,Math.min(100,p))+"%";$("progressTitle").textContent=p>=100?"KAI is ready":"Installing KAI";$("progressText").textContent=s}
async function install(){
  if(ready||busy)return;busy=true;$("installButton").disabled=true;$("modelButton").disabled=true;
  try{
    if(!engine)engine=await createKai51Engine({onProgress:x=>progress(x.progress,x.status)});
    await engine.prepare();ready=true;setStatus("Ready on this device",true);$("progressCard").hidden=true;
    $("installButton").textContent="✓ Local model ready";$("installButton").disabled=true;showChat();toast("KAI is ready. Chat runs locally.");
  }catch(e){setStatus("Install failed");toast(String(e.message||e).slice(0,170));$("progressText").textContent=String(e.message||e);$("installButton").disabled=false}
  finally{busy=false;$("modelButton").disabled=false}
}
function addMessage(text,who){
  const row=document.createElement("div");row.className=who==="user"?"user-message":"assistant-message";
  const avatar=document.createElement("div");avatar.className="avatar";avatar.textContent=who==="user"?"Y":"K";
  const body=document.createElement("div");body.className="message-body";
  if(who!=="user"){const b=document.createElement("b");b.textContent="KAI";body.appendChild(b)}
  const p=document.createElement("p");p.textContent=text;body.appendChild(p);row.appendChild(avatar);row.appendChild(body);$("messages").appendChild(row);$("messages").scrollTop=$("messages").scrollHeight;
}
function showSources(sources){
  lastSources=sources||[];const panel=$("sourcePanel");panel.innerHTML="";
  const h=document.createElement("h3");h.textContent="WEB SOURCES · "+lastSources.length+" READABLE PAGES";panel.appendChild(h);
  const list=document.createElement("div");list.className="source-list";
  lastSources.forEach((s,i)=>{const a=document.createElement("a");a.className="source-item";a.href=s.url;a.target="_blank";a.rel="noopener noreferrer";a.textContent=(i+1)+". "+(s.title||s.url);const small=document.createElement("small");small.textContent=(s.engine||"Web")+" · "+s.url;a.appendChild(small);list.appendChild(a)});
  panel.appendChild(list);panel.hidden=!lastSources.length;
}
function needsSearch(q){return /\b(search|web|online|latest|current|today|right now|recent|news|price|weather|who is|what happened|look up|sources|research|202[5-9])\b/i.test(q)}
async function searchWeb(query){
  addMessage("Searching multiple web sources and reading relevant pages first…","assistant");
  const r=await fetch("/api/web-search",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({query})});
  const data=await r.json();if(!r.ok||!data.ok)throw new Error(data.error||"Web search failed.");
  showSources((data.sources||[]).filter(x=>x.readable));
  return data;
}
async function ensureModel(){
  if(ready)return;
  if(!engine)engine=await createKai51Engine({onProgress:x=>progress(x.progress,x.status)});
  await engine.prepare();ready=true;setStatus("Ready on this device",true);
  $("installButton").textContent="✓ Local model ready";$("installButton").disabled=true;
}
async function sendMessage(text){
  if(busy||!text.trim())return;
  const research=needsSearch(text);
  if(!ready&&!research){toast("Download the local Qwen model first, or ask a web-research question.");return}
  busy=true;$("sendButton").disabled=true;$("prompt").disabled=true;addMessage(text,"user");
  try{
    let prompt=text;
    if(research){
      const data=await searchWeb(text);
      const readable=(data.sources||[]).filter(x=>x.readable);
      if(!readable.length)throw new Error("Search returned "+(data.sourceCount||0)+" result(s), but no page text could be read. I won't invent a source-backed answer.");
      const evidence=readable.map((s,i)=>"SOURCE "+(i+1)+": "+s.title+"\nURL: "+s.url+"\nPAGE TEXT: "+s.excerpt).join("\n\n");
      addMessage("I found "+readable.length+" readable source pages. "+(!ready?"Now installing the local Qwen model before synthesis…":"KAI is now evaluating them locally…"),"assistant");
      prompt="Answer the user's question using the retrieved web evidence below. Compare evidence across sources. Cite source numbers in your answer like [1] and [2]. If sources disagree or evidence is insufficient, say so. Do not invent facts.\n\nUSER QUESTION: "+text+"\n\nRETRIEVED WEB EVIDENCE:\n"+evidence;
    }
    if(!ready){await ensureModel();showChat()}
    const answer=await engine.generate(prompt,{maxTokens:/code|python|html|javascript|debug/i.test(text)?260:160});
    addMessage(answer,"assistant");
  }catch(e){addMessage("I couldn't complete that request: "+String(e.message||e),"assistant")}
  finally{busy=false;$("sendButton").disabled=false;$("prompt").disabled=false;$("prompt").focus()}
}
$("installButton").addEventListener("click",install);$("modelButton").addEventListener("click",install);
$("startChat").addEventListener("click",showChat);
$("newChat").addEventListener("click",()=>{$("messages").innerHTML="";showChat();addMessage("New chat started. What are we working on?","assistant")});
$("chatForm").addEventListener("submit",e=>{e.preventDefault();const v=$("prompt").value.trim();if(!v)return;$("prompt").value="";sendMessage(v)});
$("prompt").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();$("chatForm").requestSubmit()}});
$("themeToggle").addEventListener("click",()=>{document.body.classList.toggle("dark");const dark=document.body.classList.contains("dark");$("themeToggle").querySelector("span").textContent=dark?"Switch to light mode":"Switch to dark mode";localStorage.setItem("haxbro-theme",dark?"dark":"light")});
if(localStorage.getItem("haxbro-theme")==="dark"){document.body.classList.add("dark");$("themeToggle").querySelector("span").textContent="Switch to light mode"}
$("menuToggle").addEventListener("click",()=>$("menuToggle").classList.toggle("open"));
document.querySelectorAll(".side-link").forEach(b=>b.addEventListener("click",()=>{
  const p=b.dataset.panel;document.querySelectorAll(".side-link").forEach(x=>x.classList.toggle("active",x===b));
  if(p==="chat"){showChat();return}
  $("welcome").hidden=true;$("chatArea").hidden=true;$("toolArea").hidden=false;
  $("toolTitle").textContent=p==="calculator"?"Calculator":"Web research";$("toolDescription").textContent=p==="calculator"?"Quick arithmetic with parentheses and powers.":"Search multiple web sources and read relevant pages.";
  $("searchForm").hidden=p==="calculator";$("calculator").hidden=p!=="calculator";
}));
$("searchForm").addEventListener("submit",async e=>{
  e.preventDefault();const q=$("searchQuery").value.trim();if(!q)return;
  $("searchResults").textContent="Searching and reading pages…";
  try{const r=await fetch("/api/web-search",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({query:q})});const d=await r.json();if(!r.ok||!d.ok)throw new Error(d.error||"Search failed");
    $("searchResults").innerHTML="";(d.sources||[]).forEach(s=>{const card=document.createElement("article");card.className="search-card";const a=document.createElement("a");a.href=s.url;a.target="_blank";a.rel="noopener noreferrer";a.textContent=s.title||s.url;const p=document.createElement("p");p.textContent=s.readable?s.excerpt:"Page text unavailable: "+s.excerpt;card.append(a,p);$("searchResults").appendChild(card)});
    if(!d.sources?.length)$("searchResults").textContent="No results were returned by the search engines.";
  }catch(e){$("searchResults").textContent=String(e.message||e)}
});
function calculate(input){
  const s=input.replace(/×/g,"*").replace(/÷/g,"/").replace(/\s+/g,"");let i=0;
  function expr(){let v=term();while(s[i]==="+"||s[i]==="-"){const op=s[i++],n=term();v=op==="+"?v+n:v-n}return v}
  function term(){let v=power();while(s[i]==="*"||s[i]==="/"){const op=s[i++],n=power();if(op==="/"&&n===0)throw Error("Division by zero");v=op==="*"?v*n:v/n}return v}
  function power(){let v=atom();if(s[i]==="^"){i++;v=Math.pow(v,power())}return v}
  function atom(){if(s[i]==="+"){i++;return atom()}if(s[i]==="-"){i++;return -atom()}if(s[i]==="("){i++;const v=expr();if(s[i++]!==")")throw Error("Missing closing parenthesis");return v}const m=s.slice(i).match(/^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i);if(!m)throw Error("Invalid expression");i+=m[0].length;return Number(m[0])}
  const result=expr();if(i!==s.length||!Number.isFinite(result))throw Error("Invalid expression");return result;
}
$("calcRun").addEventListener("click",()=>{try{$("calcResult").textContent="= "+calculate($("calcDisplay").value)}catch(e){$("calcResult").textContent=e.message}});
setStatus("Model not installed");