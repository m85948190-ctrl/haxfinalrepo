import { db } from "hatchable";

export const access = "public";

const escapeHtml = (value) => String(value ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
const normalize = (value) => {
  const parts = String(value || "").replace(/\\/g,"/").split("/");
  const out = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") { if (out.length) out.pop(); else return ""; }
    else out.push(part);
  }
  return out.join("/");
};
const decode64 = (value) => {
  const raw = atob(String(value || ""));
  const bytes = new Uint8Array(raw.length);
  for (let i=0;i<raw.length;i++) bytes[i]=raw.charCodeAt(i);
  return bytes;
};
const encode64 = (bytes) => {
  let raw = "";
  for (let i=0;i<bytes.length;i+=8192) raw += String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(raw);
};
const bytesOf = (file) => file.contentBase64 ? decode64(file.contentBase64) : new TextEncoder().encode(String(file.content || ""));
const textOf = (file) => file.contentBase64 ? new TextDecoder().decode(decode64(file.contentBase64)) : String(file.content || "");
const mime = (path) => {
  const ext=path.split(".").pop().toLowerCase();
  return ({png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",gif:"image/gif",webp:"image/webp",svg:"image/svg+xml",ico:"image/x-icon",avif:"image/avif",woff:"font/woff",woff2:"font/woff2",ttf:"font/ttf",otf:"font/otf",mp4:"video/mp4",webm:"video/webm",mp3:"audio/mpeg",pdf:"application/pdf",json:"application/json",wasm:"application/wasm"})[ext] || "application/octet-stream";
};
function inlineApp(source, files) {
  const byPath = new Map(files.map((file) => [file.path, file]));
  const findAsset = (base, ref) => {
    const raw=String(ref||"").split("#")[0].split("?")[0];
    if(!raw||/^(data:|https?:|\/\/|mailto:|tel:|javascript:|#)/i.test(raw)) return null;
    let decoded=raw;try{decoded=decodeURIComponent(raw)}catch{}
    const candidate=raw.startsWith("/")?normalize(decoded):normalize(base+"/"+decoded);
    return byPath.get(candidate)||byPath.get(normalize(decoded))||null;
  };
  const dataUrl = (file) => "data:"+mime(file.path)+";base64,"+encode64(bytesOf(file));
  const rewriteCss = (css, cssPath) => String(css).replace(/url\(\s*(['"]?)([^)'"]+)\1\s*\)/gi,(whole,quote,ref)=>{
    const asset=findAsset(cssPath.split("/").slice(0,-1).join("/"),ref.trim());
    return asset?"url("+dataUrl(asset)+")":whole;
  });
  let out=source;
  if(!out.includes("<meta charset=")) out=out.replace("<head>","<head><meta charset=\"UTF-8\">");
  if(!out.includes('name="viewport"')) out=out.replace("<head>","<head><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">");
  const cssFiles=files.filter((file)=>/\.css$/i.test(file.path));
  const jsFiles=files.filter((file)=>/\.(?:m?js)$/i.test(file.path));
  const usedCss=new Set();
  out=out.replace(/<link\b[^>]*href=["']([^"']+\.css(?:\?[^"']*)?)["'][^>]*>/gi,(tag,href)=>{
    const asset=findAsset("",href);if(!asset)return tag;usedCss.add(asset.path);
    return "<style>"+rewriteCss(textOf(asset),asset.path).replace(/<\/style/gi,"<\\/style")+"</style>";
  });
  const extraCss=cssFiles.filter((file)=>!usedCss.has(file.path)).map((file)=>rewriteCss(textOf(file),file.path)).join("\n");
  if(extraCss) out=out.replace(/<\/head>/i,"<style>"+extraCss.replace(/<\/style/gi,"<\\/style")+"</style></head>");
  const usedJs=new Set();
  out=out.replace(/<script\b([^>]*?)src=["']([^"']+\.m?js(?:\?[^"']*)?)["']([^>]*)>\s*<\/script>/gi,(tag,before,src,after)=>{
    const asset=findAsset("",src);if(!asset)return tag;usedJs.add(asset.path);
    const type=/\btype=["']module["']/i.test(before+after)?' type="module"':"";
    return "<script"+type+">"+textOf(asset).replace(/<\/script/gi,"<\\/script")+"</script>";
  });
  const extraJs=jsFiles.filter((file)=>!usedJs.has(file.path)).map(textOf).join("\n");
  if(extraJs) out=out.replace(/<\/body>/i,"<script>"+extraJs.replace(/<\/script/gi,"<\\/script")+"</script></body>");
  out=out.replace(/\b(src|poster|href)=["']([^"']+)["']/gi,(whole,attr,ref)=>{
    const asset=findAsset("",ref);
    if(!asset||/\.(?:css|m?js|html?)(?:\?|$)/i.test(ref)) return whole;
    return attr+'="'+dataUrl(asset)+'"';
  });
  return out;
}

export default async function(req,res) {
  const id=String(req.params.id||"");
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return res.status(404).send("<!doctype html><html><body style=\"font-family:system-ui;padding:40px\"><h1>App not found</h1><p>This HAxBRO app link is invalid.</p></body></html>");
  }
  const {rows}=await db.query("SELECT name, files FROM haxbro_generated_apps WHERE id=$1",[id]);
  const app=rows[0];
  if(!app) return res.status(404).send("<!doctype html><html><body style=\"font-family:system-ui;padding:40px\"><h1>App not found</h1><p>This HAxBRO app link is invalid.</p></body></html>");
  const files=Array.isArray(app.files)?app.files.filter((file)=>file&&typeof file.path==="string"):[];
  let source=textOf(files.find((file)=>file.path.toLowerCase()==="index.html")||files.find((file)=>file.path.toLowerCase()==="index.htm")||{content:"<!doctype html><html><head></head><body></body></html>"});
  source=inlineApp(source,files);
  res.setHeader("X-HAxBRO-App-Engine","public-static-render");
  res.setHeader("Cache-Control","public, max-age=300");
  res.setHeader("Content-Security-Policy","default-src 'self' https: data: blob:; script-src 'unsafe-inline' 'unsafe-eval' https: data:; style-src 'unsafe-inline' https: data:; img-src 'self' https: data: blob:; font-src 'self' https: data:; connect-src https:; frame-src https: data: blob:;");
  return res.send(source);
}