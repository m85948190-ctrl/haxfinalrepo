const clean = (value, max = 700) => String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const NEWS_WORDS = /\b(news|latest|today|breaking|recent|this week|this month|announced|announcement|release|released|update|updates|launch|launched|election|results|stock|market|weather)\b/i;
const STOP = new Set(["what","when","where","which","who","whom","whose","why","how","does","do","did","is","are","was","were","the","a","an","and","or","for","to","of","in","on","at","by","with","from","about","please","tell","show","me","i","my","mine","you","your","yours","we","our","ours","they","them","their","can","could","would","will","should","become","became","build","explain","find","search","look","up","latest","current","recent","today","news","updates","update","information","info","all","some","best","good"]);

function decodeEntities(value) {
  return String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&apos;|&#39;/gi, "'")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&nbsp;/gi, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}
function xmlTag(item, tag) {
  const match = String(item || "").match(new RegExp("<" + tag + "(?:\\s[^>]*)?>([\\s\\S]*?)<\\/" + tag + ">", "i"));
  return clean(decodeEntities(match?.[1] || ""), tag === "description" ? 1800 : 500);
}
function normalizeUrl(value) {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    url.hash = "";
    for (const key of ["utm_source","utm_medium","utm_campaign","utm_term","utm_content","oc","c","form","ref"]) url.searchParams.delete(key);
    return url.href;
  } catch { return ""; }
}
function unwrapBingUrl(value) {
  let url = normalizeUrl(decodeEntities(value));
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if (parsed.hostname.endsWith("bing.com")) {
      const target = parsed.searchParams.get("url");
      if (target) url = normalizeUrl(target);
      else {
        const token = parsed.searchParams.get("u") || "";
        if (token.startsWith("a1")) {
          try {
            const raw = atob(token.slice(2).replace(/-/g, "+").replace(/_/g, "/"));
            const decoded = new TextDecoder().decode(Uint8Array.from(raw, c => c.charCodeAt(0)));
            url = normalizeUrl(decoded) || "";
          } catch {}
        }
      }
    }
  } catch {}
  return url;
}
function queryPlan(query) {
  const original = clean(query);
  const tokens = original.match(/[\p{L}\p{N}][\p{L}\p{N}.'+-]*/gu) || [];
  const coreTokens = tokens.filter(token => !STOP.has(token.toLowerCase()));
  const core = coreTokens.join(" ").trim();
  const plan = [original];
  if (core && core.toLowerCase() !== original.toLowerCase()) plan.push(core);
  if (coreTokens.length >= 4) {
    const compact = coreTokens.slice(0, Math.min(5, coreTokens.length)).join(" ");
    if (!plan.some(item => item.toLowerCase() === compact.toLowerCase())) plan.push(compact);
  }
  return [...new Set(plan)].slice(0, 3);
}
function relevance(result, query) {
  const words = [...new Set((query.match(/[\p{L}\p{N}]{3,}/gu) || []).filter(w => !STOP.has(w.toLowerCase())))];
  if (!words.length) return 1;
  const title = String(result.title || "").toLowerCase();
  const snippet = String(result.snippet || "").toLowerCase();
  const url = String(result.url || "").toLowerCase();
  const haystack = title + " " + snippet + " " + url;
  const matches = words.filter(word => haystack.includes(word.toLowerCase())).length;
  const titleMatches = words.filter(word => title.includes(word.toLowerCase())).length;
  let host = "";
  try { host = new URL(result.url).hostname.replace(/^www\./, "").toLowerCase(); } catch {}
  const authoritative = /(?:^|\.)(?:gov|gov\.in|edu|edu\.in|ac\.in)$/.test(host) ||
    /^(?:docs?|developer|support|learn|api)\./.test(host) ||
    /(?:^|\.)(?:github\.com|ietf\.org|w3\.org|developer\.mozilla\.org)$/.test(host);
  const lowSignal = /(?:^|\.)(?:pinterest|facebook|instagram|tiktok|quora)\.com$/.test(host);
  const coverage = matches / words.length;
  const titleCoverage = titleMatches / words.length;
  const phrase = words.length > 1 && title.includes(words.slice(0, Math.min(3, words.length)).join(" "));
  return coverage * 2 + titleCoverage * 1.25 + (phrase ? 0.55 : 0) + (authoritative ? 0.45 : 0) - (lowSignal ? 0.45 : 0);
}
async function fetchText(url, timeout = 4000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "accept": "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8", "user-agent": "Mozilla/5.0 (compatible; HAxBRO-WebSearch/1.0)" }
    });
    if (!response.ok) throw new Error("HTTP " + response.status);
    return await response.text();
  } finally { clearTimeout(timer); }
}
async function bingWeb(query) {
  const url = "https://www.bing.com/search?format=rss&q=" + encodeURIComponent(query);
  const xml = await fetchText(url);
  return (xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) || []).map(item => {
    const title = xmlTag(item, "title");
    const target = unwrapBingUrl(xmlTag(item, "link"));
    const snippet = xmlTag(item, "description");
    const publishedAt = xmlTag(item, "pubDate");
    if (!title || !target) return null;
    return { title, url: target, snippet, publishedAt: publishedAt || null, provider: "Bing Web" };
  }).filter(Boolean);
}
async function bingNews(query) {
  const url = "https://www.bing.com/news/search?format=rss&q=" + encodeURIComponent(query);
  const xml = await fetchText(url);
  return (xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) || []).map(item => {
    const title = xmlTag(item, "title");
    const target = unwrapBingUrl(xmlTag(item, "link"));
    const snippet = xmlTag(item, "description");
    const publishedAt = xmlTag(item, "pubDate");
    if (!title || !target) return null;
    return { title, url: target, snippet, publishedAt: publishedAt || null, provider: "Bing News" };
  }).filter(Boolean);
}
async function ddgWeb(query) {
  const url = "https://html.duckduckgo.com/html/?q=" + encodeURIComponent(query);
  const response = await fetch(url, { headers: { accept: "text/html,application/xhtml+xml", "user-agent": "Mozilla/5.0 (compatible; HAxBRO-WebSearch/1.0)" } });
  if (!response.ok) throw new Error("DuckDuckGo Web HTTP " + response.status);
  const html = await response.text();
  const blocks = html.match(/<div class=["'][^"']*result__body[^"']*["'][\s\S]*?(?=<div class=["'][^"']*result__body|<\/body>)/gi) || [];
  return blocks.map(block => {
    const anchor = block.match(/<a\b([^>]*class=["'][^"']*result__a[^"']*["'][^>]*)>([\s\S]*?)<\/a>/i);
    if (!anchor) return null;
    const href = (anchor[1].match(/href=["']([^"']+)["']/i) || [])[1] || "";
    let target = "";
    try {
      const parsed = new URL(href.startsWith("//") ? "https:" + href : href, "https://duckduckgo.com");
      target = parsed.searchParams.get("uddg") || parsed.href;
    } catch {}
    target = normalizeUrl(target);
    if (!target) return null;
    try { if (/(^|\.)duckduckgo\.com$/i.test(new URL(target).hostname)) return null; } catch { return null; }
    const title = clean(decodeEntities(anchor[2].replace(/<[^>]+>/g, " ")), 240);
    const snippetMatch = block.match(/<(?:a|div)[^>]*class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/(?:a|div)>/i);
    const snippet = clean(decodeEntities((snippetMatch?.[1] || "").replace(/<[^>]+>/g, " ")), 1800);
    return title ? { title, url: target, snippet, provider: "DuckDuckGo Web" } : null;
  }).filter(Boolean).slice(0, 10);
}
function dedupe(rows) {
  const seen = new Set(), output = [];
  for (const row of rows) {
    const url = normalizeUrl(row.url);
    if (!url) continue;
    let host = "";
    try { host = new URL(url).hostname.replace(/^www\./, ""); } catch {}
    const key = host + new URL(url).pathname.replace(/\/$/, "").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push({ ...row, url });
  }
  return output;
}


async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "POST required" });
  const query = clean(req.body?.query);
  if (!query) return res.status(400).json({ ok: false, error: "Enter a search query." });
  if (query.length < 2) return res.status(400).json({ ok: false, error: "Search query is too short." });
  const mode = req.body?.mode === "deep" ? "deep" : "fast";
  const wantNews = req.body?.type === "news" || NEWS_WORDS.test(query);
  const plan = queryPlan(query);
  const providerErrors = [];
  const tasks = plan.flatMap(q => [
    (async () => {
      try { return await bingWeb(q); }
      catch (error) { providerErrors.push({ provider: "Bing Web", query: q, error: clean(error?.message, 160) }); return []; }
    })(),
    (async () => {
      try { return await ddgWeb(q); }
      catch (error) { providerErrors.push({ provider: "DuckDuckGo Web", query: q, error: clean(error?.message, 160) }); return []; }
    })()
  ]);
  if (wantNews) {
    const newsQuery = plan[1] || plan[0];
    tasks.push((async () => {
      try { return await bingNews(newsQuery); }
      catch (error) { providerErrors.push({ provider: "Bing News", query: newsQuery, error: clean(error?.message, 160) }); return []; }
    })());
  }
  const batches = await Promise.all(tasks);
  const rawAll = batches.flat();
  const freshnessIntent = /\b(latest|today|breaking|recent|this week|this month|current|right now)\b/i.test(query);
  const raw = freshnessIntent ? rawAll.filter(row => {
    if (row.provider !== "Bing News" || !row.publishedAt) return true;
    const published = Date.parse(row.publishedAt);
    return !Number.isFinite(published) || published >= Date.now() - 365 * 24 * 60 * 60 * 1000;
  }) : rawAll;
  const ranked = dedupe(raw).map(row => ({ ...row, _score: relevance(row, query) }))
    .filter(row => row._score >= (query.split(/\s+/).length >= 4 ? 0.35 : 0.25))
    .sort((a, b) => b._score - a._score);
  const limit = mode === "deep" ? 20 : 12;
  const results = ranked.slice(0, limit).map(({ _score, ...row }, index) => ({ ...row, rank: index + 1, snippet: clean(row.snippet, 1800) }));
  if (!results.length) {
    return res.status(502).json({
      ok: false, query, count: 0, results: [], sources: [],
      error: "The web search providers did not return usable website results. Try a shorter or more specific query.",
      providers: { bingWeb: 0, bingNews: 0 }, providerErrors
    });
  }
  const providerCounts = {
    bingWeb: results.filter(row => row.provider === "Bing Web").length,
    duckduckgoWeb: results.filter(row => row.provider === "DuckDuckGo Web").length,
    bingNews: results.filter(row => row.provider === "Bing News").length
  };
  return res.json({
    ok: true, query, mode, searchQueries: plan,
    provider: [providerCounts.bingWeb ? "Bing Web" : "", providerCounts.duckduckgoWeb ? "DuckDuckGo Web" : "", providerCounts.bingNews ? "Bing News" : ""].filter(Boolean).join(" + "),
    providers: providerCounts, count: results.length,
    results, sources: results,
    partial: results.length < 5,
    warning: results.length < 5 ? "Fewer than five distinct websites were found for this query." : null,
    providerErrors
  });
}

export async function runSearch(query, mode = "fast", type = "web") {
  const req = { method: "POST", body: { query, mode, type } };
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { return { status: this.statusCode, body }; }
  };
  return await handler(req, res);
}