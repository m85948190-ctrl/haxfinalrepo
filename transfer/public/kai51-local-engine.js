const VERSION = "kai51-qwen3-06b-gguf-wllama3-q3km-parallel-v6";
const MODEL = "Qwen3-0.6B";
const MODEL_ID = "Qwen3-0.6B · Q3_K_M GGUF";
const MODEL_URL = "https://huggingface.co/prithivMLmods/Qwen3-0.6B-GGUF/resolve/main/Qwen3_0.6B.Q3_K_M.gguf";
const MODEL_SIZE = 347000000;
const MIN_MODEL_BYTES = 250000000;
const MODEL_CACHE_NAME = "haxbro-kai51-qwen3-06b-cache-v3";
const MODEL_CACHE_KEY = "/__haxbro_model_cache__/qwen3-06b-q3km.gguf";
const WLLAMA_BASE = "https://cdn.jsdelivr.net/npm/@wllama/wllama@3.13.0/esm/";

async function downloadOrRestoreModel(report) {
  // Retire only obsolete HAxBRO model caches and the old Q4 OPFS entry.
  try {
    const oldUrl="https://huggingface.co/prithivMLmods/Qwen3-0.6B-GGUF/resolve/main/Qwen3_0.6B.Q4_K_M.gguf";
    const root=await navigator.storage?.getDirectory?.();
    const dir=await root?.getDirectoryHandle?.("cache");
    if(dir&&globalThis.crypto?.subtle){
      const digest=await crypto.subtle.digest("SHA-1",new TextEncoder().encode(oldUrl));
      const hash=Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,"0")).join("");
      const name=hash+"_"+oldUrl.split("/").pop();
      for(const file of [name,"__metadata__"+name]){try{await dir.removeEntry(file)}catch{}}
    }
  } catch {}
  try {
    const retired=new Set(["haxbro-kai51-qwen3-06b-cache-v1","haxbro-kai51-qwen3-06b-cache-v2","haxbro-kai51-real-model-v2-q4"]);
    const names=await globalThis.caches?.keys?.()||[];
    await Promise.all(names.filter(n=>retired.has(n)).map(n=>caches.delete(n)));
  } catch {}

  let cache=null;
  try {
    const estimate=await navigator.storage?.estimate?.();
    const quota=Number(estimate?.quota)||0, usage=Number(estimate?.usage)||0;
    if(!quota||Math.max(0,quota-usage)>=MODEL_SIZE*1.12) cache=await caches.open(MODEL_CACHE_NAME);
    else report(2,"Low storage headroom · using a resumable session download");
  } catch {}
  const key=new Request(new URL(MODEL_CACHE_KEY,location.origin).href);
  if(cache){
    try{
      const saved=await cache.match(key);
      if(saved){
        const blob=await saved.blob();
        if(blob.size>=MIN_MODEL_BYTES){report(88,"Restored Qwen3 from this device's verified model cache");return blob;}
        await cache.delete(key);
      }
    }catch{}
  }

  // Download several verified byte ranges concurrently. The old one-range-at-a-time
  // loop serialized the entire 332 MiB model and made first-time setup unnecessarily slow.
  // Each range is retried independently, kept in its original position, and never silently skipped.
  const chunkSize=8*1024*1024;
  let totalSize=MODEL_SIZE;
  let loaded=0;
  const chunks=[];
  async function fetchRange(start,end,allowWhole=false){
    let lastError=null;
    for(let attempt=1;attempt<=5;attempt++){
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),90000);
      try{
        const response=await fetch(MODEL_URL,{
          mode:"cors",credentials:"omit",cache:"no-store",
          headers:{Range:"bytes="+start+"-"+end},
          signal:controller.signal
        });
        if(response.status===200&&allowWhole){
          const whole=await response.blob();
          if(whole.size<MIN_MODEL_BYTES)throw new Error("Server returned an incomplete model ("+whole.size+" bytes).");
          return {whole,total:whole.size};
        }
        if(response.status!==206)throw new Error("Model host ignored byte-range request (HTTP "+response.status+").");
        const range=response.headers.get("content-range")||"";
        const match=range.match(/^bytes\s+(\d+)-(\d+)\/(\d+)$/i);
        if(!match||Number(match[1])!==start||Number(match[2])!==end)throw new Error("Model host returned an invalid byte range: "+range);
        const actualTotal=Number(match[3]);
        if(!Number.isSafeInteger(actualTotal)||actualTotal<MIN_MODEL_BYTES)throw new Error("Model host returned an invalid total model size.");
        const part=await response.arrayBuffer();
        if(part.byteLength!==end-start+1)throw new Error("Incomplete model chunk: "+part.byteLength+" of "+(end-start+1)+" bytes.");
        return {part,total:actualTotal};
      }catch(error){
        lastError=error;
        if(attempt<5){
          report(Math.min(86,4+(loaded/Math.max(totalSize,1))*82),"Download interrupted at "+Math.round(loaded/1048576)+" MB · retrying range ("+attempt+"/5)");
          await new Promise(resolve=>setTimeout(resolve,Math.min(5000,500*attempt)));
        }
      }finally{clearTimeout(timer);}
    }
    throw new Error("Qwen3 download could not resume range "+start+"-"+end+": "+String(lastError?.message||lastError||"network error"));
  }
  const firstEnd=Math.min(totalSize-1,chunkSize-1);
  const first=await fetchRange(0,firstEnd,true);
  if(first.whole){
    totalSize=first.total;loaded=first.whole.size;chunks.push(first.whole);
  }else{
    totalSize=first.total;chunks[0]=first.part;loaded=first.part.byteLength;
    report(Math.min(88,4+(loaded/totalSize)*84),"Downloading Qwen3-0.6B · "+Math.round(loaded/1048576)+" / "+Math.ceil(totalSize/1048576)+" MB");
    const count=Math.ceil(totalSize/chunkSize);
    let nextIndex=1;
    const mobile=/Android|iPhone|iPad|iPod/i.test(String(navigator.userAgent||""));
    const concurrency=Math.min(count-1,mobile?2:4);
    const worker=async()=>{
      while(true){
        const index=nextIndex++;
        if(index>=count)return;
        const start=index*chunkSize;
        const end=Math.min(totalSize-1,start+chunkSize-1);
        const result=await fetchRange(start,end,false);
        if(result.total!==totalSize)throw new Error("Model size changed during parallel download.");
        chunks[index]=result.part;
        loaded+=result.part.byteLength;
        report(Math.min(88,4+(loaded/totalSize)*84),"Downloading Qwen3-0.6B · "+Math.round(loaded/1048576)+" / "+Math.ceil(totalSize/1048576)+" MB · "+concurrency+" parallel ranges");
      }
    };
    await Promise.all(Array.from({length:Math.max(1,concurrency)},worker));
  }
  if(loaded<MIN_MODEL_BYTES)throw new Error("Qwen3 model download is incomplete ("+loaded+" bytes).");
  const modelBlob=chunks.length===1&&chunks[0] instanceof Blob?chunks[0]:new Blob(chunks,{type:"application/octet-stream"});
  if(modelBlob.size!==loaded)throw new Error("Qwen3 model assembly size mismatch: "+modelBlob.size+" / "+loaded+" bytes.");
  report(88,"All Qwen3 model chunks verified · preparing local inference");
  if(cache){
    try{await cache.put(key,new Response(modelBlob,{status:200,headers:{"content-type":"application/octet-stream","content-length":String(modelBlob.size)}}));}
    catch{report(88,"Model ready for this session · persistent cache unavailable");}
  }
  return modelBlob;
}

export async function createKai51Engine({onProgress=()=>{},onReady=()=>{}}={}) {
  let runtime = null;
  let loading = null;
  let lastError = null;
  let readyInfo = null;
  let useWebGPU = false;
  const report = (progress,status) => {
    try { onProgress({profile:"local",progress:Math.max(0,Math.min(100,Number(progress)||0)),status:String(status||"Preparing the shared Qwen3 local model"),file:""}); } catch {}
  };
  const ensureActive = signal => {
    if(signal?.aborted) throw new DOMException("Response stopped by user","AbortError");
  };
  const responseText = result => {
    const choice = result?.choices?.[0];
    const content = choice?.message?.content ?? choice?.text;
    const raw = content ?? result?.response ?? result?.text ?? result?.content ?? result?.message ?? result ?? "";
    return String(raw||"").replace(/<\|im_end\|>|<\|im_start\|>assistant/gi,"").replace(/<think>[\s\S]*?<\/think>/gi,"").trim();
  };

  async function prepare() {
    if(runtime && readyInfo) return readyInfo;
    if(loading) return loading;
    loading = (async()=>{
      try {
        try { await globalThis.navigator?.storage?.persist?.(); } catch {}
        report(1,"Loading the current Wllama 3 browser inference runtime");
        const {Wllama} = await import(WLLAMA_BASE+"index.js");
        if(typeof Wllama!=="function") throw new Error("Wllama 3 browser runtime did not load.");
        const wasmPaths = {default:WLLAMA_BASE+"wasm/wllama.wasm"};
        runtime = new Wllama(wasmPaths,{parallelDownloads:2,allowOffline:true});
        report(3,"Checking this device's saved Qwen3-0.6B model cache");
        const cores=Math.max(1,Number(globalThis.navigator?.hardwareConcurrency)||4);
        const crossOriginIsolated=!!globalThis.crossOriginIsolated;
        const sharedArrayBufferAvailable=typeof globalThis.SharedArrayBuffer!=="undefined";
        const wasmMultiThreadAvailable=crossOriginIsolated&&sharedArrayBufferAvailable;
        const ua=String(globalThis.navigator?.userAgent||"");
        const mobileViewport=!!globalThis.matchMedia?.("(max-width: 760px)")?.matches;
        const mobileDevice=/Android|iPhone|iPad|iPod/i.test(ua)||mobileViewport;
        const deviceMemory=Number(globalThis.navigator?.deviceMemory)||0;
        const lowMemoryDevice=mobileDevice||(deviceMemory>0&&deviceMemory<=4);
        const inferenceThreads=lowMemoryDevice?1:(wasmMultiThreadAvailable?Math.max(1,Math.min(6,cores-1)):1);
        useWebGPU=!!runtime.isSupportWebGPU?.();
        const loadOptions={
          n_ctx:lowMemoryDevice?2048:4096,
          n_batch:lowMemoryDevice?16:32,
          n_threads:inferenceThreads,
          n_gpu_layers:useWebGPU?(lowMemoryDevice?8:99):0,
          jinja:true
        };
        let activeContextTokens=loadOptions.n_ctx;
        let modelBlob=await downloadOrRestoreModel(report);
        const loadWeights=(target,options)=>target.loadModel([modelBlob],options);
        report(89,useWebGPU ? "Loading Qwen3 into the WebGPU-accelerated local engine" : "Loading Qwen3 into the local WebAssembly engine");
        try {
          await loadWeights(runtime,loadOptions);
        } catch (gpuError) {
          if(!useWebGPU) throw gpuError;
          const gpuMessage=String(gpuError?.message||gpuError||"WebGPU initialization failed").slice(0,180);
          report(90,"Full WebGPU offload failed ("+gpuMessage+"); retrying with reduced GPU memory use");
          try { await runtime?.exit?.(); } catch {}
          runtime=new Wllama(wasmPaths,{parallelDownloads:2,allowOffline:true});
          try {
            await loadWeights(runtime,{...loadOptions,n_gpu_layers:lowMemoryDevice?4:12});
          } catch (partialGpuError) {
            const partialMessage=String(partialGpuError?.message||partialGpuError||"Reduced WebGPU offload failed").slice(0,140);
            report(91,"Reduced WebGPU offload failed ("+partialMessage+"); retrying with low-memory CPU WebAssembly");
            try { await runtime?.exit?.(); } catch {}
            runtime=new Wllama(wasmPaths,{parallelDownloads:2,allowOffline:true});
            useWebGPU=false;
            try {
              await loadWeights(runtime,{...loadOptions,n_gpu_layers:0,n_ctx:lowMemoryDevice?1536:3072,n_batch:lowMemoryDevice?8:16});
              activeContextTokens=lowMemoryDevice?1536:3072;
            } catch (cpuError) {
              const cpuMessage=String(cpuError?.message||cpuError||"CPU WebAssembly load failed").slice(0,180);
              throw new Error("Qwen3 could not initialize on full WebGPU ("+gpuMessage+"), reduced WebGPU ("+partialMessage+"), or CPU WebAssembly ("+cpuMessage+").");
            }
          }
        }
        // Keep the source Blob until the smoke test passes so a GPU retry can reuse it without another download.
        await new Promise(resolve=>setTimeout(resolve,0));
        const runSmokeTest = async (label) => {
          report(93,"Checking "+label+" with a minimal one-token inference");
          let timer = null;
          try {
            const result = await Promise.race([
              runtime.createCompletion({
                prompt:"The next letter after Q is",
                max_tokens:2,
                temperature:0,
                top_k:1,
                top_p:1
              }),
              new Promise((_,reject) => {
                timer = setTimeout(() => reject(new Error(label+" loaded the weights but its inference worker did not answer within 45 seconds.")),45000);
              })
            ]);
            if(!result || !Array.isArray(result.choices)) throw new Error(label+" inference worker returned an invalid completion response.");
            return responseText(result) || "inference-ok";
          } catch(error) {
            try { await runtime?.interrupt?.(); } catch {}
            throw error;
          } finally {
            clearTimeout(timer);
          }
        };
        await new Promise(resolve=>setTimeout(resolve,0));
        let selfTest="";
        try {
          selfTest=await runSmokeTest(useWebGPU?"full-WebGPU Qwen3":"CPU/WebAssembly Qwen3");
        } catch(fullInferenceError) {
          if(!useWebGPU) throw fullInferenceError;
          const fullMessage=String(fullInferenceError?.message||fullInferenceError).slice(0,180);
          report(94,"Full WebGPU loaded the model but failed its first inference; retrying reduced GPU offload");
          try { await runtime?.exit?.(); } catch {}
          runtime=null;
          runtime=new Wllama(wasmPaths,{parallelDownloads:2,allowOffline:true});
          try {
            await loadWeights(runtime,{...loadOptions,n_gpu_layers:lowMemoryDevice?4:12});
            await new Promise(resolve=>setTimeout(resolve,0));
            useWebGPU=true;
            selfTest=await runSmokeTest("reduced-WebGPU Qwen3");
          } catch(partialInferenceError) {
            const partialMessage=String(partialInferenceError?.message||partialInferenceError).slice(0,180);
            try { await runtime?.exit?.(); } catch {}
            runtime=null;
            await new Promise(resolve=>setTimeout(resolve,0));
            report(95,"Reduced WebGPU inference failed; reopening the cached Qwen3 model for CPU/WebAssembly fallback");
            runtime=new Wllama(wasmPaths,{parallelDownloads:2,allowOffline:true});
            useWebGPU=false;
            try {
              await loadWeights(runtime,{...loadOptions,n_gpu_layers:0,n_ctx:lowMemoryDevice?1536:3072,n_batch:lowMemoryDevice?8:16});
              activeContextTokens=lowMemoryDevice?1536:3072;
              await new Promise(resolve=>setTimeout(resolve,0));
              selfTest=await runSmokeTest("CPU/WebAssembly fallback");
            } catch(cpuInferenceError) {
              const cpuMessage=String(cpuInferenceError?.message||cpuInferenceError).slice(0,180);
              throw new Error("Qwen3 loaded but first inference failed on full WebGPU ("+fullMessage+"), reduced WebGPU ("+partialMessage+"), and CPU/WebAssembly ("+cpuMessage+").");
            }
          }
        }
        modelBlob=null;
        await new Promise(resolve=>setTimeout(resolve,0));
        readyInfo={ok:true,model:MODEL,modelId:MODEL_ID,device:useWebGPU?"webgpu":"wasm",verified:true,realModel:true,localModel:true,lane:"qwen3-06b",quantization:"Q3_K_M",contextTokens:activeContextTokens,selfTest,hardwareConcurrency:cores,crossOriginIsolated,sharedArrayBufferAvailable,wasmMultiThreadAvailable,inferenceThreads};
        lastError=null;
        report(100,"Qwen3-0.6B is ready locally · "+(useWebGPU?"WebGPU active":"WebAssembly CPU mode")+" · "+(wasmMultiThreadAvailable?inferenceThreads+" WASM threads available":"single-thread WASM fallback · browser isolation headers unavailable"));
        try { onReady(readyInfo); } catch {}
        return readyInfo;
      } catch(error) {
        lastError=String(error?.message||error).slice(0,700);
        try { await runtime?.exit?.(); } catch {}
        runtime=null; readyInfo=null;
        report(0,"Qwen3 initialization failed: "+lastError.slice(0,150));
        throw new Error(lastError);
      } finally { loading=null; }
    })();
    return loading;
  }

  async function generate(prompt,history=[],options={}) {
    ensureActive(options.signal);
    await prepare();
    ensureActive(options.signal);
    const directPrompt=String(prompt||"").trim();
    if(!directPrompt) throw new Error(MODEL+" received an empty prompt.");
    const controller=new AbortController();
    const abort=()=>{try{controller.abort();}catch{}try{runtime?.interrupt?.();}catch{}};
    options.signal?.addEventListener?.("abort",abort,{once:true});
    if(options.signal?.aborted)abort();
    let timer;
    let generatedTokensEstimate=0;
    let generatedChars=0;
    const generationStartedAt=Date.now();
    const userText=directPrompt.split(/\nUSER:\s*/i).pop().trim();
    // Greetings use the same neural generation path as every other chat turn.
    const isCoding=/\b(?:code|coding|program|script|function|class|debug|html|css|javascript|python|typescript|sql|api)\b/i.test(userText);
    const requestedBudget=Number(options.maxTokens);
    const contextTokens=Number(readyInfo?.contextTokens)||1024;
    const promptTokens=Math.ceil(new TextEncoder().encode(directPrompt).length/3.5);
    const contextOutputLimit=Math.max(128,contextTokens-promptTokens-320);
    const tokenBudget=Number.isFinite(requestedBudget)&&requestedBudget>0
      ? Math.min(3072,contextOutputLimit,Math.max(16,Math.floor(requestedBudget)))
      : Math.min(isCoding?2048:420,contextOutputLimit);
    try {
      const work=(async()=>{
        const stream=await runtime.createChatCompletion({
          messages:[
            {role:"system",content:"You are KAI 51, HAxBRO AI's natural conversational assistant. HAxBRO was created by Mainak Kuila, a 14-year-old independent developer. If asked who made or created HAxBRO or you, answer directly: Mainak Kuila, a 14-year-old developer. For casual messages such as just talking, chatting, greetings or how are you, respond warmly and naturally; do not search the web. Answer the exact latest message in context. Never repeat a generic greeting such as 'Hello! What can I do for you today?' on every turn. Do not greet again when the conversation is already underway. Interpret short follow-ups such as 'ok what?' and 'what?' using the recent conversation. If the user says nothing, never mind or asks you to leave, acknowledge it once without pushing; if they speak again, resume from that context. Vary phrasing naturally and avoid repeating recent assistant replies. For coding tasks, provide complete, correct, runnable code with concise explanation. If the user names a programming language, you MUST use that exact language and never substitute Python or another language. For comparisons, evaluate clear criteria. Never invent sources, facts, or actions. Never refuse ordinary harmless questions."},
            {role:"user",content:directPrompt}
          ],
          max_tokens:tokenBudget,
          temperature:options.temperature??0.35,
          top_k:20,
          top_p:options.topP??0.8,
          penalty_repeat:options.repPenalty??1.08,
          abortSignal:controller.signal,
          chat_template_kwargs:{enable_thinking:false},
          stream:true
        });
        let response="";
        for await (const chunk of stream) {
          ensureActive(options.signal);
          const delta=String(chunk?.choices?.[0]?.delta?.content||"");
          if(!delta)continue;
          response+=delta;
          generatedChars=response.length;
          // Wllama emits text chunks, not one callback per tokenizer token.
          // Estimate tokens from UTF-8 text length so progress/rate is meaningful.
          generatedTokensEstimate=Math.max(1,Math.ceil(new TextEncoder().encode(response).length/4));
          try{options.onToken?.(delta,response,generatedTokensEstimate);}catch{}
        }
        return response;
      })();
      const requestedTimeoutMs=Number(options.timeoutMs);
      const timeoutMs=Number.isFinite(requestedTimeoutMs)&&requestedTimeoutMs>0?Math.max(15000,Math.min(1800000,requestedTimeoutMs)):0;
      const timeout=timeoutMs?new Promise((_,reject)=>{timer=setTimeout(()=>{abort();const elapsed=Math.max(1,Math.round((Date.now()-generationStartedAt)/1000));reject(new Error(MODEL+" generation timed out after "+Math.round(timeoutMs/60000)+" minutes. The local model emitted approximately "+generatedTokensEstimate+" tokens / "+generatedChars+" characters in "+elapsed+" seconds before timeout."));},timeoutMs);}):null;
      const result=timeout?await Promise.race([work,timeout]):await work;
      ensureActive(options.signal);
      const response=typeof result==="string"?responseText({response:result}):responseText(result);
      if(!response) throw new Error(MODEL+" returned an empty response from local inference.");
      return {response,tokens:generatedTokensEstimate,tokenBudget,contextTokens:Number(readyInfo?.contextTokens)||1024,durationMs:Date.now()-generationStartedAt,provider:MODEL+" · local Wllama 3 "+(useWebGPU?"WebGPU":"WebAssembly")+" inference",model:MODEL,modelId:MODEL_ID,device:useWebGPU?"webgpu":"wasm",local:true,localModel:true,lane:"qwen3-06b",quantization:"Q3_K_M"};
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener?.("abort",abort);
    }
  }

  return {
    version:VERSION,get model(){return MODEL;},modelId:MODEL_ID,prepare,generate,chat:generate,
    isReady:()=>!!runtime&&!!readyInfo,
    status:()=>({ready:!!runtime&&!!readyInfo,model:MODEL,modelId:MODEL_ID,device:useWebGPU?"webgpu":"wasm",local:true,quantization:"Q3_K_M",error:lastError,hardwareConcurrency:readyInfo?.hardwareConcurrency??(Number(globalThis.navigator?.hardwareConcurrency)||1),crossOriginIsolated:readyInfo?.crossOriginIsolated??!!globalThis.crossOriginIsolated,sharedArrayBufferAvailable:readyInfo?.sharedArrayBufferAvailable??(typeof globalThis.SharedArrayBuffer!=="undefined"),wasmMultiThreadAvailable:readyInfo?.wasmMultiThreadAvailable??false,inferenceThreads:readyInfo?.inferenceThreads??1}),
    dispose:async()=>{try{await runtime?.exit?.();}catch{}runtime=null;readyInfo=null;}
  };
}