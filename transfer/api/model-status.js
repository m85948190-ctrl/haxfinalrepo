export const access = "public";
export const methods = ["GET", "OPTIONS"];

function cors(res) {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "GET, OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type");
}

export default async function(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "GET required" });
  res.setHeader("cache-control", "no-store");
  const live = {
    auto: false, openrouter: false, groq: false, mistral: false,
    cerebras: false, google: false, openai: false, kai51: true,
    kai89: false, kaiLite: false
  };
  return res.json({
    ok: true,
    live,
    configured: { ...live },
    model: {
      name: "KAI 51 · Local Qwen3-0.6B",
      base: "Qwen/Qwen3-0.6B",
      browserRuntime: "@wllama/wllama 3.13.0 · llama.cpp WebAssembly with WebGPU acceleration and WASM fallback",
      format: "GGUF",
      quantization: "Q3_K_M",
      parameterClass: "0.5B (approximately 0.6B rounded)",
      approximateDownload: "about 347 MB (331 MiB)",
      inference: "Qwen3-0.6B on-device local inference only; no hosted LLM provider",
      devices: { laptop: "same Q3_K_M GGUF model", mobile: "same Q3_K_M GGUF model" },
      research: { sharedAcrossDevices: true, webSearch: ["Google", "Bing", "DuckDuckGo"], wikipedia: "search plus article-text extraction", webpageReading: "read-only browser extraction", synthesis: "local Qwen3-0.6B only after retrieval" },
      autoInstallOnVisit: true,
      browserCache: true,
      codingMode: true,
      fineTuning: { method: "PEFT/LoRA", status: "training pipeline prepared; fine-tuned weights not yet produced" }
    },
    readiness: "Local-only mode. Each browser reports Qwen readiness only after the local GGUF inference self-test."
  });
}