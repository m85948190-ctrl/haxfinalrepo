(() => {
  const ua = String(navigator.userAgent || "");
  const mobileHint = navigator.userAgentData?.mobile === true;
  const handheld = mobileHint || /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(ua);
  const ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  window.HAxBRO_DEVICE = handheld ? (ios ? "ios" : "android") : "desktop";
  window.HAxBRODeviceProfile = Object.freeze({
    device: window.HAxBRO_DEVICE,
    isPhone: handheld,
    isDesktop: !handheld,
    model: "Qwen3-0.6B · Q4_K_M GGUF",
    downloadLabel: "about 379 MB · one shared local model on every device"
  });
  document.documentElement.dataset.haxbroDevice = window.HAxBRO_DEVICE;
})();