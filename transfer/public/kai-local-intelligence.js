(() => {
  /* KAI 51 LOCAL: fast evidence retrieval + neural conversation.
     This file routes and gathers evidence; it must not fabricate a response from phrase rules. */
  const VERSION='kai51-local-evidence-synthesis-v21-context-aware-research';
  const clean=(v,n=9000)=>String(v??'').replace(/\u0000/g,'').trim().slice(0,n);
  const words=s=>clean(s,5000).toLowerCase().split(/\s+/).filter(Boolean);

  function queryFor(message,history=[]){
    const evidenceFollowup=/\b(?:how do you know|how can you tell|what is your evidence|what's your evidence|where did you get that|where did that come from|sources? for that|prove (?:it|that)|back that up|verify that claim)\b/i.test(clean(message,1000));
    let original=clean(message);
    if(evidenceFollowup&&Array.isArray(history)){
      const prior=history.slice(0,-1).reverse().find(item=>{
        const role=String(item?.who||item?.role||item?.sender||'').toLowerCase();
        const content=String(item?.text||item?.content||item?.message||'').trim();
        return /^(?:user|human)$/.test(role)&&content&&content.toLowerCase()!==clean(message,1000).toLowerCase();
      });
      if(prior)original=clean(prior.text||prior.content||prior.message,1000);
    }
    original=original.replace(/^\s*(?:ok(?:ay)?\s+)?(?:serch|seach|search)\s+(?:the\s+)?web\s*(?:and\s+)?/i,'');
    let q=original
      .replace(/^\s*(?:please\s+)?(?:can you|could you|would you|tell me|explain|help me)\s+/i,'')
      .replace(/^\s*(?:that\s+)?(?:is|whether)\s+/i,'')
      .replace(/^\s*(?:what causes|what caused|what makes|what made|what is|what are|who is|who are|where is|where are|when did|when was|why does|why do|why is|why are|how does|how do|how is|how are)\s+/i,'')
      .replace(/\s+(?:and\s+)?(?:why|how)\s+(?:do|does|did|is|are|can|could|would|will)\s+(?:he|she|it|they|we|you|plants|batteries|the|this|that)\b[\s\S]*$/i,' ')
      .replace(/\b(?:explain it simply|explain simply|in simple terms|in simple words|briefly|please)\b/ig,' ')
      .replace(/^\s*(?:the\s+)?(?:current|latest|recent)\s+/i,'')
      .replace(/^\s*(?:the|a|an)\s+/i,'')
      .replace(/\b(?:give|provide|include|cite|list|show)\s+(?:me\s+)?(?:a\s+)?(?:(?:short|brief|accurate|concise|detailed|simple)\s+){0,3}(?:answer|summary|response|sources?|citations?|references?)\b.*$/i,' ')
      .replace(/[?!.]+$/,'').replace(/\s+/g,' ').trim();
    if(/\bnorthern lights\b/i.test(original)&&/\b(cause|causes|why|colour|colours|color|colors|solar|atmosphere)\b/i.test(original)) q=q.replace(/\bnorthern lights\b/ig,'aurora borealis');
    if(/\blithium[- ]ion batteries?\b/i.test(original)&&/\b(degrade|degrades|degrading|degradation|aging|ageing|capacity fade)\b/i.test(original)){
      q=q.replace(/\blithium[- ]ion batteries?\b/ig,'lithium-ion battery').replace(/\b(?:degrade|degrades|degrading|degradation|capacity fade)\b/ig,'aging').replace(/\bover time\b/ig,'');
    }
    return q.replace(/\s+/g,' ').trim().slice(0,700);
  }

  const STOP_WORDS=new Set('a an the is are was were be been being do does did how what who where when why which can could would should please tell explain simply simple terms words about for from into with that this these those it its of on in to by and or current latest today now me my you your we they them their as according'.split(' '));

  // KAI user memory is user-controlled and browser-local; no memory is sent to a model provider.
  const memoryKey=()=>{let who='anonymous-device';try{who=localStorage.getItem('haxbro_username')||localStorage.getItem('haxbro:user-id')||who;}catch{}return 'haxbro:kai51:user-memory:v1:'+String(who).replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,100);};
  function readUserMemory(){try{const x=JSON.parse(localStorage.getItem(memoryKey())||'{"items":[]}');return {items:Array.isArray(x.items)?x.items.filter(i=>i&&typeof i.text==='string').slice(-80):[]};}catch{return {items:[]};}}
  function writeUserMemory(m){try{localStorage.setItem(memoryKey(),JSON.stringify({version:1,items:(m.items||[]).slice(-80)}));return true;}catch{return false;}}
  function rememberUser(text,source='explicit'){const value=clean(text,400).replace(/\s+/g,' ').trim();if(!value||value.length<3||/password|passcode|api[_ -]?key|secret|recovery code|one[- ]time code|credit card|cvv|private key/i.test(value))return false;const m=readUserMemory();const key=value.toLowerCase();const existing=m.items.findIndex(i=>i.text.toLowerCase()===key);const item={text:value,source,updatedAt:new Date().toISOString()};if(existing>=0)m.items.splice(existing,1);m.items.push(item);return writeUserMemory(m);}
  function forgetUserMemory(query=''){const q=clean(query,300).toLowerCase();if(!q){const ok=writeUserMemory({items:[]});return {ok,removed:'all'};}const m=readUserMemory(),before=m.items.length;m.items=m.items.filter(i=>!i.text.toLowerCase().includes(q));writeUserMemory(m);return {ok:true,removed:before-m.items.length};}
  function memoryCommand(message){const t=clean(message,800);let m=t.match(/^\s*(?:please\s+)?remember(?:\s+that)?\s*[:,-]?\s*(.+)$/i);if(m){const ok=rememberUser(m[1],'explicit');return {type:'remember',ok,text:clean(m[1],400)};}m=t.match(/^\s*(?:please\s+)?forget(?:\s+(?:that|about))?\s+(.+)$/i);if(m)return {type:'forget',...forgetUserMemory(m[1])};if(/^\s*(?:forget everything|forget all my memories|clear (?:my )?memory)\s*[.!]?\s*$/i.test(t))return {type:'forget',...forgetUserMemory()};return null;}
  function learnStatedPreference(message){const t=clean(message,700);const patterns=[/\bmy name is ([^.!?]{1,80})/i,/\bcall me ([^.!?]{1,80})/i,/\bi prefer ([^.!?]{1,180})/i,/\bi like ([^.!?]{1,160})/i,/\bi am building ([^.!?]{1,160})/i,/\bi'm building ([^.!?]{1,160})/i,/\bI work on ([^.!?]{1,160})/i];for(const re of patterns){const m=t.match(re);if(m){rememberUser(m[0],'stated-preference');break;}}}
  function userMemoryPrompt(){const items=readUserMemory().items;if(!items.length)return '';return 'USER MEMORY (persistent on this browser profile; treat as helpful context, not unquestionable truth):\n'+items.slice(-20).map(i=>'- '+i.text).join('\n')+'\nUse this naturally when relevant. Do not claim to remember anything absent from this list.\n\n';}
  let trainingPackPromise=null;
  function trainingContextPrompt(message=''){
    if(!trainingPackPromise){
      trainingPackPromise=(async()=>{
        let pack=null;try{const response=await fetch('/api/kai-training-sync',{headers:{Accept:'application/json'},cache:'no-store'});if(response.ok){const data=await response.json();if(data?.ok&&Array.isArray(data.rules)){pack={version:data.pack?.version||0,checksum:data.pack?.checksum||'',rules:data.rules,examples:Array.isArray(data.examples)?data.examples:[]};try{localStorage.setItem('haxbro:kai51:training-pack:v1',JSON.stringify(pack));}catch{}}}}catch{}
        if(pack)return pack;
        try{const cached=JSON.parse(localStorage.getItem('haxbro:kai51:training-pack:v1')||'null');if(cached&&Array.isArray(cached.rules))return cached;}catch{}
        return null;
      })();
    }
    return trainingPackPromise.then(pack=>{
      if(!pack)return '';
      const t=clean(message,1200),coding=/\b(code|coding|program|programming|script|debug|function|class|javascript|typescript|python|html|css|sql|api|react|node|algorithm)\b/i.test(t),app=/\b(app|application|app maker|build an app|modify this app|publish|export)\b/i.test(t);
      const rules=pack.rules.filter(x=>x&&typeof x.rule==='string'&&(x.capability==='general'||(coding&&x.capability==='code')||(app&&x.capability==='app-maker'))).slice(0,36);
      const examples=pack.examples.filter(x=>x&&typeof x.response_contract==='string'&&(x.capability==='general'||(coding&&x.capability==='code')||(app&&x.capability==='app-maker'))).slice(0,5);
      const ruleText=rules.map(x=>'- ['+String(x.capability||'general')+'] '+clean(x.rule,420)).join('\n');
      const exampleText=examples.map(x=>'- Situation: '+clean(x.prompt,220)+'\n  Contract: '+clean(x.response_contract,360)).join('\n');
      return 'ACTIVE HAxBRO KAI BEHAVIOR PACK v'+pack.version+' (checksum '+clean(pack.checksum,100)+')\nThese are response-quality and tool-use guidelines, not canned answers. Compose every reply from the current request and conversation; never output a fixed template just because a rule matches.\n'+ruleText+(exampleText?'\nILLUSTRATIVE RESPONSE CONTRACTS:\n'+exampleText:'')+'\n\n';
    });
  }
  // Conversational memory recall is handled by the neural model using userMemoryPrompt().
  // Source extraction is not a final answer: the retrieved evidence always goes to the neural synthesizer.

  function isEvidenceFollowup(message){return /\b(?:how do you know|how can you tell|what is your evidence|what's your evidence|where did you get that|where did that come from|sources? for that|prove (?:it|that)|back that up|verify that claim)\b/i.test(clean(message,1200));}

  function isConversationalFollowup(message,history=[]){
    const t=clean(message,1200).toLowerCase();
    if(/\b(?:why are you asking me|why did you ask me|why do you keep asking|why are you repeating|what did i just say|i just said|you just asked|you asked me|your last answer|your previous answer|what do you mean by that|why did you say that|that doesn't answer|you ignored what i said)\b/i.test(t)) return true;
    const recent=Array.isArray(history)?history.slice(-4):[];
    const hasRecentAssistant=recent.some(x=>/^(?:bot|assistant|ai|model)$/i.test(String(x?.who||x?.role||x?.sender||'')));
    const refersBack=/\b(?:you|your|that|this|it|same|again|already|just said|last reply|previous reply)\b/i.test(t);
    const explicitResearch=/\b(?:search|research|look up|latest|recent|today|news|price|weather|current|official source|verify online|find sources)\b/i.test(t);
    return hasRecentAssistant && refersBack && !explicitResearch && t.split(/\s+/).length<=22;
  }

  function shouldSearch(message,history=[]){
    const t=clean(message).toLowerCase();
    // Evidence challenges must retrieve the topic discussed in the previous turn.
    if(isEvidenceFollowup(t)) return true;
    // Emotional reactions to the last reply are conversation, not search queries.
    if(/^(?:what the hell|wtf|why bro|what the hell why bro|why the hell)[!? .]*$/i.test(t)&&Array.isArray(history)&&history.length>1) return false;
    // Conversational references belong to the ongoing dialogue, not the web-search lane.
    if(isConversationalFollowup(t,history)) return false;
    if(/^\s*(?:please\s+)?(?:remember|forget)\b/i.test(t)) return false;
    if(/\b(?:write|draft|rewrite|polish|translate|summarize|format|generate|create|compose|brainstorm)\b/i.test(t) && !/\b(?:latest|current|today|recent|news|price|statistics|research|verify|sources?)\b/i.test(t)) return false;
    if(/^(?:hi|hello|hey|yo|good morning|good afternoon|good evening|thanks|thank you|thx|ok|okay|sure|yes|yeah|yep|no|nah|got it)[!. ]*$/i.test(t)) return false;
    if(/^(?:how are you|what'?s up|what are you doing|are you there|who are you|what(?:'s| is) your name|what can you do|what do you think|can we talk|let'?s talk|can you help me)[?.! ]*$/i.test(t)) return false;
    if(/\b(?:what do you remember about me|what answer style do i prefer|my name is|call me|i prefer|i like|i feel|i'm bored|i am bored|rough day|bad day|need someone to talk)\b/i.test(t)) return false;
    return /\b(?:explain|define|compare|comparison|contrast|versus|vs\.?|better(?: than| or)?|worse(?: than)?|which is better|pros and cons|analy[sz]e|investigate|research|look up|find out|verify|check|search|serch|seach|wikipedia|web\s?page|webpage|tell me about|teach me|describe|overview|latest|recent|today|news|price|cost|version|release|update|current|weather|according to|statistics|study|paper|official|history|fact|facts|population|capital|meaning|evidence|source|what is|what are|what causes|causes|who is|who are|where is|where are|when did|when was|why did|why does|why do|why is|why are|how to|how can|how does|how do|how is|how are)\b/i.test(t);
  }

  async function searchWeb(query,mode='fast',signal){
    const username=(localStorage.getItem('haxbro_username')||'anonymous-device').trim().slice(0,64);
    const r=await fetch('/api/kai/search',{method:'POST',headers:{'Content-Type':'application/json'},signal,body:JSON.stringify({query,mode:mode==='deep'?'deep':'fast'})});
    const d=await r.json().catch(()=>({}));
    if(!r.ok||!d.ok) throw new Error(d.error||'Google/Bing/DuckDuckGo search unavailable');
    const sources=(d.sources||[]).filter(x=>x.text).map(x=>({
      title:x.title||x.engine||'Web page',
      url:x.url||'',
      text:clean(x.text,4200),
      engine:x.engine||d.engine||'Web search',
      readStatus:x.readStatus||'retrieved'
    }));
    if(!sources.length) throw new Error('Search returned no readable page content');
    return {ok:true,engine:d.engine||'Google + Bing + DuckDuckGo + Wikipedia',sources,engines:d.engines||[],links:sources.map(({title,url,engine})=>({title,url,engine}))};
  }

  async function searchFast(query,signal,searchMode='normal'){
    const mode=searchMode==='deep'?'deep':'fast';
    // The single server research endpoint already combines Google/Bing/DDG,
    // Wikipedia article extraction, and readable result-page extraction.
    // Do not launch a second client-side Wikipedia search for the same question.
    const deadlineMs=mode==='deep'?28000:19000;
    const deadline=new Promise(resolve=>setTimeout(()=>resolve({web:null,wiki:[]}),deadlineMs));
    const retrieval=searchWeb(query,mode,signal).then(web=>({web,wiki:[]}));
    return Promise.race([retrieval,deadline]);
  }

  async function searchKnowledge(query,signal){
    try{
      const r=await fetch('/api/knowledge/search?q='+encodeURIComponent(query),{cache:'no-store',signal});
      const d=await r.json().catch(()=>({}));
      return r.ok&&Array.isArray(d.results)?d.results:[];
    }catch{return []}
  }

  function calculateExpression(message){
    const raw=String(message||'');
    // ISO-like dates are not arithmetic expressions (e.g. 2011-06-28).
    if(/\b(?:19|20)\d{2}[-/]\d{1,2}[-/]\d{1,2}\b/.test(raw)) return null;
    const number='[+-]?\\d[\\d,]*(?:\\.\\d+)?';
    const percent=raw.match(new RegExp('('+number+')\\s*(?:percent|%)\\s*of\\s*('+number+')','i'));
    if(percent){const a=Number(percent[1].replace(/,/g,'')),b=Number(percent[2].replace(/,/g,'')),result=a*b/100;if(Number.isFinite(result))return {expression:a+'% of '+b,result};}
    const natural=raw.match(new RegExp('(?:what\\s+is|calculate|compute|work\\s+out)?\\s*('+number+')\\s*(times|multiplied\\s+by|plus|added\\s+to|minus|subtracted\\s+by|divided\\s+by|over|to\\s+the\\s+power\\s+of|[x×])\\s*('+number+')','i'));
    if(natural){
      const a=natural[1].replace(/,/g,''),opText=natural[2].toLowerCase(),b=natural[3].replace(/,/g,'');
      const op=/^(?:times|multiplied by|x|×)$/.test(opText)?'*':/^(?:plus|added to)$/.test(opText)?'+':opText==='minus'||opText==='subtracted by'?'-':opText==='divided by'||opText==='over'?'/':'^';
      const expression=a+' '+op+' '+b;
      const av=Number(a),bv=Number(b);let result=op==='*'?av*bv:op==='+'?av+bv:op==='-'?av-bv:op==='/'?av/bv:Math.pow(av,bv);
      if(Number.isFinite(result))return {expression,result};
    }
    const candidates=raw.match(/(?:\d[\d,]*(?:\.\d+)?|\()\s*(?:[+\-*/^%×÷()]|\d[\d,]*(?:\.\d+)?|\s)+/g)||[];
    const expression=candidates.sort((a,b)=>b.length-a.length)[0];
    if(!expression)return null;
    const tokens=expression.replace(/,/g,'').replace(/×/g,'*').replace(/÷/g,'/').match(/\d+(?:\.\d+)?|[()+\-*/^%]/g)||[];
    if(!tokens.length)return null;
    const values=[],ops=[];
    const precedence={'+':1,'-':1,'*':2,'/':2,'%':2,'^':3};
    const apply=()=>{
      const op=ops.pop(),b=values.pop(),a=values.pop();
      if(a===undefined||b===undefined)throw new Error('invalid expression');
      let v;
      if(op==='+')v=a+b;else if(op==='-')v=a-b;else if(op==='*')v=a*b;else if(op==='/')v=a/b;else if(op==='%')v=a%b;else if(op==='^')v=Math.pow(a,b);else throw new Error('invalid operator');
      if(!Number.isFinite(v))throw new Error('non-finite result');
      values.push(v);
    };
    try{
      let expectNumber=true;
      for(const token of tokens){
        if(/^\d/.test(token)){if(!expectNumber)return null;values.push(Number(token));expectNumber=false;continue;}
        if(token==='('){if(!expectNumber)return null;ops.push(token);continue;}
        if(token===')'){while(ops.length&&ops.at(-1)!=='(')apply();if(ops.pop()!=='('||expectNumber)return null;expectNumber=false;continue;}
        if('+-*/^%'.includes(token)){
          if(expectNumber){if(token==='-'){values.push(0);ops.push('-');continue;}return null;}
          while(ops.length&&ops.at(-1)!=='('&&(precedence[ops.at(-1)]>precedence[token]||(precedence[ops.at(-1)]===precedence[token]&&token!=='^')))apply();
          ops.push(token);expectNumber=true;continue;
        }
        return null;
      }
      if(expectNumber)return null;
      while(ops.length){if(ops.at(-1)==='(')return null;apply();}
      if(values.length!==1)return null;
      return {expression,result:values[0]};
    }catch{return null;}
  }

  async function run(message,history=[],hooks={}){
    const ensureActive=()=>{if(hooks?.signal?.aborted)throw new DOMException('Response stopped by user','AbortError')};ensureActive();
    const prompt=clean(message);
    if(!prompt) throw new Error('empty request');
    // Conversation, identity, empathy, and greetings are deliberately NOT answered by
    // phrase tables. They continue to the selected neural model so KAI can understand
    // the user's wording and conversation history rather than replay canned text.
    const memoryAction=memoryCommand(prompt);
    if(memoryAction?.type==='remember') return {lane:'local',handoff:false,response:memoryAction.ok?'Got it — I’ll remember that: '+memoryAction.text:'I couldn’t save that memory. Please avoid storing passwords, keys, or other secrets.',provider:'KAI 51 LOCAL · user memory',model:'browser-local memory',local:true,localModel:false,memory:{saved:!!memoryAction.ok,count:readUserMemory().items.length},sources:[]};
    if(memoryAction?.type==='forget') return {lane:'local',handoff:false,response:memoryAction.ok?(memoryAction.removed==='all'?'Done — I cleared KAI’s saved memories for this browser profile.':'Done — I removed '+memoryAction.removed+' matching memory item(s).'):'I couldn’t update saved memory.',provider:'KAI 51 LOCAL · user memory',model:'browser-local memory',local:true,localModel:false,memory:{removed:memoryAction.removed,count:readUserMemory().items.length},sources:[]};
    // Memory is supplied as context to the neural model; recall is not a canned answer.
    learnStatedPreference(prompt);
    const memoryContext=userMemoryPrompt();
    hooks.onStage?.('understanding','KAI 51 · LOCAL is understanding the request');
    const calculation=calculateExpression(prompt);
    if(calculation){
      const formatted=Number.isInteger(calculation.result)?calculation.result.toLocaleString('en-US') : String(Number(calculation.result.toPrecision(12)));
      return {lane:'local',handoff:false,response:calculation.expression.replace(/,/g,'')+' = '+formatted,provider:'KAI 51 LOCAL · calculator tool',model:'local arithmetic evaluation',local:true,localModel:false,tool:'calculator',sources:[],searchEngines:[],retrievalMs:0};
    }
    const query=queryFor(prompt);
    const wantsSearch=shouldSearch(prompt,history);
    let web=null,wiki=[],files=[];
    const needsTrainingContext=/\b(?:code|coding|program|programming|script|debug|function|class|javascript|typescript|python|html|css|sql|api|react|node|algorithm|app maker|build an app|modify this app|publish|export)\b/i.test(prompt);
    const [retrieved,knowledge,trainingContext]=await Promise.all([
      wantsSearch ? searchFast(query,hooks?.signal,hooks?.searchMode||'normal') : Promise.resolve({web:null,wiki:[]}),
      wantsSearch ? searchKnowledge(query,hooks?.signal) : Promise.resolve([]),
      needsTrainingContext ? trainingContextPrompt(prompt).catch(()=> '') : Promise.resolve('')
    ]);ensureActive();
    web=retrieved.web;wiki=retrieved.wiki;files=knowledge;
    const sources=[];
    for(const x of (web?.sources||[])){
      if(x?.text||x?.title)sources.push({title:clean(x.title,220),url:clean(x.url,700),text:clean(x.text,4200),source:x.engine||web.engine||'Google/Bing/DuckDuckGo',readStatus:x.readStatus||'retrieved'});
    }
    for(const x of wiki) if(x?.text)sources.push(x);
    for(const x of files) if(x?.content)sources.push({title:clean(x.title||'HAxBRO Knowledge',220),url:clean(x.url,700),text:clean(x.content,1800),source:'HAxBRO Knowledge'});
    const unique=[];const seen=new Set();
    for(const s of sources){const key=s.url||s.title;if(!key||seen.has(key))continue;seen.add(key);unique.push(s);}
    ensureActive();hooks.onStage?.('analyzing','KAI 51 · reading and comparing retrieved page evidence');
    const evidenceLimit=hooks?.searchMode==='deep'?8:6;
    const evidence=unique.slice(0,evidenceLimit).map((s,i)=>'[SOURCE '+(i+1)+'] '+s.source+' — '+s.title+' ['+(s.readStatus||'retrieved')+']'+(s.url?' — '+s.url:'')+'\n'+clean(s.text,1400)).join('\n\n');
    const visibleSources=unique.slice(0,evidenceLimit).map(({title,url,source,readStatus})=>({title,url,source,readStatus:readStatus||'retrieved'}));
    hooks.onSources?.(visibleSources);
    const readableSources=unique.filter(s=>s.readStatus==='page-read'||s.readStatus==='wikipedia-article'||s.readStatus==='wikipedia-summary'||s.source==='HAxBRO Knowledge');
    hooks.onStage?.('composing','KAI 51 · neural model is interpreting the source material');
    const reason=readableSources.length?'Read source material is ready for neural interpretation':'No complete readable source was retrieved; KAI must disclose that research could not verify the answer';
    const evidencePrompt=trainingContext+memoryContext+'You are KAI 51, using the active HAxBRO local conversational model (Qwen3-0.6B Q4_K_M GGUF on every device through Wllama 3 with WebGPU when available and WebAssembly fallback) to answer from retrieved evidence. Answer the exact user question in clear, natural language. First understand the question, then synthesize the strongest relevant facts from the sources. Compare sources where useful, explain important points and why they matter, distinguish verified facts from inference, and mention disagreements or missing evidence. Do not dump search results or copy source paragraphs. Cite claims inline as [1], [2], etc. using only the matching source numbers. Page-read and wikipedia-article entries contain readable page text; wikipedia-summary entries are abstracts, not full-page reads; HAxBRO Knowledge entries contain retrieved knowledge; search-snippet-fallback entries are leads, not verified page content. If the user explicitly requested current or source-backed research, say when readable evidence is absent or insufficient and never pretend the research verified the answer. For ordinary conversation or general-knowledge questions, answer directly from model knowledge and the supplied conversation context even when no sources were retrieved. If the user asks for a specific HAxBRO project fact that is not in the supplied knowledge records, be transparent rather than inventing it. If the evidence is partial or conflicting, be transparent. Answer in your own words, politely and helpfully.\n\nUSER REQUEST:\n'+prompt+'\n\nRETRIEVED WEB / WIKIPEDIA / HAxBRO KNOWLEDGE EVIDENCE:\n'+(evidence||(wantsSearch?'No reliable retrieved web or knowledge evidence was available.':'No web search was requested. Answer ordinary questions from your model knowledge, saved memory and conversation context.'));
    return {lane:'local',handoff:true,research:wantsSearch,reason,evidencePrompt,response:null,provider:'KAI 51 · webpage retrieval tool',model:'HAxBRO selected local neural model',local:true,localModel:true,sources:unique.slice(0,evidenceLimit).map(({title,url,source,readStatus})=>({title,url,source,readStatus:readStatus||'retrieved'})),searchEngines:[...(web?.engine?[web.engine]:[]),...(wiki.length?['Wikipedia']:[])],retrievalMs:0};
  }

  window.HAxBROKaiLocalIntelligence={
    version:VERSION,ready:true,run,chat:run,
    learn:(message)=>{learnStatedPreference(message);return userMemoryPrompt();},
    memoryContext:userMemoryPrompt,
    classify:(message,history=[])=>({research:shouldSearch(message,history),mode:'evidence-first-neural'}),
    status:()=>({ready:true,local:true,foundationalModel:false,mode:'local-neural-synthesis-with-memory-and-knowledge-retrieval',version:VERSION})
  };
  window.dispatchEvent(new CustomEvent('haxbro:kai-local-ready',{detail:{version:VERSION}}));
})();