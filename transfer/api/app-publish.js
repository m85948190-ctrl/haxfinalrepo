const clean = (value) => String(value || "").replace(/[<>]/g, "").slice(0, 120);
const normalize = (value) => {
  const parts = String(value || "").replace(/\\/g, "/").split("/");
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
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
};
const encode64 = (bytes) => {
  let raw = "";
  for (let i = 0; i < bytes.length; i += 8192) raw += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(raw);
};
const mime = (path) => {
  const ext = path.split(".").pop().toLowerCase();
  return ({png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",gif:"image/gif",webp:"image/webp",svg:"image/svg+xml",ico:"image/x-icon",avif:"image/avif",woff:"font/woff",woff2:"font/woff2",ttf:"font/ttf",otf:"font/otf",mp4:"video/mp4",webm:"video/webm",mp3:"audio/mpeg",pdf:"application/pdf",json:"application/json",wasm:"application/wasm"})[ext] || "application/octet-stream";
};
function inline(files) {
  const byPath = new Map(files.map((file) => [file.path, file]));
  const findAsset = (base, ref) => {
    const raw = String(ref || "").split("#")[0].split("?")[0];
    if (!raw || /^(data:|https?:|\/\/|mailto:|tel:|javascript:|#)/i.test(raw)) return null;
    let decoded = raw;
    try { decoded = decodeURIComponent(raw); } catch {}
    const candidate = raw.startsWith("/") ? normalize(decoded) : normalize(base + "/" + decoded);
    return byPath.get(candidate) || byPath.get(normalize(decoded)) || null;
  };
  const dataUrl = (file) => "data:" + mime(file.path) + ";base64," + encode64(file.bytes);
  const rewriteCss = (css, cssPath) => String(css).replace(/url\(\s*(['"]?)([^)'"]+)\1\s*\)/gi, (whole, quote, ref) => {
    const asset = findAsset(cssPath.split("/").slice(0, -1).join("/"), ref.trim());
    return asset ? "url(" + dataUrl(asset) + ")" : whole;
  });
  const htmlFile = byPath.get("index.html") || byPath.get("index.htm") || files.find((file) => /\.html?$/i.test(file.path));
  if (!htmlFile) return null;
  let html = new TextDecoder().decode(htmlFile.bytes);
  const cssFiles = files.filter((file) => /\.css$/i.test(file.path));
  const jsFiles = files.filter((file) => /\.(?:m?js)$/i.test(file.path));
  let usedCss = new Set();
  html = html.replace(/<link\b[^>]*href=["']([^"']+\.css(?:\?[^"']*)?)["'][^>]*>/gi, (tag, href) => {
    const asset = findAsset("", href);
    if (!asset) return tag;
    usedCss.add(asset.path);
    return "<style>" + rewriteCss(new TextDecoder().decode(asset.bytes), asset.path).replace(/<\/style/gi, "<\\/style") + "</style>";
  });
  const extraCss = cssFiles.filter((file) => !usedCss.has(file.path)).map((file) => rewriteCss(new TextDecoder().decode(file.bytes), file.path)).join("\n");
  if (extraCss) html = html.replace(/<\/head>/i, "<style>" + extraCss.replace(/<\/style/gi, "<\\/style") + "</style></head>");
  let usedJs = new Set();
  html = html.replace(/<script\b([^>]*?)src=["']([^"']+\.m?js(?:\?[^"']*)?)["']([^>]*)>\s*<\/script>/gi, (tag, before, src, after) => {
    const asset = findAsset("", src);
    if (!asset) return tag;
    usedJs.add(asset.path);
    const type = /\btype=["']module["']/i.test(before + after) ? ' type="module"' : "";
    return "<script" + type + ">" + new TextDecoder().decode(asset.bytes).replace(/<\/script/gi, "<\\/script") + "</script>";
  });
  const extraJs = jsFiles.filter((file) => !usedJs.has(file.path)).map((file) => new TextDecoder().decode(file.bytes)).join("\n");
  if (extraJs) html = html.replace(/<\/body>/i, "<script>" + extraJs.replace(/<\/script/gi, "<\\/script") + "</script></body>");
  html = html.replace(/\b(src|poster|href)=["']([^"']+)["']/gi, (whole, attr, ref) => {
    const asset = findAsset("", ref);
    if (!asset || /\.css(?:\?|$)/i.test(ref) || /\.m?js(?:\?|$)/i.test(ref) || /\.html?(?:\?|$)/i.test(ref)) return whole;
    return attr + '="' + dataUrl(asset) + '"';
  });
  return html;
}
export const access = "public";
export const methods = ["POST"];
export default async function(req, res) {
  const name = clean(req.body?.name) || "HAxBRO Upload";
  const rawFiles = Array.isArray(req.body?.files) ? req.body.files.slice(0, 100) : [];
  if (!rawFiles.length) return res.status(400).json({ok:false,error:"Choose a ZIP, folder, or website files first."});
  const files = [];
  let total = 0;
  try {
    for (const item of rawFiles) {
      const path = normalize(item?.path);
      if (!path || path.split("/").includes("..")) return res.status(400).json({ok:false,error:"An uploaded file has an invalid path."});
      let bytes;
      if (typeof item.contentBase64 === "string") bytes = decode64(item.contentBase64);
      else if (typeof item.content === "string") bytes = new TextEncoder().encode(item.content);
      else continue;
      total += bytes.length;
      if (total > 6 * 1024 * 1024) return res.status(413).json({ok:false,error:"Project exceeds the 6 MB unpacked upload limit."});
      files.push({path,bytes});
    }
    if (!files.some((file) => file.path.toLowerCase() === "index.html")) return res.status(400).json({ok:false,error:"Your project needs a root index.html file."});
    const html = inline(files);
    if (!html) return res.status(400).json({ok:false,error:"Could not package this website."});
    if (new TextEncoder().encode(html).length > 9000000) return res.status(413).json({ok:false,error:"The packaged website is too large for quick publishing. Reduce image sizes and try again."});
    const response = await fetch("https://ship.page/deploy", {
      method: "POST",
      headers: {"Content-Type":"text/html; charset=utf-8","X-Ship-Name":name},
      body: html
    });
    const text = await response.text();
    if (!response.ok) throw new Error(text || ("External host HTTP " + response.status));
    let url = "";
    try { const data = JSON.parse(text); url = data.url || data.liveUrl || data.siteUrl || data.location || ""; } catch {}
    if (!url) { const match = text.match(/https?:\/\/[^\s"'<>]+/); url = match?.[0] || ""; }
    if (!url || !/^https:\/\//i.test(url)) throw new Error("The hosting provider returned no secure public URL.");
    return res.json({ok:true,hosting:"ship.page",provider:"ship.page free static hosting",free:true,public:true,accountRequired:false,expires:"anonymous free deployments are temporary (up to 30 days)",url,appUrl:url,publicUrl:url,files:files.length});
  } catch (error) {
    return res.status(502).json({ok:false,error:"External static publishing failed: " + String(error?.message || error)});
  }
}