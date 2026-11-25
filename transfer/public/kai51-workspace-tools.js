(() => {
  const clean = value => String(value || "").trim();
  const safeUrl = value => {
    const m = String(value || "").match(/https?:\/\/[^\s<>"']+/i);
    return m ? m[0].replace(/[),.;!?]+$/,"") : "";
  };
  async function route(raw) {
    const text = clean(raw);
    if (!text) return false;
    if (/^(?:how|what|why|when|where|can you explain|tell me how)\b/i.test(text) && !/\b(?:make me|build me|create me|generate|open|launch|show)\b/i.test(text)) return false;
    const lower = text.toLowerCase();
    const build = /\b(make|build|create|develop|design|generate|forge|ship|write)\b/i.test(text);
    const app = build && /\b(app|application|website|web\s*app|dashboard|portal|platform|saas|pwa|mobile\s+app|desktop\s+app|game|assistant|agent|bot|tracker|calculator|converter|monitor|generator)\b/i.test(text);
    const openApp = /\b(open|launch|show)\b[\s,]*(?:the\s+)?app\s*maker\b/i.test(text) || (/\bapp\s*maker\b/i.test(text) && !/^(what|why|how|tell|explain)\b/i.test(text));
    const openFile = /\b(open|launch|show)\b[\s,]*(?:the\s+)?file\s*creator\b/i.test(text);
    const file = (build || openFile) && /\b(pdf|pptx|powerpoint|presentation|zip(?:\s+file)?|document|file\s*creator|file)\b/i.test(text);
    const openDecoder = /\b(open|launch|show)\b[\s,]*(?:the\s+)?decoder\b/i.test(text);
    const decode = /\b(decode|decoder|decrypt|decipher|decoding|ciphertext|encoded|rot13|base64|hex|morse|binary|atbash|caesar|vigenere|rail\s*fence|a1z26)\b/i.test(text);
    const openEncoder = /\b(open|launch|show)\b[\s,]*(?:the\s+)?encoder\b/i.test(text);
    const encode = /\b(encode|encoder|encrypt|encryption)\b/i.test(text);
    const openCode = /\b(open|launch|show)\b[\s,]*(?:the\s+)?code\s*writer\b/i.test(text);
    const code = (build || openCode) && /\b(code|program|script|html|css|javascript|typescript|python|sql|bash|react|function|class|api|code\s*writer)\b/i.test(text);
    const xpro = /\b(x\s*pro|deepx|expert\s+mode|expert\s+analysis|inspect\s+website|scan\s+website|security\s+audit)\b/i.test(text);
    const url = safeUrl(text);
    const investigate = !!url && /\b(investigate|inspect|scan|analy[sz]e|audit|x-?ray|source\s+code|website\s+report|web\s+report)\b/i.test(text);

    if (app || openApp) {
      try { sessionStorage.setItem("haxbro_app_intent_context", JSON.stringify(window.HAxBROChatHistory || [])); } catch {}
      if (window.HAxBROFutureMaker?.open) await window.HAxBROFutureMaker.open(openApp ? "" : text, !openApp);
      else window.dispatchEvent(new CustomEvent("haxbro:open-app-maker", {detail:{prompt:text,autoBuild:!openApp}}));
      return true;
    }
    if (file || openFile) {
      if (window.HAxBROOpenFileCreator) window.HAxBROOpenFileCreator(openFile ? "" : text,!openFile);
      else document.getElementById("fileCreatorBtn")?.click();
      return true;
    }
    if (decode) {
      const payload = openDecoder ? "" : (text.replace(/^.*?\b(?:decode|decipher|decrypt|decoding)\b[:\s-]*/i,"").trim() || text);
      if (window.HAxBRODecodingPartner?.openWithInput) await window.HAxBRODecodingPartner.openWithInput(payload);
      else window.dispatchEvent(new CustomEvent("haxbro:open-decoder",{detail:{input:payload}}));
      return true;
    }
    if (encode) {
      const payload = openEncoder ? "" : text.replace(/^.*?\b(?:encode|encoder|encrypt|encryption)\b[:\s-]*/i,"").trim();
      if (window.HAxBRODecodingPartner?.openEncrypt) await window.HAxBRODecodingPartner.openEncrypt(payload);
      else window.dispatchEvent(new CustomEvent("haxbro:open-decoder",{detail:{input:payload,mode:"encrypt"}}));
      return true;
    }
    if (xpro || investigate) {
      if (window.HAxBRODeepX?.openWithTarget) window.HAxBRODeepX.openWithTarget(url,{research:!!url});
      else window.dispatchEvent(new CustomEvent("haxbro:open-xpro",{detail:{target:url,research:!!url}}));
      return true;
    }
    if (code) {
      if (window.HAxBROOpenCodeWriter) window.HAxBROOpenCodeWriter(openCode ? "" : text,!openCode);
      else document.getElementById("codeWriterBtn")?.click();
      return true;
    }
    return false;
  }
  window.HAxBROKai51WorkspaceTools = Object.freeze({
    version:"workspace-tools-v1",
    route,
    capabilities:["web search","read-only managed browser","App Maker","Code Writer","File Creator (PDF/PPTX/ZIP)","Decoder","Encoder","X Pro / DeepX website analysis"]
  });
})();