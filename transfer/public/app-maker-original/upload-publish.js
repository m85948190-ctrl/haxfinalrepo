(() => {
  const $ = (s) => document.querySelector(s);
  const zone = $("#uploadDropzone");
  const zipInput = $("#uploadZipInput");
  const folderInput = $("#uploadFolderInput");
  const filesInput = $("#uploadFilesInput");
  const list = $("#uploadFileList");
  const status = $("#uploadDeployStatus");
  const publish = $("#uploadDeployButton");
  if (!zone || !publish || publish.dataset.ready) return;
  publish.dataset.ready = "1";
  let entries = [];
  const MAX_BYTES = 6 * 1024 * 1024;
  const say = (message) => { status.textContent = message; };
  const safePath = (raw) => {
    const path = String(raw || "").split("\\").join("/").replace(/^\/+/, "");
    if (!path || path.split("/").some((part) => !part || part === "." || part === "..") || path.includes("\0")) {
      throw new Error("The upload contains an unsafe file path.");
    }
    return path;
  };
  const toBase64 = (bytes) => {
    let binary = "";
    for (let i = 0; i < bytes.length; i += 8192) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    }
    return btoa(binary);
  };
  const isText = (path) => {
    const ext = path.split(".").pop().toLowerCase();
    return ["html","htm","css","js","mjs","json","txt","svg","xml","webmanifest","md","csv","yaml","yml","toml","map","sql"].includes(ext);
  };
  async function unpackZip(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let end = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65558); i--) {
      if (view.getUint32(i, true) === 0x06054b50) { end = i; break; }
    }
    if (end < 0) throw new Error("This ZIP archive is invalid or unsupported.");
    const count = view.getUint16(end + 10, true);
    let offset = view.getUint32(end + 16, true);
    if (count > 100) throw new Error("ZIP contains more than 100 files. Please split it.");
    const output = [];
    let total = 0;
    for (let n = 0; n < count; n++) {
      if (view.getUint32(offset, true) !== 0x02014b50) throw new Error("The ZIP directory is damaged.");
      const method = view.getUint16(offset + 10, true);
      const packedSize = view.getUint32(offset + 20, true);
      const size = view.getUint32(offset + 24, true);
      const nameSize = view.getUint16(offset + 28, true);
      const extraSize = view.getUint16(offset + 30, true);
      const commentSize = view.getUint16(offset + 32, true);
      const localOffset = view.getUint32(offset + 42, true);
      const name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameSize));
      offset += 46 + nameSize + extraSize + commentSize;
      if (!name || name.endsWith("/")) continue;
      if (method !== 0 && method !== 8) throw new Error("Unsupported ZIP compression for " + name);
      total += size;
      if (total > MAX_BYTES) throw new Error("Unpacked project exceeds the 6 MB limit.");
      if (view.getUint32(localOffset, true) !== 0x04034b50) throw new Error("Damaged ZIP entry: " + name);
      const localName = view.getUint16(localOffset + 26, true);
      const localExtra = view.getUint16(localOffset + 28, true);
      const start = localOffset + 30 + localName + localExtra;
      const packed = bytes.subarray(start, start + packedSize);
      let data;
      if (method === 0) data = packed.slice();
      else {
        if (typeof DecompressionStream === "undefined") throw new Error("This browser cannot unpack this ZIP. Choose the project folder instead.");
        const stream = new Blob([packed]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
        data = new Uint8Array(await new Response(stream).arrayBuffer());
      }
      if (data.length !== size) throw new Error("ZIP size verification failed for " + name);
      output.push({ path: safePath(name), bytes: data });
    }
    return output;
  }
  async function readFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return [];
    if (files.length === 1 && files[0].name.toLowerCase().endsWith(".zip")) return unpackZip(files[0]);
    if (files.length > 100) throw new Error("Choose no more than 100 files.");
    let total = 0;
    const output = [];
    for (const file of files) {
      const path = safePath(file.webkitRelativePath || file.name);
      const bytes = new Uint8Array(await file.arrayBuffer());
      total += bytes.length;
      if (total > MAX_BYTES) throw new Error("Project exceeds the 6 MB upload limit.");
      output.push({ path, bytes });
    }
    const hasRootIndex = output.some((x) => x.path.toLowerCase() === "index.html");
    if (!hasRootIndex && output.length) {
      const root = output[0].path.split("/")[0];
      if (root && output.every((x) => x.path.startsWith(root + "/"))) {
        for (const item of output) item.path = item.path.slice(root.length + 1);
      }
    }
    return output;
  }
  function display(items) {
    entries = items;
    const hasIndex = items.some((x) => x.path.toLowerCase() === "index.html");
    const size = items.reduce((sum, x) => sum + x.bytes.length, 0);
    list.hidden = false;
    list.textContent = items.slice(0, 12).map((x) => x.path).join(" · ") + (items.length > 12 ? " · +" + (items.length - 12) + " more" : "");
    publish.disabled = !items.length || !hasIndex;
    say(items.length + " files · " + (size / 1024).toFixed(1) + " KB · " + (hasIndex ? "Ready to publish" : "Root index.html is required"));
  }
  async function selectFiles(fileList) {
    try {
      publish.disabled = true;
      say("Reading and checking your project files…");
      const items = await readFiles(fileList);
      if (!items.length) { say("No files selected."); return; }
      display(items);
    } catch (error) {
      entries = [];
      list.hidden = true;
      publish.disabled = true;
      say(error.message || "Could not read those files.");
    }
  }
  $("#chooseZip")?.addEventListener("click", (e) => { e.stopPropagation(); zipInput.click(); });
  $("#chooseFolder")?.addEventListener("click", (e) => { e.stopPropagation(); folderInput.click(); });
  $("#chooseFiles")?.addEventListener("click", (e) => { e.stopPropagation(); filesInput.click(); });
  zipInput?.addEventListener("change", (e) => selectFiles(e.target.files));
  folderInput?.addEventListener("change", (e) => selectFiles(e.target.files));
  filesInput?.addEventListener("change", (e) => selectFiles(e.target.files));
  zone.addEventListener("click", (e) => { if (!e.target.closest("button")) filesInput.click(); });
  zone.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); filesInput.click(); } });
  ["dragenter","dragover"].forEach((type) => zone.addEventListener(type, (e) => { e.preventDefault(); zone.classList.add("dragover"); }));
  ["dragleave","drop"].forEach((type) => zone.addEventListener(type, (e) => { e.preventDefault(); zone.classList.remove("dragover"); }));
  zone.addEventListener("drop", (e) => { if (e.dataTransfer?.files?.length) selectFiles(e.dataTransfer.files); });
  publish.addEventListener("click", async () => {
    if (!entries.length || publish.disabled) return;
    publish.disabled = true;
    publish.textContent = "Publishing…";
    say("Packaging " + entries.length + " files and publishing your website…");
    try {
      const files = entries.map((item) => {
        if (isText(item.path)) return { path: item.path, content: new TextDecoder().decode(item.bytes) };
        return { path: item.path, contentBase64: toBase64(item.bytes) };
      });
      const response = await fetch("/api/public-deploy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "haxbro-upload", files })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok || !data.url) throw new Error(data.error || "The hosting provider did not return a public URL.");
      say("Published successfully · ");
      const link = document.createElement("a");
      link.href = data.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = data.url;
      link.style.color = "#e2e8f0";
      status.appendChild(link);
      publish.textContent = "Published ✓";
      if (window.HAxBROAppMakerReport) window.HAxBROAppMakerReport("Uploaded " + entries.length + " files to " + (data.hosting || "static hosting") + ".");
    } catch (error) {
      say("Publish failed: " + (error.message || "Unknown error"));
      publish.disabled = false;
      publish.textContent = "Publish to web ↗";
    }
  });
})();