(()=> {
"use strict";
const $=id=>document.getElementById(id);
let mode="ask",stage=null,buildFrame=null,searchHost=null,searchObserver=null;
function ensure(){
 const panel=document.querySelector(".chat-panel"); if(!panel)return false;
 document.querySelectorAll(".sidebar .mode-card,#mobileDrawer .mode-card").forEach(n=>n.closest("section")?.remove());
 if($("haxbroModeDock"))return true;
 const head=panel.querySelector(".chat-head"),form=$("chatForm");
 const dock=document.createElement("nav");dock.id="haxbroModeDock";dock.className="haxbro-mode-dock";dock.setAttribute("aria-label","HAxBRO workspace modes");
 dock.innerHTML='<div class="haxbro-mode-capsule" role="tablist" aria-label="Choose workspace"><button type="button" role="tab" data-mode="ask" aria-selected="true" class="active">Ask</button><button type="button" role="tab" data-mode="build" aria-selected="false">Build</button><button type="button" role="tab" data-mode="explore" aria-selected="false">Explore</button><span class="haxbro-capsule-indicator" aria-hidden="true"></span></div>';
 stage=document.createElement("section");stage.id="haxbroModeStage";stage.className="haxbro-mode-stage";stage.hidden=true;
 if(head)head.insertAdjacentElement("afterend",dock);else panel.prepend(dock);
 if(form)form.insertAdjacentElement("beforebegin",stage);else panel.append(stage);
 dock.addEventListener("click",e=>{const b=e.target.closest("button[data-mode]");if(b)switchMode(b.dataset.mode)});
 const buildButtons=["appMakerBtn","mobileAppMakerBtn","shortcutAppMaker","shortcutBuildAI"];
 buildButtons.forEach(id=>$(id)?.addEventListener("click",e=>{e.preventDefault();e.stopImmediatePropagation();switchMode("build")},true));
 buildFrame=document.createElement("iframe");buildFrame.className="haxbro-mode-frame";buildFrame.title="HAxBRO App Maker";buildFrame.src="/app-maker-original/";buildFrame.loading="lazy";buildFrame.setAttribute("allow","clipboard-read; clipboard-write");
 const buildPane=document.createElement("div");buildPane.id="haxbroBuildPane";buildPane.className="haxbro-mode-pane";buildPane.append(buildFrame);
 searchHost=document.createElement("div");searchHost.id="haxbroSearchPane";searchHost.className="haxbro-mode-pane haxbro-search-pane";
 stage.append(buildPane,searchHost);
 buildFrame.addEventListener("load",()=>{try{const d=buildFrame.contentDocument;const a=d.querySelector(".top-right a");if(a)a.remove();d.documentElement.classList.add("haxbro-embedded-maker")}catch{}});
 window.HAxBROUnifiedModes={switchMode,mode:()=>mode,buildFrame};
 return true;
}
/* Explore opens the existing XPro execution workspace; it replaces Search. */
function switchMode(next){
 if(next==="search")next="explore";
 if(!["ask","build","explore"].includes(next))return;
 if(!ensure())return;
 mode=next;
 const panel=document.querySelector(".chat-panel"),dock=$("haxbroModeDock"),stageEl=$("haxbroModeStage"),form=$("chatForm"),hint=panel?.querySelector(".hint"),messages=$("messages"),shortcuts=$("haxCommandShortcuts"),head=panel?.querySelector(".chat-head");
 dock.querySelectorAll("button[data-mode]").forEach(b=>{const active=b.dataset.mode===mode;b.classList.toggle("active",active);b.setAttribute("aria-selected",String(active))});
 dock.dataset.active=mode;
 const showChat=mode==="ask";
 if(messages)messages.hidden=!showChat;
 if(shortcuts)shortcuts.hidden=mode!=="ask";
 if(form){form.hidden=!showChat;form.style.setProperty("display",showChat?"flex":"none","important");form.style.setProperty("position",showChat?"absolute":"static","important");form.style.setProperty("z-index",showChat?"2147483000":"auto","important");}
 if(hint){hint.hidden=!showChat;hint.textContent="Device-optimized local KAI model · Enter to send"}
 if(head)head.hidden=false;
 stageEl.hidden=mode!=="build";
 if(mode!=="explore")window.HAxBROXpro?.close?.();
 panel.classList.toggle("haxbro-mode-build",mode==="build");
 panel.classList.remove("haxbro-mode-search");
 if(mode==="build"){stageEl.dataset.mode="build";$("haxbroBuildPane").hidden=false;searchHost.hidden=true;stageEl.style.display="block";stageEl.style.flex="1 1 auto";stageEl.style.minHeight="0";}
 if(mode==="explore"){
  stageEl.dataset.mode="explore";$("haxbroBuildPane").hidden=true;searchHost.hidden=true;
  const p=$("deepxPanel");if(p){p.style.display="none";document.body.classList.remove("xpro-open")}
  window.HAxBROSearchMode=false;
  if(!window.HAxBROXpro?.open){mode="ask";dock.dataset.active="ask";dock.querySelectorAll("button[data-mode]").forEach(b=>{const active=b.dataset.mode==="ask";b.classList.toggle("active",active);b.setAttribute("aria-selected",String(active))});if(messages)messages.hidden=false;if(form){form.hidden=false;form.style.setProperty("display","flex","important");form.style.setProperty("position","absolute","important");form.style.setProperty("z-index","2147483000","important")}if(hint)hint.hidden=false;try{sessionStorage.setItem("haxbro_workspace_mode","ask")}catch{}}
  else window.HAxBROXpro.open();
 }else{
  const prompt=$("promptInput");if(prompt)prompt.placeholder="Message HAxBRO AI...";
  window.HAxBROSearchMode=false;
 }
 if(mode==="ask"){
  stageEl.dataset.mode="ask";
  const p=$("deepxPanel");if(p){p.style.display="none";document.body.classList.remove("xpro-open")}
 }
 try{sessionStorage.setItem("haxbro_workspace_mode",mode)}catch{}
}
function boot(){if(!ensure())return;let saved="ask";try{saved=sessionStorage.getItem("haxbro_workspace_mode")||"ask"}catch{}switchMode(saved)}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
window.addEventListener("haxbro:open-app-maker",()=>switchMode("build"));
/* XPro is the Explore workspace; Search is no longer a user-facing mode. */
})();