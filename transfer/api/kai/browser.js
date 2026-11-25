import { browser } from 'hatchable';

export const access = 'public';
export const methods = ['POST'];

function clean(value, max = 12000) {
  return String(value ?? '').replace(/\u0000/g, '').slice(0, max);
}
function normalizeUrl(value) {
  try {
    const u = new URL(value);
    if (!/^https?:$/i.test(u.protocol) || u.username || u.password) return '';
    const host = u.hostname.toLowerCase();
    if (host === 'localhost' || host === 'localhost.localdomain' || host.endsWith('.localhost') || host === '0.0.0.0' || host === '::1') return '';
    if (/^127\.(?:\d{1,3}\.){2}\d{1,3}$/.test(host) || /^10\.(?:\d{1,3}\.){2}\d{1,3}$/.test(host) || /^192\.168\.(?:\d{1,3}\.)\d{1,3}$/.test(host)) return '';
    const m = host.match(/^172\.(\d{1,3})\.(?:\d{1,3})\.(?:\d{1,3})$/);
    if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return '';
    if (host.startsWith('169.254.') || host.endsWith('.internal') || host.endsWith('.local') || host.startsWith('fc') || host.startsWith('fd')) return '';
    return u.toString();
  } catch { return ''; }
}
function sameSiteLinks(items, origin) {
  const out = [];
  const seen = new Set();
  for (const raw of Array.isArray(items) ? items : []) {
    try {
      const u = new URL(raw, origin);
      if (u.origin !== origin || !/^https?:$/.test(u.protocol)) continue;
      u.hash = '';
      if (/\.(?:pdf|zip|png|jpe?g|gif|webp|svg|mp4|mp3|woff2?|css|js)(?:$|\?)/i.test(u.pathname)) continue;
      if (seen.has(u.href)) continue;
      seen.add(u.href);
      out.push(u.href);
      if (out.length >= 30) break;
    } catch {}
  }
  return out;
}
export default async function(req, res) {
  const body = req.body || {};
  const url = normalizeUrl(body.url);
  const clickText = clean(body.clickText, 300).trim();
  const typeSelector = clean(body.typeSelector, 300).trim();
  const typeText = clean(body.typeText, 1200);
  const crawl = body.crawl === true;
  const maxPages = crawl ? Math.max(1, Math.min(6, Number(body.maxPages) || 5)) : 1;
  if (!url) return res.status(400).json({ ok:false, error:'A valid public http(s) URL is required.' });
  if (clickText.length > 300) return res.status(400).json({ ok:false, error:'clickText is too long.' });
  if (typeSelector && !typeText) return res.status(400).json({ ok:false, error:'typeText is required when typeSelector is provided.' });
  try {
    const result = await browser.session(async page => {
      const pages = [];
      const queue = [url];
      const visited = new Set();
      let firstLinks = [];
      while (queue.length && pages.length < maxPages) {
        const target = queue.shift();
        if (!target || visited.has(target)) continue;
        visited.add(target);
        try {
          await page.goto(target, { waitUntil:'domcontentloaded' });
          if (pages.length === 0 && typeSelector) {
            await page.waitForSelector(typeSelector, { timeout:10000 });
            await page.click(typeSelector);
            await page.type(typeSelector, typeText, { delay:20 });
          }
          if (pages.length === 0 && clickText) {
            const clicked = await page.evaluate(wanted => {
              const target = wanted.trim().toLowerCase();
              const candidates = Array.from(document.querySelectorAll('button,a,[role="button"],input[type="submit"],input[type="button"]'));
              const el = candidates.find(node => {
                const text = (node.innerText || node.textContent || node.value || '').trim().toLowerCase();
                return text === target || text.includes(target);
              });
              if (!el) return false;
              el.click();
              return true;
            }, clickText);
            if (!clicked) return { ok:false, url:await page.url(), title:await page.title(), error:'Could not find a clickable element matching: '+clickText };
            await new Promise(resolve => setTimeout(resolve, 700));
          }
          const title = await page.title();
          const finalUrl = await page.url();
          const text = await page.$eval('body', el => (el.innerText || el.textContent || '').trim().slice(0, 9000)).catch(() => '');
          const rawLinks = crawl ? await page.evaluate(() => Array.from(document.querySelectorAll('a[href]')).map(a => a.getAttribute('href')).filter(Boolean).slice(0,80)).catch(() => []) : [];
          const links = sameSiteLinks(rawLinks, new URL(finalUrl).origin);
          if (!firstLinks.length) firstLinks = links;
          pages.push({ url:finalUrl, title:clean(title,240), text:clean(text,9000), links:links.slice(0,30), status:'read' });
          if (crawl) {
            for (const link of links) {
              if (!visited.has(link) && !queue.includes(link) && queue.length + pages.length < maxPages) queue.push(link);
            }
          }
        } catch (error) {
          pages.push({ url:target, title:'', text:'', links:[], status:'unreadable', error:clean(error?.message || error,500) });
        }
      }
      return { ok:true, url:pages[0]?.url || url, title:pages[0]?.title || '', text:pages[0]?.text || '', links:firstLinks, pages, pagesRead:pages.filter(p=>p.status==='read').length, crawl };
    });
    res.json({
      kai:'KAI · READ-ONLY WEB TOOLS',
      ...result,
      note:'Only publicly accessible pages on the supplied site were read. No login, CAPTCHA bypass, or security-control evasion was attempted.'
    });
  } catch (error) {
    res.status(502).json({ ok:false, error:clean(error?.message || error,1200) });
  }
}