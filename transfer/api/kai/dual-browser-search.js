import { browser } from "hatchable";

export const access = "public";
export const methods = ["POST"];

const clean = (value, max = 9000) =>
  String(value ?? "").replace(/\u0000/g, "").replace(/\s+/g, " ").trim().slice(0, max);

const ENGINES = [
  { id: "andi", name: "Andi AI", url: "https://andisearch.com/" },
  { id: "aelius", name: "Aelius AI", url: "https://aeliusai.com/" }
];

async function researchWithBrowser(engine, query) {
  try {
    const result = await browser.session(async page => {
      await page.goto(engine.url, { waitUntil: "domcontentloaded" });
      await new Promise(resolve => setTimeout(resolve, 900));

      // Treat the page as an interface to operate, not a static search box.
      // Choose the ordinary chat path through visible onboarding controls, then
      // open a fresh chat. Never click sign-in, account creation, billing, or OAuth.
      if (engine.id === "aelius") {
        const clicked = await page.evaluate(() => {
          const visible = node => !!(node && (node.offsetWidth || node.offsetHeight || node.getClientRects().length));
          const buttons = Array.from(document.querySelectorAll("button,[role=button]")).filter(visible);
          const clickText = pattern => {
            const node = buttons.find(item => pattern.test((item.innerText || item.textContent || item.getAttribute("aria-label") || item.getAttribute("title") || "").replace(/\\s+/g, " ").trim()));
            if (!node) return false;
            node.click();
            return true;
          };
          // The first-run chooser offers several task modes; General AI is the
          // neutral option for a question that is not specifically coding/writing.
          const choseGeneral = clickText(/^General AI\\b/i);
          const continued = clickText(/^Continue$/i);
          const newChat = clickText(/^New chat$/i);
          const retry = document.querySelector("#appLoaderRetry");
          const retried = visible(retry) ? (retry.click(), true) : false;
          return { choseGeneral, continued, newChat, retried };
        });
        if (clicked.choseGeneral || clicked.continued || clicked.newChat || clicked.retried) {
          await new Promise(resolve => setTimeout(resolve, 1800));
        }
      }

      const controls = await page.evaluate(() => Array.from(
        document.querySelectorAll('input:not([type="password"]), textarea, [contenteditable="true"], [role="textbox"]')
      ).map((el, index) => ({
        index,
        tag: el.tagName.toLowerCase(),
        type: (el.getAttribute("type") || "").toLowerCase(),
        placeholder: el.getAttribute("placeholder") || "",
        aria: el.getAttribute("aria-label") || "",
        name: el.getAttribute("name") || "",
        id: el.id || "",
        role: el.getAttribute("role") || "",
        visible: !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length)
      })).filter(x => x.visible));

      const target = controls.find(x => /search|ask|question|message|chat|prompt/i.test(
        [x.placeholder, x.aria, x.name, x.id, x.role].join(" ")
      )) || controls.find(x => x.tag === "textarea") || controls.find(x => x.tag === "input");

      if (!target) {
        return {
          ok: false,
          engine: engine.name,
          url: await page.url(),
          title: await page.title(),
          error: "No visible search/chat input was found on the public page.",
          text: ""
        };
      }

      const selector = target.id ? "#" + target.id :
        target.name ? target.tag + '[name="' + target.name.replace(/"/g, '\\"') + '"]' :
        target.placeholder ? (target.tag === "div" ? '[contenteditable="true"]' : target.tag) + '[placeholder="' + target.placeholder.replace(/"/g, '\\"') + '"]' :
        target.aria ? target.tag + '[aria-label="' + target.aria.replace(/"/g, '\\"') + '"]' :
        target.tag + (target.type ? '[type="' + target.type + '"]' : "");

      await page.click(selector);
      await page.type(selector, query, { delay: 22 });

      // Prefer the visible submit control next to the composer; use Enter only as a fallback.
      const submitted = await page.evaluate(() => {
        const el = document.activeElement;
        const form = el?.closest("form");
        if (form) {
          const visible = node => !!(node.offsetWidth || node.offsetHeight || node.getClientRects().length);
          const buttons = Array.from(form.querySelectorAll('button,[role="button"],input[type="submit"]')).filter(visible);
          const button = buttons.find(node => /search|ask|send|go|submit/i.test((node.innerText || node.textContent || node.value || node.getAttribute("aria-label") || node.getAttribute("title") || "").trim()));
          if (button) { button.click(); return true; }
          if (typeof form.requestSubmit === "function") form.requestSubmit();
          else form.submit();
          return true;
        }
        const editor = el?.closest('[contenteditable="true"]') || el;
        let node = editor;
        for (let depth = 0; depth < 5 && node; depth++, node = node.parentElement) {
          const visible = item => !!(item.offsetWidth || item.offsetHeight || item.getClientRects().length);
          const buttons = Array.from(node.querySelectorAll('button,[role="button"],input[type="submit"]')).filter(visible);
          const button = buttons.find(item => /search|ask|send|go|submit/i.test((item.innerText || item.textContent || item.value || item.getAttribute("aria-label") || item.getAttribute("title") || "").trim()));
          if (button) { button.click(); return true; }
          if (buttons.length > 0 && buttons.length <= 3) { buttons[buttons.length - 1].click(); return true; }
        }
        return false;
      });
      if (!submitted) {
        try { await page.keyboard.press("Enter"); }
        catch { return { ok: false, engine: engine.name, url: await page.url(), title: await page.title(), error: "Could not submit the search through the page interface.", text: "" }; }
      }

      // Allow Andi's own search UI to render its answer and source cards.
      await new Promise(resolve => setTimeout(resolve, 4500));
      const pageData = await page.evaluate(() => {
        const text = (document.body?.innerText || document.body?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 9000);
        const links = Array.from(document.querySelectorAll("a[href]")).map(a => ({
          title: (a.innerText || a.textContent || "").replace(/\s+/g, " ").trim().slice(0, 180),
          url: a.href
        })).filter(a => a.title && /^https?:\/\//i.test(a.url) && !/andisearch\.com|aeliusai\.com/i.test(new URL(a.url).hostname))
          .filter((a, i, all) => all.findIndex(b => b.url === a.url) === i).slice(0, 10);
        return { text, links };
      });

      const useful = pageData.text.length > 120 &&
        !/enable javascript|checking your browser|captcha|access denied|couldn't start a guest session|sign in to continue|reload, or sign in/i.test(pageData.text.slice(-1200)) &&
        (pageData.links.length > 0 || /\/search|\/chat\//i.test(await page.url()));
      return {
        ok: useful,
        engine: engine.name,
        url: await page.url(),
        title: await page.title(),
        text: pageData.text,
        links: pageData.links,
        error: useful ? null : "The site did not expose a readable answer after browser submission."
      };
    });

    return result;
  } catch (error) {
    return {
      ok: false,
      engine: engine.name,
      url: engine.url,
      text: "",
      links: [],
      error: clean(error?.message || error, 700)
    };
  }
}

export default async function(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "POST required" });
  const query = clean(req.body?.query, 700);
  if (!query) return res.status(400).json({ ok: false, error: "query is required" });

  // Every provider call gets a fresh managed browser session. No browser cookies,
  // page state, or conversation state are intentionally shared across user requests.
  const results = await Promise.all(ENGINES.map(engine => researchWithBrowser(engine, query)));
  const successful = results.filter(result => result.ok && result.text);
  const sources = successful.flatMap(result => (result.links || []).map(link => ({
    ...link, engine: result.engine
  }))).filter((item, index, all) => all.findIndex(other => other.url === item.url) === index).slice(0, 16);

  return res.status(200).json({
    ok: successful.length > 0,
    query,
    mode: "isolated-browser-sessions",
    engines: results,
    sources,
    answerContext: successful.map(result => ({
      engine: result.engine,
      title: result.title,
      text: result.text,
      links: result.links
    })),
    note: "This endpoint uses public browser interfaces, not provider APIs. Results may be unavailable if a site blocks automated access or requires a login."
  });
}