(()=>{
  const video=document.querySelector('.haxbro-landing-ambient-video');
  if(!video)return;
  video.muted=true;
  video.loop=true;
  video.playsInline=true;
  video.preload='auto';
  const play=()=>video.play?.().catch(()=>{});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',play,{once:true});
  else play();
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&video.paused)play();});
})();