export const access="public";
export const methods=["POST"];
export default async function(req,res){
  return res.status(410).json({
    ok:false,
    error:"This legacy deterministic builder is retired. App Maker now uses the existing local Qwen intelligence with the integrated CodeMaker and CodeWriter pipeline. Open App Maker from HAxBRO to build or modify a project.",
    retired:"appmaker-original-generate",
    replacement:"/app-maker-original/"
  });
}