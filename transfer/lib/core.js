const KAI51_IDENTITY=Object.freeze({name:'KAI 51',version:'51.8-local-only',owner:'HAxBRO AI',provider:null,externalModel:false,networkModel:false});

export async function complete({prompt=''}={}){
  if(!String(prompt||'').trim()) throw new Error('KAI 51 request rejected: empty prompt');
  throw new Error('KAI 51 local-only mode: use the browser Qwen runtime for generation. Hosted model inference is disabled.');
}

export const CORE_PROVIDER_CHAIN=['KAI 51'];
export { KAI51_IDENTITY };