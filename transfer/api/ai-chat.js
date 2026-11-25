export const access="public";
export const methods=["POST","OPTIONS"];

const PROVIDERS={
  openai:{url:"https://api.openai.com/v1/chat/completions",model:"gpt-4o-mini"},
  groq:{url:"https://api.groq.com/openai/v1/chat/completions",model:"llama-3.3-70b-versatile"},
  openrouter:{url:"https://openrouter.ai/api/v1/chat/completions",model:"openai/gpt-4o-mini"}
};
const clean=(v,n=6000)=>String(v??"").replace(/\u0000/g,"").slice(0,n);

export default async function(req,res){
  res.setHeader("Cache-Control","no-store");
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type");
  if(req.method==="OPTIONS")return res.status(204).send("");
  if(req.method!=="POST")return res.status(405).json({ok:false,error:"POST required"});
  const body=req.body||{};
  const provider=String(body.provider||"").toLowerCase();
  const config=PROVIDERS[provider];
  const key=clean(body.apiKey,500).trim();
  const model=clean(body.model||config?.model,160).trim();
  const message=clean(body.message,12000).trim();
  if(!config)return res.status(400).json({ok:false,error:"Choose OpenAI, Groq or OpenRouter."});
  if(!key)return res.status(400).json({ok:false,error:"Add your provider API key to connect this AI."});
  if(!message)return res.status(400).json({ok:false,error:"Enter a message."});
  const history=Array.isArray(body.history)?body.history.slice(-12):[];
  const messages=[
    {role:"system",content:clean(body.systemPrompt||"You are a helpful AI assistant. Answer clearly and accurately.",5000)},
    ...history.map(x=>({role:x?.role==="assistant"?"assistant":"user",content:clean(x?.content,5000)})).filter(x=>x.content),
    {role:"user",content:message}
  ];
  try{
    const headers={"content-type":"application/json","authorization":"Bearer "+key};
    if(provider==="openrouter"){
      headers["HTTP-Referer"]="https://haxbro.in";
      headers["X-Title"]="HAxBRO AI App";
    }
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),30000);
    let upstream;
    try{
      upstream=await fetch(config.url,{
        method:"POST",
        headers,
        signal:controller.signal,
        body:JSON.stringify({model:model||config.model,messages,temperature:0.5,max_tokens:1200})
      });
    }finally{clearTimeout(timeout)}
    const raw=await upstream.text();
    let data={};try{data=JSON.parse(raw)}catch{}
    if(!upstream.ok){
      const detail=clean(data?.error?.message||data?.message||"Provider request failed ("+upstream.status+")",500);
      return res.status(upstream.status===401||upstream.status===403?401:502).json({ok:false,error:detail,provider});
    }
    const response=String(data?.choices?.[0]?.message?.content||"").trim();
    if(!response)return res.status(502).json({ok:false,error:"The provider returned an empty answer.",provider});
    return res.json({ok:true,response,provider,model:model||config.model});
  }catch(error){
    const timedOut=error?.name==="AbortError";
    return res.status(timedOut?504:502).json({
      ok:false,
      code:timedOut?"provider-timeout":"provider-error",
      error:timedOut?"The selected AI provider did not respond within 30 seconds. Please retry or check the provider connection.":clean(error?.message||"AI provider connection failed.",500),
      provider
    });
  }
}