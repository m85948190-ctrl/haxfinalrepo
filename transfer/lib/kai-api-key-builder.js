export function buildApiKeyAIWorkspace(title,esc,baseCss){
  const name=String(title||"AI Assistant").slice(0,70);
  const safe=typeof esc==="function"?esc:(v)=>String(v??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const body='<main class="shell"><header class="top"><div><div class="eyebrow">PRIVATE AI WORKSPACE</div><h1>'+safe(name)+'</h1><p class="muted">Connect your own OpenAI API key and chat with the model you choose.</p></div><span class="eyebrow">YOUR KEY · YOUR MODEL</span></header><section class="card" style="margin-top:16px"><h2>API connection</h2><div class="row"><label>OpenAI API key<input id="apiKey" type="password" autocomplete="off" spellcheck="false" placeholder="Paste your API key" required></label><label>Model<input id="model" value="gpt-4o-mini" autocomplete="off" spellcheck="false"></label></div><p class="muted">Your key is used for the current session only. It is not saved in browser storage or project files.</p><p id="connection" class="muted" role="status">Add your key to start.</p></section><section class="card" style="margin-top:16px"><div id="messages" aria-live="polite" style="min-height:240px;max-height:52vh;overflow:auto"></div><form id="chat" class="row" style="margin-top:14px"><input id="message" autocomplete="off" placeholder="Message '+safe(name)+'…" required><button class="primary" id="send" type="submit">SEND</button></form><p class="muted">Requests use the included server-side API proxy. Do not put API keys into source code.</p></section></main>';
  const css=String(baseCss||"")+'\nbody{background:#f8fafc!important;color:#111827!important}.top,.card,.item{background:#fff!important;color:#111827!important;border-color:#e5e7eb!important;box-shadow:0 8px 26px #1118270a!important}.muted{color:#4b5563!important}.eyebrow{color:#166534!important}input,textarea,select{background:#fff!important;color:#111827!important;border-color:#d1d5db!important}button.primary{background:#166534!important;color:#fff!important;border-color:#166534!important}.shell{max-width:920px}.card h2{margin-top:0}#messages .item{display:flex;gap:12px;margin:8px 0;padding:12px;border-radius:12px;white-space:pre-wrap}#messages .item b{min-width:54px;color:#166534}';
  const js=[
    "const box=document.querySelector('#messages'),form=document.querySelector('#chat'),input=document.querySelector('#message'),keyInput=document.querySelector('#apiKey'),modelInput=document.querySelector('#model'),send=document.querySelector('#send'),state=document.querySelector('#connection');",
    "const historyKey='rolex_ai_chat_history_v1';let messages=[];try{messages=JSON.parse(localStorage.getItem(historyKey)||'[]')}catch(e){messages=[]}",
    "function persist(){try{localStorage.setItem(historyKey,JSON.stringify(messages.slice(-40)))}catch{}}",
    "function render(){box.textContent='';messages.forEach(m=>{const row=document.createElement('div');row.className='item';const label=document.createElement('b');label.textContent=m.role==='user'?'YOU':'AI';const text=document.createElement('span');text.textContent=m.content;row.append(label,text);box.append(row)});box.scrollTop=box.scrollHeight}",
    "form.addEventListener('submit',async e=>{e.preventDefault();const prompt=input.value.trim(),apiKey=keyInput.value.trim(),model=modelInput.value.trim()||'gpt-4o-mini';if(!prompt)return;if(!apiKey){state.textContent='Enter your OpenAI API key first.';keyInput.focus();return}messages.push({role:'user',content:prompt});input.value='';send.disabled=true;state.textContent='Connecting to the AI provider…';render();try{const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+apiKey},body:JSON.stringify({model,messages:messages.slice(-20)})});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'The AI provider request failed ('+response.status+').');if(!data.reply)throw new Error('The provider returned an empty response.');messages.push({role:'assistant',content:String(data.reply)});state.textContent='Connected · '+model;persist()}catch(error){messages.push({role:'assistant',content:'Request failed: '+String(error.message||error)+'\\nCheck your API key, model name and server configuration.'});state.textContent='Connection error · no successful response received'}finally{send.disabled=false;render();input.focus()}});",
    "keyInput.addEventListener('input',()=>{state.textContent=keyInput.value.trim()?'API key entered · ready to send':'Add your key to start.'});render();"
  ].join("\n");
  const server=[
    "'use strict';","const express=require('express');","const path=require('path');","const app=express();","app.disable('x-powered-by');","app.use(express.json({limit:'1mb'}));",
    "app.get('/health',(req,res)=>res.json({ok:true,service:'AI API proxy'}));",
    "app.post('/api/chat',async(req,res)=>{",
    "  const authorization=String(req.headers.authorization||'');",
    "  const apiKey=authorization.replace(/^Bearer\\s+/i,'').trim();",
    "  if(!apiKey)return res.status(401).json({error:'An OpenAI API key is required.'});",
    "  const model=String(req.body?.model||'gpt-4o-mini').trim().slice(0,100);",
    "  const messages=Array.isArray(req.body?.messages)?req.body.messages.slice(-20):[];",
    "  const safeMessages=messages.filter(m=>m&&['user','assistant','system'].includes(m.role)&&typeof m.content==='string').map(m=>({role:m.role,content:m.content.slice(0,12000)}));",
    "  if(!safeMessages.length)return res.status(400).json({error:'At least one valid message is required.'});",
    "  try{",
    "    const upstream=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'Authorization':'Bearer '+apiKey,'Content-Type':'application/json'},body:JSON.stringify({model,messages:safeMessages}),signal:AbortSignal.timeout(120000)});",
    "    const data=await upstream.json().catch(()=>({}));",
    "    if(!upstream.ok)return res.status(upstream.status).json({error:data.error?.message||'OpenAI rejected the request. Check the key, model and account access.'});",
    "    const reply=data.choices?.[0]?.message?.content;",
    "    if(typeof reply!=='string'||!reply.trim())return res.status(502).json({error:'The provider returned no message content.'});",
    "    return res.json({reply,model,provider:'OpenAI'});",
    "  }catch(error){return res.status(502).json({error:error.name==='TimeoutError'?'The AI provider timed out. Please retry.':'Could not reach the AI provider. Check the server network and try again.'});}",
    "});",
    "app.use(express.static(path.join(__dirname,'..')));",
    "const port=Number(process"+".env.PORT||3000);",
    "app.listen(port,()=>process.stdout.write('AI app server listening on '+port+'\\n'));"
  ].join("\n");
  const readme=[
    "# "+name,"","## Run the application",
    "1. Install Node.js 18 or newer.",
    "2. Run \`npm install\`.",
    "3. Run \`npm start\`.",
    "4. Open \`http://localhost:3000\`.",
    "5. Paste your own OpenAI API key into the password field and send a message.",
    "","## API-key handling",
    "- The browser does not save the API key to localStorage or include it in source files.",
    "- The key is sent over HTTPS in the Authorization header to this app's server-side proxy.",
    "- The server forwards it to the OpenAI API and does not intentionally log or persist it.",
    "- Use HTTPS in production and protect the server from unauthorized access and abuse.",
    "- API usage is billed by the provider account associated with the key.",
    "","## Provider",
    "This starter uses the OpenAI Chat Completions API. Change the model field to a model available to your API account."
  ].join("\n");
  return {
    name,
    summary:"AI chat app with an actual OpenAI API integration, user-entered API key, server-side proxy and no browser-side key persistence.",
    files:[
      {path:"index.html",content:'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#f8fafc"><title>'+safe(name)+'</title><link rel="stylesheet" href="style.css"></head><body>'+body+'<script src="app.js"></script></body></html>'},
      {path:"style.css",content:css},{path:"app.js",content:js},{path:"server/index.js",content:server},
      {path:"package.json",content:JSON.stringify({name:"rolex-ai",version:"1.0.0",private:true,scripts:{start:"node server/index.js"},engines:{node:">=18"},dependencies:{express:"^4.21.2"}},null,2)},
      {path:"README.md",content:readme}
    ],
    kai:{engine:"HAxBRO API Integration Builder",provider:"OpenAI",apiKeyHandling:"session-only; not persisted in browser storage or source"}
  };
}