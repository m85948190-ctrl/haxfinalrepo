import { db } from "hatchable";

export const access = "public";
export const methods = ["POST"];

const clean = (value) => String(value || "").replace(/[<>]/g, "").slice(0, 120);
const safePath = (value) => {
  const path = String(value || "").replace(/\\/g, "/").replace(/^\/+/, "");
  if (!path || path.split("/").some((part) => !part || part === "." || part === "..") || path.includes("\0")) return "";
  return path.slice(0, 180);
};
const decodeBase64Size = (value) => Math.floor(String(value || "").length * 3 / 4);

export default async function(req, res) {
  const name = clean(req.body?.name) || "HAxBRO App";
  const incoming = Array.isArray(req.body?.files) ? req.body.files.slice(0, 100) : [];
  if (!incoming.length) return res.status(400).json({ok:false,error:"Choose a ZIP, folder, or website files first."});
  const safeFiles = [];
  let totalBytes = 0;
  for (const file of incoming) {
    const path = safePath(file?.path);
    if (!path) return res.status(400).json({ok:false,error:"An uploaded file has an invalid path."});
    if (typeof file.content === "string") {
      const bytes = new TextEncoder().encode(file.content);
      totalBytes += bytes.length;
      safeFiles.push({path,content:file.content});
    } else if (typeof file.contentBase64 === "string") {
      const encoded = file.contentBase64.replace(/\s/g, "");
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) return res.status(400).json({ok:false,error:"A binary file was not valid base64."});
      totalBytes += decodeBase64Size(encoded);
      safeFiles.push({path,contentBase64:encoded});
    }
    if (totalBytes > 6 * 1024 * 1024) return res.status(413).json({ok:false,error:"Project exceeds the 6 MB unpacked upload limit."});
  }
  // Match common static hosts: remove a single enclosing ZIP/folder directory,
  // then promote the first HTML document to the required root index.html.
  if (!safeFiles.some((file) => file.path.toLowerCase() === "index.html") && safeFiles.length) {
    const root = safeFiles[0].path.split("/")[0];
    if (root && safeFiles.every((file) => file.path.startsWith(root + "/"))) {
      for (const file of safeFiles) file.path = file.path.slice(root.length + 1);
    }
    if (!safeFiles.some((file) => file.path.toLowerCase() === "index.html")) {
      const homepage = safeFiles.find((file) => /\.html?$/i.test(file.path));
      if (homepage) {
        homepage.path = "index.html";
      }
    }
  }
  if (!safeFiles.some((file) => file.path.toLowerCase() === "index.html")) return res.status(400).json({ok:false,error:"No HTML homepage was found. Add an .html file and try again."});
  if (!safeFiles.length) return res.status(400).json({ok:false,error:"No supported website files were found."});
  try {
    const {rows} = await db.query(
      "INSERT INTO haxbro_generated_apps (name,files) VALUES ($1,$2) RETURNING id",
      [name,JSON.stringify(safeFiles)]
    );
    const id = rows[0].id;
    const origin = new URL(req.url, "https://haxbro-ai-oybr.hatchable.site").origin;
    return res.json({ok:true,id,url:origin + "/apps/" + id,hosting:"HAxBRO App Engine",provider:"HAxBRO",free:true,files:safeFiles.length});
  } catch (error) {
    return res.status(500).json({ok:false,error:"HAxBRO could not save this deployment: " + String(error?.message || error)});
  }
}