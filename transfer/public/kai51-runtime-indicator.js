(() => {
  const id='kai51RuntimeHook';
  let el=null;
  const clamp=n=>Math.max(0,Math.min(100,Math.round(Number(n)||0)));
  function mount(){
    if(el)return el;
    el=document.createElement('div');el.id=id;el.setAttribute('aria-live','polite');
    el.innerHTML='<span class="hook-lock">🔒</span><span class="hook-dot"></span><span class="hook-name">KAI 51</span><span class="hook-pct">0%</span><span class="hook-lite">· MODEL LOADING</span>';
    document.body.appendChild(el);return el;
  }
  function render(d={}){
    const state=window.HAxBROKai51Bootstrap?.state?.()||{};
    const modelName=String(state.model||"Qwen3-0.6B").toUpperCase();
    const x=mount();
    if(d.profile==='largest'){
      x.classList.remove('is-ready');
      const pct=x.querySelector('.hook-pct');if(pct)pct.textContent=clamp(d.progress)+'%';
      const lite=x.querySelector('.hook-lite');if(lite)lite.textContent='· '+String(d.status||'QWEN3-0.6B INITIALIZING').toUpperCase();
      return;
    }
    if(state.status==='error'||/failed|error/i.test(String(d.status||''))){
      x.classList.remove('is-ready');
      const p=x.querySelector('.hook-pct');if(p)p.textContent='!';
      const lite=x.querySelector('.hook-lite');if(lite)lite.textContent='· MODEL ERROR · RETRY REQUIRED';
      x.title=String(state.error||d.error||d.status||'Local model initialization failed');
      return;
    }
    if(state.status==='ready'&&state.installed&&state.verified){
      x.classList.add('is-ready');
      const p=x.querySelector('.hook-pct');if(p)p.textContent='100%';
      const lite=x.querySelector('.hook-lite');
      const mode=state.device==='webgpu'?'WEBGPU':'WASM';
      const threading=state.wasmMultiThreadAvailable?(String(state.inferenceThreads||1)+' THREADS'):'SINGLE-THREAD FALLBACK';
      if(lite)lite.textContent='· QWEN3 0.6B · '+mode+' · '+threading;
      x.title='Local Qwen3-0.6B ready. '+mode+' inference. '+threading+'. Cross-origin isolated: '+String(!!state.crossOriginIsolated)+'. SharedArrayBuffer: '+String(!!state.sharedArrayBufferAvailable)+'.';
      return;
    }
    x.classList.remove('is-ready');
    const pct=clamp(d.progress??(state.status==='installing'?5:0));
    const p=x.querySelector('.hook-pct');if(p)p.textContent=pct+'%';
    const lite=x.querySelector('.hook-lite');
    if(lite){
      const stage=String(d.status||'').toLowerCase();
      if(d.profile==='local'){
        lite.textContent='· QWEN LOCAL ENGINE';
      }else if(/download/i.test(stage)){
        lite.textContent='· '+modelName+' DOWNLOADING';
      }else if(state.status==='installing'){
        lite.textContent='· '+modelName+' INITIALIZING';
      }else if(state.status==='ready'){
        lite.textContent='· KAI 51 READY';
      }else{
        lite.textContent='· '+modelName+' · READY WHEN NEEDED';
      }
    }
  }
  window.addEventListener('haxbro:kai-local-progress',e=>render(e.detail||{}));
  window.addEventListener('haxbro:kai51-bootstrap',e=>render(e.detail||{}));
  window.addEventListener('haxbro:kai51-ready',()=>{const x=mount();x.classList.add('is-ready')});
  setTimeout(()=>render(),400);
})();