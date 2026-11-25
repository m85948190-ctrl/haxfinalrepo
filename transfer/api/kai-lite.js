export const access="public";
export const methods=["POST","OPTIONS"];
export default async function(req,res){
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type");
  if(req.method==="OPTIONS")return res.status(204).send("");
  return res.status(410).json({ok:false,error:"The retired extractive KAI Lite lane is disabled. Natural-language responses are handled by the existing Qwen runtime; no canned-response fallback is available."});
}