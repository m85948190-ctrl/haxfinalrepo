export const access="public";
export const methods=["POST"];
export default async function(req,res){
  return res.status(410).json({
    ok:false,
    retired:true,
    error:"The hosted CodeMaker endpoint is retired. HAxBRO App Maker now generates code with the on-device KAI model; no API key or hosted LLM is used."
  });
}