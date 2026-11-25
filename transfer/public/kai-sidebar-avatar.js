(()=> {
  if(window.__HAxBRO_KAI_VIDEO_STATES_V1__) return;
  window.__HAxBRO_KAI_VIDEO_STATES_V1__ = true;

  const clips = {
    thinking: "/kai-videos/thinking.mp4",
    searching: "/kai-videos/searching.mp4",
    typing: "/kai-videos/typing.mp4",
    idle: "/kai-videos/idle.mp4"
  };
  const markup = '<section class="kai-companion kai-workstation" data-state="idle" aria-label="KAI robot video workstation">' +
    '<div class="kai-workstation-top"><div><span class="kai-workstation-mark">KAI <b>51</b></span><span class="kai-workstation-sub">INTELLIGENCE WORKSTATION</span></div><span class="kai-workstation-live"><i></i> SYSTEM ONLINE</span></div>' +
    '<div class="kai-workstation-stage"><video class="kai-workstation-video" muted loop playsinline autoplay preload="metadata" aria-label="KAI robot activity video"></video><div class="kai-workstation-hud"><span class="kai-hud-dot"></span><span>KAI // LIVE SESSION</span><span class="kai-hud-right">LOCAL · QWEN3</span></div></div>' +
    '<div class="kai-workstation-status"><span class="kai-workstation-action" aria-live="polite">READY TO WORK</span><span class="kai-workstation-detail">WORKSTATION · STANDBY</span></div>' +
    '<div class="kai-workstation-credit">Robot footage: <a href="https://pikwizard.com/" target="_blank" rel="noopener">PikWizard</a> · <a href="https://stockcake.com/" target="_blank" rel="noopener">StockCake</a></div>' +
    '</section>';

  const mounts = ["kaiSidebarAvatarMount","kaiSidebarAvatarMobileMount"].map(id=>document.getElementById(id)).filter(Boolean);
  mounts.forEach(m=>{
    m.innerHTML=markup;
    const history=m.parentElement?.querySelector(".history");
    if(history&&history!==m.nextElementSibling)m.after(history);
  });

  const desktop=document.getElementById("kaiSidebarAvatarMount");
  if(desktop){
    const plus=document.getElementById("clearBtn");
    if(plus){plus.title="New conversation";plus.setAttribute("aria-label","New conversation");plus.textContent="+ New";}
  }
  const mobileHistory=document.getElementById("mobileChatHistory")?.closest(".history");
  const mobileNew=document.getElementById("mobileNewChatBtn");
  if(mobileHistory&&mobileNew){
    const head=mobileHistory.querySelector(".history-head");
    if(head){mobileNew.classList.add("kai-mobile-new-chat");head.appendChild(mobileNew);mobileNew.textContent="+ New conversation";}
  }

  const labels={
    idle:["READY TO WORK","WORKSTATION · STANDBY"],
    thinking:["THINKING","KAI · REASONING"],
    searching:["SEARCHING THE WEB","KAI · LIVE SEARCH"],
    reading:["READING SOURCES","KAI · SOURCE REVIEW"],
    coding:["WRITING CODE","KAI · CODE MODE"],
    building:["BUILDING YOUR APP","KAI · BUILDER"],
    completed:["TASK COMPLETED","KAI · SUCCESS"],
    error:["NEEDS ATTENTION","KAI · DIAGNOSTICS"],
    answering:["ANSWERING YOU","KAI · RESPONSE"]
  };
  const clipForState={idle:"idle",thinking:"thinking",searching:"searching",reading:"searching",coding:"typing",building:"typing",completed:"idle",error:"thinking",answering:"idle"};
  const reduced=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  function setClip(section,key){
    const video=section.querySelector(".kai-workstation-video");
    if(!video)return;
    const clip=clipForState[key]||"thinking";
    const next=clips[clip];
    if(video.dataset.clip!==clip){
      video.pause();
      video.dataset.clip=clip;
      video.src=next;
      video.load();
    }
    if(reduced){video.pause();return;}
    if(section.dataset.visible!=="false"){
      const play=video.play();
      if(play&&typeof play.catch==="function")play.catch(()=>{});
    }
  }
  function state(next,detail){
    const key=labels[next]?next:"thinking";
    document.querySelectorAll(".kai-workstation").forEach(el=>{
      el.dataset.state=key;
      const a=el.querySelector(".kai-workstation-action"),d=el.querySelector(".kai-workstation-detail");
      if(a)a.textContent=labels[key][0];
      if(d)d.textContent=detail?String(detail).slice(0,36):labels[key][1];
      setClip(el,key);
    });
  }
  function classify(label,detail){
    const s=(String(label||"")+" "+String(detail||"")).toLowerCase();
    if(/error|failed|timeout|needs attention/.test(s))return "error";
    if(/complete|finished|answer ready|success|stopped/.test(s))return "completed";
    if(/search|web results|browser|google|bing|wikipedia/.test(s))return "searching";
    if(/read|source|evidence|research|retriev|website|page/.test(s))return "reading";
    if(/build|app maker|architect|preview|publish|deploy/.test(s))return "building";
    if(/code|program|script|html|css|python|javascript|generat/.test(s))return "coding";
    if(/think|reason|interpret|understand|model|analyz|compos/.test(s))return "thinking";
    return "answering";
  }

  document.querySelectorAll(".kai-workstation").forEach(section=>{
    const video=section.querySelector(".kai-workstation-video");
    if(!video)return;
    section.dataset.visible="false";
    video.src=clips.idle;
    video.dataset.clip="idle";
    video.load();
    if("IntersectionObserver" in window){
      const observer=new IntersectionObserver(entries=>{
        entries.forEach(entry=>{
          const visible=entry.isIntersecting&&entry.intersectionRatio>.05;
          section.dataset.visible=visible?"true":"false";
          const v=section.querySelector(".kai-workstation-video");
          if(!v)return;
          if(visible&&!reduced){const p=v.play();if(p&&p.catch)p.catch(()=>{});}
          else v.pause();
        });
      },{threshold:.05});
      observer.observe(section);
    }else{
      section.dataset.visible="true";
      if(!reduced){const p=video.play();if(p&&p.catch)p.catch(()=>{});}
    }
  });

  const oldStep=window.kaiActivityStep;
  if(typeof oldStep==="function")window.kaiActivityStep=function(key,label,detail,iconUrl,status){
    if(status==="running")state(classify(label,detail),label);
    else if(status==="error")state("error",label);
    return oldStep.apply(this,arguments);
  };
  const oldStart=window.kaiActivityStart;
  if(typeof oldStart==="function")window.kaiActivityStart=function(){
    state("thinking","KAI is preparing");return oldStart.apply(this,arguments);
  };
  const oldFinish=window.kaiActivityFinish;
  if(typeof oldFinish==="function")window.kaiActivityFinish=function(payload){
    state(payload?.error?"error":"completed",payload?.error?"Check the model status":"Answer ready");
    return oldFinish.apply(this,arguments);
  };
  const oldCancel=window.cancelChatResponse;
  if(typeof oldCancel==="function")window.cancelChatResponse=function(){
    state("idle","Stopped");return oldCancel.apply(this,arguments);
  };

  const send=document.getElementById("sendBtn");
  if(send)new MutationObserver(()=>{
    if(send.classList.contains("busy")||send.classList.contains("stop-mode")){
      if(document.querySelector('.kai-workstation[data-state="idle"]'))state("thinking","KAI is working");
    }
  }).observe(send,{attributes:true,attributeFilter:["class","aria-busy"]});

  document.addEventListener("visibilitychange",()=>{
    document.querySelectorAll(".kai-workstation").forEach(section=>{
      const video=section.querySelector(".kai-workstation-video");
      if(!video)return;
      if(document.hidden)video.pause();
      else if(section.dataset.visible!=="false"&&!reduced){const p=video.play();if(p&&p.catch)p.catch(()=>{});}
    });
  });
  document.addEventListener("click",e=>{
    if(e.target.closest("#clearBtn,#mobileNewChatBtn"))state("idle","New session");
  });
})();