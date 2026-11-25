import { browser } from "hatchable";
import { runSearch } from "lib/kai-web-search.js";
export const access="public";
export const methods=["POST"];

const clean=(v,n=5000)=>String(v??"").replace(/\u0000/g,"").replace(/\s+/g," ").trim().slice(0,n);

function extractLinks(html){
  const out=[];const s=String(html||"");let m;
  const re=/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  while((m=re.exec(s))&&out.length<8){
    let url=m[1].replace(/&amp;/g,"&");
    const title=clean(m[2].replace(/<[^>]+>/g," "));
    if(!title)continue;
    if(url.startsWith("/url?q="))try{url=decodeURIComponent(url.slice(7).split("&")[0])}catch{}
    if(url.startsWith("//"))url="https:"+url;
    if(/^https?:\/\//i.test(url)){
      try{const host=new URL(url).hostname;if(host.includes("google.")||host.includes("duckduckgo.")||host.includes("bing."))continue}catch{}
      if(!out.some(x=>x.url===url))out.push({title,url});
    }
  }
  return out;
}

const pageText=html=>clean(String(html||"").replace(/<(script|style|noscript|svg|nav|header|footer|aside)\b[\s\S]*?<\/\1>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,"<").replace(/&gt;/gi,">"),9000);

async function googleSearch(query){
  // Google's current public HTML response is JS-only in this server environment;
  // do not pretend its empty shell is a set of search results.
  const url="https://www.google.com/search?gbv=1&hl=en&q="+encodeURIComponent(query);
  const response=await fetch(url,{headers:{"user-agent":"Mozilla/5.0 (compatible; HAxBROResearch/1.0)"}});
  if(!response.ok)return [];
  const html=await response.text();
  if(/\/httpservice\/retry\/enablejs|unusual traffic|sorry\/index/i.test(html))return [];
  const blocks=html.match(/<div class=["']MjjYud["'][\s\S]*?(?=<div class=["']MjjYud["']|<\/body>)/gi)||[];
  return blocks.slice(0,6).map(block=>{
    const anchor=block.match(/<a[^>]+href=["']([^"']+)["'][^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>/i);
    if(!anchor)return null;
    return {title:htmlText(anchor[2]),url:anchor[1],text:htmlText(block)};
  }).filter(x=>x?.title&&/^https?:/i.test(x.url));
}

function queryVariants(query){
  const q=clean(query,700).trim();
  if(!q)return [];
  const stop=new Set(["what","when","where","which","why","who","how","is","are","was","were","the","a","an","and","or","for","to","of","in","on","at","by","with","from","about","please","tell","me","i","my","mine","you","your","yours","we","our","ours","they","them","their","explain","define","describe","show","give","can","could","would","will","should","does","do","did","become","became","build","search","web","sources","source","latest","current","today","recent","now","stable","use","using","multiple","real","websites","website","read","reading","relevant","pages","page","cite","cited","citations","citation","concise","answer","answers","summary","summarize","summarise","links","link","information","info"]);
  const tokens=q.match(/[\p{L}\p{N}][\p{L}\p{N}.'+-]*/gu)||[];
  const core=tokens.filter(token=>!stop.has(token.toLowerCase()));
  const concise=core.join(" ").trim();
  const compact=core.slice(0,5).join(" ").trim();
  const variants=[q,concise,compact].filter(Boolean);
  if(/^[a-z0-9][a-z0-9._-]{1,40}$/i.test(q))variants.push(`"${q}" meaning`,`"${q}" definition`);
  return [...new Set(variants.map(item=>item.trim()))].slice(0,3);
}

function decodeBingTarget(href){
  const value=String(href||"").replace(/&amp;/g,"&");
  const match=value.match(/[?&]u=a1([A-Za-z0-9_=-]+)/);
  if(match){
    try{
      const binary=atob(match[1].replace(/-/g,"+").replace(/_/g,"/"));
      const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
      const decoded=new TextDecoder().decode(bytes);
      if(/^https?:\/\//i.test(decoded))return decoded;
    }catch{}
  }
  try{const u=new URL(value);if(u.hostname.endsWith("bing.com"))return "";return u.href;}catch{return "";}
}
function htmlText(value){
  const decoded=String(value||"").replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,"<").replace(/&gt;/gi,">");
  return clean(decoded.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," "),1400);
}
async function bingSearch(query){
  const url="https://www.bing.com/search?q="+encodeURIComponent(query);
  const response=await fetch(url,{headers:{"user-agent":"Mozilla/5.0 (compatible; HAxBROResearch/1.0)"}});
  if(!response.ok)throw new Error("Bing search HTTP "+response.status);
  const html=await response.text();
  const blocks=String(html||"").match(/<li\s+class=["'][^"']*b_algo[^"']*["'][\s\S]*?(?=<li\s+class=["'][^"']*b_algo[^"']*["']|<\/ol>)/gi)||[];
  const out=[];const seen=new Set();
  for(const block of blocks){
    const anchor=block.match(/<h2[^>]*>\s*<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>\s*<\/h2>/i);
    if(!anchor)continue;
    const target=decodeBingTarget(anchor[1]);
    const title=htmlText(anchor[2]);
    if(!target||!title||seen.has(target))continue;
    seen.add(target);
    const paragraph=block.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    const text=paragraph?htmlText(paragraph[1]):"";
    out.push({title,url:target,text});
    if(out.length>=8)break;
  }
  // Bing sometimes serves a changed/JS-heavy HTML shell. Its RSS endpoint
  // provides the same public search results without relying on HTML classes.
  if(out.length<6){
    const rssUrl="https://www.bing.com/search?format=rss&q="+encodeURIComponent(query);
    const rssResponse=await fetch(rssUrl,{headers:{accept:"application/rss+xml, application/xml, text/xml","user-agent":"Mozilla/5.0 (compatible; HAxBROResearch/1.0)"}});
    if(rssResponse.ok){
      const xml=await rssResponse.text();
      const items=xml.match(/<item>[\s\S]*?<\/item>/gi)||[];
      for(const item of items){
        const titleMatch=item.match(/<title>([\s\S]*?)<\/title>/i);
        const linkMatch=item.match(/<link>([\s\S]*?)<\/link>/i);
        const descMatch=item.match(/<description>([\s\S]*?)<\/description>/i);
        const title=htmlText(titleMatch?.[1]||"");
        const target=decodeBingTarget(htmlText(linkMatch?.[1]||""));
        if(!title||!target||seen.has(target))continue;
        seen.add(target);
        out.push({title,url:target,text:htmlText(descMatch?.[1]||"")});
        if(out.length>=8)break;
      }
    }
  }
  return out;
}

async function googleNewsSearch(query){
  if(!/\b(news|latest|today|breaking|recent|release|released|announcement|announced|this week)\b/i.test(query))return [];
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),6500);
  try{
    const url="https://news.google.com/rss/search?q="+encodeURIComponent(query)+"&hl=en-IN&gl=IN&ceid=IN:en";
    const response=await fetch(url,{signal:controller.signal,headers:{accept:"application/rss+xml, application/xml, text/xml"}});
    if(!response.ok)return [];
    const xml=await response.text();
    const items=xml.match(/<item>[\s\S]*?<\/item>/gi)||[];
    return items.slice(0,12).map(item=>{
      const title=htmlText((item.match(/<title>([\s\S]*?)<\/title>/i)||[])[1]||"");
      const url=htmlText((item.match(/<link>([\s\S]*?)<\/link>/i)||[])[1]||"");
      const description=htmlText((item.match(/<description>([\s\S]*?)<\/description>/i)||[])[1]||"");
      const publishedAt=htmlText((item.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)||[])[1]||"");
      return title&&/^https?:\/\//i.test(url)?{title,url,text:description,publishedAt}:null;
    }).filter(Boolean);
  }catch{return []}finally{clearTimeout(timer)}
}

async function multiSearch(query,mode="fast"){
  // Keep the live chat search inside Hatchable's short function-execution window.
  // One real query is sent concurrently to independent engines; query expansion
  // and Wikipedia are intentionally omitted from this latency-critical path.
  // Give independent providers enough time to return useful results instead of
  // discarding them at 3.8s; deep mode gets a slightly wider window.
  const providerTimeout=mode==="deep"?9000:6500;
  const variants=queryVariants(query);
  const searchQuery=(variants[1]&&variants[1].length>=12)?variants[1]:query;
  const guarded=async task=>{
    let timer;
    try{return await Promise.race([task(),new Promise(resolve=>{timer=setTimeout(()=>resolve([]),providerTimeout);})]);}
    catch{return [];}
    finally{if(timer)clearTimeout(timer);}
  };
  const [googleResults,bingResults,ddgResults,newsResults]=await Promise.all([
    guarded(()=>googleSearch(searchQuery)),
    guarded(()=>bingSearch(searchQuery)),
    guarded(()=>ddgSearch(searchQuery)),
    guarded(()=>googleNewsSearch(searchQuery))
  ]);
  const terms=[...new Set((variants[1]||query).toLowerCase().match(/[a-z0-9]+(?:[.+-][a-z0-9]+)*/g)||[])].filter(term=>term.length>=3&&!["what","when","where","which","who","whom","whose","why","how","does","the","and","for","with","from","about","please","explain","latest","current","today","news","release","released","now","use","using","multiple","real","websites","website","read","reading","relevant","pages","page","cite","cited","links","link","search","sources","source","citations","citation","concise","answer","answers","summary","summarize","summarise"].includes(term));
  const collect=(rows,engine,limit)=> (rows||[]).filter(x=>{
    if(!x?.url)return false;
    if(!terms.length)return true;
    const hay=(String(x.title||"")+" "+String(x.text||"")+" "+String(x.url||"")).toLowerCase();
    const matches=terms.filter(term=>hay.includes(term)).length;
    return matches>=Math.min(2,terms.length);
  }).slice(0,limit).map(x=>({...x,engine}));
  const google=collect(googleResults,"Google Web",4);
  const bing=collect(bingResults,"Bing Web",5);
  const duckduckgo=collect(ddgResults,"DuckDuckGo Web",6);
  const news=collect(newsResults,"Google News",4);
  const merged=[],seen=new Set();
  for(let i=0;i<Math.max(google.length,bing.length,duckduckgo.length,news.length);i++){
    for(const x of [google[i],bing[i],duckduckgo[i],news[i]])if(x&&!seen.has(x.url)){seen.add(x.url);merged.push(x);}
  }
  return {links:merged.slice(0,10),engine:[google.length?"Google Web":"",bing.length?"Bing Web":"",duckduckgo.length?"DuckDuckGo Web":"",news.length?"Google News":""].filter(Boolean).join(" + ")||"No web search engine returned results",engines:{google:google.length,bing:bing.length,duckduckgo:duckduckgo.length,news:news.length}};
}

async function ddgSearch(query){
  // DuckDuckGo's public HTML results endpoint returns real website results;
  // its Instant Answer API often returns no results for ordinary searches.
  const url="https://html.duckduckgo.com/html/?q="+encodeURIComponent(query);
  const response=await fetch(url,{headers:{accept:"text/html,application/xhtml+xml","user-agent":"Mozilla/5.0 (compatible; HAxBROResearch/1.0)"}});
  if(!response.ok)throw new Error("DuckDuckGo Web HTTP "+response.status);
  const html=await response.text();
  const blocks=html.match(/<div class=["'][^"']*result__body[^"']*["'][\s\S]*?(?=<div class=["'][^"']*result__body|<\/body>)/gi)||[];
  const out=[];
  for(const block of blocks){
    const anchor=block.match(/<a\b([^>]*class=["'][^"']*result__a[^"']*["'][^>]*)>([\s\S]*?)<\/a>/i);
    if(!anchor)continue;
    const href=(anchor[1].match(/href=["']([^"']+)["']/i)||[])[1]||"";
    let target="";
    try{
      const parsed=new URL(href.startsWith("//")?"https:"+href:href,"https://duckduckgo.com");
      target=parsed.searchParams.get("uddg")||"";
      if(!/^https?:\/\//i.test(target))target=parsed.href;
    }catch{}
    if(!/^https?:\/\//i.test(target))continue;
    try{if(/(^|\.)duckduckgo\.com$/i.test(new URL(target).hostname))continue;}catch{continue;}
    const title=htmlText(anchor[2]);
    const snippetMatch=block.match(/<(?:a|div)[^>]*class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/(?:a|div)>/i);
    const snippet=htmlText(snippetMatch?.[1]||"");
    if(title&&!out.some(x=>x.url===target))out.push({title,url:target,text:snippet,engine:"DuckDuckGo Web"});
    if(out.length>=8)break;
  }
  return out;
}

async function wikipediaEvidence(query){
  const normalized=clean(query,300).replace(/^\s*(?:please\s+)?(?:what is|what are|who is|who are|where is|where are|tell me about|explain)\s+/i,"").replace(/\b(?:and|how|does|do|is|are|it|they|this|that|the|a|an|work|works|function|functions)\b/gi," ").replace(/[?!.]+$/,"").replace(/\s+/g," ").trim();
  const fetchSummary=async(title,timeout=1350)=>{
    const normalizedTitle=title.replace(/\s+/g,"_");
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeout);
    try{
      const endpoint="https://en.wikipedia.org/api/rest_v1/page/summary/"+encodeURIComponent(normalizedTitle);
      const r=await fetch(endpoint,{signal:controller.signal,headers:{accept:"application/json"}});
      if(r.ok){
        const item=await r.json();
        if(item?.extract&&item.type!=="disambiguation"){
          const summary={title:item.title||title,url:item.content_urls?.desktop?.page||("https://en.wikipedia.org/wiki/"+encodeURIComponent(String(item.title||title).replace(/ /g,"_"))),text:clean(item.extract,1800),engine:"Wikipedia",readStatus:"wikipedia-summary"};
          // A short REST summary is useful, but the answer model needs article context.
          // Read the rendered article when available and keep the summary if blocked.
          try{
            const html=await Promise.race([browser.html(summary.url),new Promise(resolve=>setTimeout(()=>resolve(""),3500))]);
            const full=pageText(html);
            const blocked=/captcha|access denied|security verification|checking your browser|enable javascript/i.test(full);
            if(!blocked&&full.length>summary.text.length+250)return {...summary,text:full.slice(0,9000),readStatus:"wikipedia-article"};
          }catch{}
          return summary;
        }
      }
    }catch{}finally{clearTimeout(timer)}
    /* Some server runtimes block direct Wikipedia API fetches. Use the managed
       browser session as a second retrieval transport rather than returning a
       page title with an empty body. */
    try{
      const pageResult=await Promise.race([
        browser.session(async page=>{
          await page.goto("https://en.wikipedia.org/wiki/"+encodeURIComponent(normalizedTitle),{waitUntil:"domcontentloaded"});
          return await page.evaluate(()=>{
            const title=document.querySelector("#firstHeading")?.innerText||document.title||"";
            const paragraphs=Array.from(document.querySelectorAll("#mw-content-text .mw-parser-output > p"))
              .map(p=>(p.innerText||p.textContent||"").replace(/\s+/g," ").trim())
              .filter(t=>t.length>45&&!/may refer to|disambiguation/i.test(t));
            return {title,text:paragraphs.slice(0,3).join(" ")};
          });
        }),
        new Promise(resolve=>setTimeout(()=>resolve(null),1800))
      ]);
      if(pageResult?.text&&pageResult.text.length>45)return {title:clean(pageResult.title||title,220),url:"https://en.wikipedia.org/wiki/"+encodeURIComponent(normalizedTitle),text:clean(pageResult.text,1800),engine:"Wikipedia"};
    }catch{}
    return null;
  };
  /* Try the exact article first; this is faster and more accurate for clean topics. */
  if(normalized&&normalized.split(/\s+/).length===1){
    const direct=await fetchSummary(normalized,1000);
    if(direct)return [direct];
  }
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),1500);
  try{
    const endpoint="https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch="+encodeURIComponent(normalized||query)+"&srlimit=4&format=json";
    const response=await fetch(endpoint,{signal:controller.signal,headers:{accept:"application/json"}});
    if(!response.ok)return [];
    const data=await response.json();
    const rows=Array.isArray(data?.query?.search)?data.query.search:[];
    const summaries=await Promise.all(rows.slice(0,3).map(row=>fetchSummary(String(row.title||""),1500)));
    const terms=normalized.toLowerCase().split(/\s+/).filter(w=>w.length>2&&!["the","and","for","with","from","what","who","when","where","how","current","latest","about"].includes(w));
    return summaries.filter(Boolean).map(x=>({...x,_score:terms.filter(t=>(x.title+" "+x.text).toLowerCase().includes(t)).length})).filter(x=>x._score>=(terms.length>=3?2:1)).sort((a,b)=>b._score-a._score).map(({_score,...x})=>x).slice(0,2);
  }catch{return []}finally{clearTimeout(timer)}
}

async function bingRenderedSearch(bingQuery){
  try{
    const result=await Promise.race([
      browser.session(async page=>{
        await page.goto("https://www.bing.com/search?q="+encodeURIComponent(query));
        try{await page.waitForSelector("li.b_algo h2 a",{timeout:3500})}catch{}
        return await page.evaluate(()=>{
          const rows=Array.from(document.querySelectorAll("#b_results li.b_algo, li.b_algo")).slice(0,10).map(item=>{
            const anchor=item.querySelector("h2 a");
            const title=(anchor?.textContent||anchor?.innerText||"").replace(/\\s+/g," ").trim();
            const url=anchor?.href||"";
            const snippet=(item.querySelector("p")?.textContent||item.querySelector("p")?.innerText||item.textContent||item.innerText||"").replace(/\\s+/g," ").trim();
            return title&&url?{title,url,text:snippet.slice(0,1400)}:null;
          }).filter(Boolean);
          const overviewNodes=Array.from(document.querySelectorAll("#b_content .b_ans, #b_content [data-tag*='answer'], #b_content [class*='ai_overview']"));
          const overview=overviewNodes.map(node=>(node.innerText||"").replace(/\\s+/g," ").trim()).find(value=>value.length>180)||"";
          return {results:rows,overview};
        });
      }),
      new Promise(resolve=>setTimeout(()=>resolve(null),5000))
    ]);
    if(!result)return {results:[],overview:""};
    return {
      results:(Array.isArray(result.results)?result.results:[]).map(row=>({...row,url:decodeBingTarget(row.url)})).filter(row=>row.url),
      overview:String(result.overview||"").slice(0,5000)
    };
  }catch{return {results:[],overview:""}}
}

export default async function(req,res){
  if(req.method!=="POST")return res.status(405).json({error:"POST required"});
  const query=clean(req.body?.query,700).replace(/\benormusk\b/gi,"Elon Musk");
  if(!query)return res.status(400).json({error:"query required"});
  const mode=req.body?.mode==="deep"?"deep":"fast";
  try{
    // Live search is the first operation for factual questions. Do not wait
    // for the separate Wikipedia enrichment lane: provider results are enough
    // to begin reading and synthesizing, and the old lane caused 503 timeouts.
    // Reuse HAxBRO's stable multi-provider RSS/HTML search endpoint. The older
    // inline Google/DDG parsers returned almost no results for ordinary comparisons.
    // Run the same multi-provider search implementation used by /api/web-search
    // directly in-process, avoiding an authenticated HTTP loopback.
    const bingQuery=query.toLowerCase().includes("elon musk")?"Elon Musk biography Zip2 PayPal Tesla SpaceX fortune":(queryVariants(query)[1]||query);
    const [searchAttempt,bingRendered]=await Promise.all([
      Promise.race([
        runSearch(bingQuery,mode,/\\b(news|latest|today|breaking|recent|release|announced)\\b/i.test(query)?"news":"web")
          .catch(error=>({status:502,body:{ok:false,error:clean(error?.message,240)}})),
        new Promise(resolve=>setTimeout(()=>resolve(null),60000))
      ]),
      bingRenderedSearch(bingQuery)
    ]);
    const searchData=searchAttempt?.body||{};
    const resultRows=Array.isArray(searchData.results)?searchData.results:(Array.isArray(searchData.sources)?searchData.sources:[]);
    const searched={
      links:resultRows.map(x=>({title:x.title,url:x.url,text:x.snippet||x.text||"",engine:x.provider||x.engine||"Web search",publishedAt:x.publishedAt||null})),
      engine:searchData.provider||"Multi-provider Web Search",
      engines:searchData.providers||searchData.engines||{}
    };
    // Bing's rendered Search page is a second retrieval route, not Copilot.
    // It can expose ordinary result snippets even when RSS/HTML providers fail.
    if(!searched.links.length&&bingRendered.results.length){
      searched.links=bingRendered.results.map(x=>({...x,engine:"Bing Search"}));
      searched.engine="Bing Search";
      searched.engines={bingSearchTab:searched.links.length};
    }
    // Some Bing Search queries expose an AI-generated overview directly on the
    // Search results page. Use it only when the rendered page actually contains it.
    if(bingRendered.overview){
      searched.links.unshift({
        title:"Bing Search AI Overview",
        url:"https://www.bing.com/search?q="+encodeURIComponent(query),
        text:bingRendered.overview,
        engine:"Bing Search AI Overview",
        readStatus:"bing-ai-overview"
      });
    }
    const wiki=[];
    const links=searched.links||[];
    const take=6;
    // Search engines often rank many same-publisher pages first (for example,
    // several Wikipedia articles). Diversify publisher domains BEFORE fetching,
    // otherwise the later de-duplication leaves only one usable source.
    const diverseLinks=[];
    const candidateHosts=new Set();
    for(const item of links){
      let host="";
      try{host=new URL(item.url).hostname.replace(/^www[.]/i,"").toLowerCase()}catch{}
      if(host&&!candidateHosts.has(host)){candidateHosts.add(host);diverseLinks.push(item)}
      if(diverseLinks.length>=take)break;
    }
    // Keep any remaining valid URLs only if the result set has fewer unique hosts.
    if(diverseLinks.length<take){
      for(const item of links){
        if(diverseLinks.length>=take)break;
        if(!diverseLinks.includes(item)&&/^https?:\/\//i.test(item.url||""))diverseLinks.push(item);
      }
    }
    // Read a ranked, cross-publisher set. Blocked pages remain labelled as snippets.
    const pages=await Promise.all(diverseLinks.map(async x=>{
      const snippet=clean(x.text||"",1400);
      if(x.readStatus==="bing-ai-overview")return {...x,text:snippet,readStatus:"bing-ai-overview"};
      try{
        const controller=new AbortController();
        const timer=setTimeout(()=>controller.abort(),2500);
        let html="";
        try{
          const response=await fetch(x.url,{signal:controller.signal,headers:{"user-agent":"Mozilla/5.0 (compatible; HAxBROResearch/1.0)","accept":"text/html,application/xhtml+xml"}});
          if(response.ok)html=await response.text();
        }finally{clearTimeout(timer)}
        const text=pageText(html);
        const blocked=/just a moment|security verification|verify (?:that )?you are not a bot|confirm you.?re not a robot|unusual traffic|captcha|checking your browser|enable javascript and cookies to continue|access denied|you don.?t have permission|restricted country|request blocked|forbidden|wikimedia error|too many requests|error 429|http 429|rate limit|complete the following challenge|select all squares|human verification|protection\. privacy|donor privacy policy|please donate|support wikipedia|wikipedia.{0,100}(?:donat|fundrais)|(?:donat|fundrais).{0,100}wikipedia/i.test(text);
        if(text.length>180&&!blocked)return {...x,searchSnippet:snippet,text:text.slice(0,9000),readStatus:"page-read"};
        return {...x,searchSnippet:snippet,text:snippet,readStatus:snippet?"search-snippet-fallback":"unreadable"};
      }catch{return {...x,searchSnippet:snippet,text:snippet,readStatus:snippet?"search-snippet-fallback":"unreadable"}}
    }));
    const terms=[...new Set((queryVariants(query)[1]||query).toLowerCase().match(/[a-z0-9]{3,}/g)||[])]
      .filter(term=>!["what","when","where","which","who","whom","whose","why","how","does","the","and","for","with","from","about","please","official","documentation","docs","latest","current","today","recent","news","search","web","source","sources","information","info","find","read","page","pages","website","using","use","compare","comparison","versus","about","i","so","can","could","will","became","become"].includes(term));
    // Keep the search engines' ranking, but require at least one meaningful
    // query term to appear in the title or retrieved text. This blocks obvious
    // numeric/version collisions (for example, Python 3.13 for a Wllama query).
    const relevantPages=terms.length?pages.map(item=>{
      const title=String(item.title||"").toLowerCase();
      const hay=(title+" "+String(item.text||item.searchSnippet||"")).toLowerCase();
      const titleHits=terms.filter(term=>title.includes(term)).length;
      const hits=terms.filter(term=>hay.includes(term)).length;
      return {...item,_relevance:titleHits*2+hits};
    }).filter(item=>item._relevance>=Math.min(4,terms.length)).sort((a,b)=>b._relevance-a._relevance).map(({_relevance,...item})=>item):pages;
    // A publisher-blocked page can still contribute its explicitly labelled
    // search snippet. The answer model is told this is a lead, not verified text.
    const combined=[...relevantPages,...wiki.map(x=>({...x,readStatus:x.readStatus||"wikipedia-article"}))].filter(x=>(x.text||x.title)&&["page-read","wikipedia-article","wikipedia-summary","search-snippet-fallback","bing-ai-overview"].includes(x.readStatus));
    const seen=new Set();
    const sources=combined.filter(x=>{
      let host="";
      try{host=new URL(x.url).hostname.replace(/^www[.]/i,"").toLowerCase();}catch{}
      if(!host||seen.has(host))return false;
      seen.add(host);return true;
    }).slice(0,take);
    // A single genuinely read independent page is still useful evidence.
    // Do not turn a partial but real retrieval into a total chat failure; disclose
    // the source count and let KAI qualify its answer instead of returning a 503.
    if(!sources.length)return res.json({ok:true,engine:searched.engine||"Web search unavailable",engines:searched.engines||{},mode,query,searchQueries:queryVariants(query),sourceCount:0,independentDomains:0,partial:true,searchUnavailable:true,warning:"No readable pages or usable search snippets were available. KAI should continue with general knowledge and disclose that live verification failed.",error:searchData.error||"No readable search evidence was returned.",diagnosticsDisabled:true,sources:[]});
    return res.json({ok:true,engine:[searched.engine,wiki.length?"Wikipedia":""].filter(Boolean).join(" + "),engines:searched.engines||{},mode,query,searchQueries:queryVariants(query),sourceCount:sources.length,independentDomains:sources.length,partial:sources.length<3,warning:sources.length<2?"Only one independent source was readable; KAI must disclose this limitation.":null,sources});
  }catch(e){
    return res.status(502).json({ok:false,error:"KAI web search unavailable",detail:clean(e?.message,300)});
  }
}