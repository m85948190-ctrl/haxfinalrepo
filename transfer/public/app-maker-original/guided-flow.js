(()=> {
const $=s=>document.querySelector(s),prompt=$("#prompt"),build=$("#build");
if(!prompt||!build)return;
const style=document.createElement("style");
style.textContent="#guidedAppFlow{display:none;margin:10px 0 14px;padding:11px;border:1px solid #dedede;border-radius:10px;background:#fff;color:#111}#guidedAppFlow .g-head{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:8px}#guidedAppFlow .g-kicker{font-size:9px;letter-spacing:.12em;color:#666;font-weight:750}#guidedAppFlow .g-count{font-size:9px;color:#777}#guidedAppFlow h3{font-size:14px;margin:3px 0 5px;font-weight:680}#guidedAppFlow .g-sub{font-size:11px;color:#666;margin:0 0 10px;line-height:1.4}#guidedAppFlow .g-questions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}#guidedAppFlow .g-question{min-width:0;border:1px solid #e2e2e2;border-radius:7px;padding:7px;background:#fff}#guidedAppFlow .g-question label{display:block;font-size:10px;font-weight:650;margin-bottom:5px;color:#333}#guidedAppFlow .g-question select{width:100%;min-width:0;height:30px;border:1px solid #ddd;border-radius:5px;background:#fff;color:#222;font:11px system-ui;padding:3px 5px}#guidedAppFlow .g-continue{margin-top:9px;border:1px solid #111;border-radius:6px;background:#111;color:#fff;padding:7px 11px;font:600 11px system-ui;cursor:pointer}#guidedAppFlow .g-options{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}#guidedAppFlow .g-option{min-width:0;border:1px solid #dedede;border-radius:8px;padding:6px;background:#fff;cursor:pointer;text-align:left;transition:border-color .15s,box-shadow .15s}#guidedAppFlow .g-option:hover{border-color:#888}#guidedAppFlow .g-option[aria-pressed=true]{border-color:#111;box-shadow:0 0 0 1px #111}#guidedAppFlow .g-preview{width:100%;height:104px;border:1px solid #e5e5e5;border-radius:5px;background:#f5f5f5;display:block;pointer-events:none}#guidedAppFlow .g-meta{display:flex;justify-content:space-between;gap:4px;align-items:center;margin-top:6px}#guidedAppFlow .g-name{font-size:10px;font-weight:700;display:block}#guidedAppFlow .g-desc{font-size:9px;color:#777;line-height:1.3;display:block;margin-top:3px;min-height:22px}#guidedAppMakerStatus{font-size:9px;color:#777;margin-top:8px}#guidedAppFlow .g-option .g-choice{font-size:8px;color:#777;letter-spacing:.04em;white-space:nowrap}#guidedAppFlow .g-option[aria-pressed=true] .g-choice{color:#111;font-weight:800}#guidedAppFlow .g-back{border:0;background:transparent;color:#555;font:10px system-ui;padding:0;cursor:pointer;margin:0 0 7px}@media(max-width:760px){#guidedAppFlow .g-questions{grid-template-columns:1fr}#guidedAppFlow .g-options{grid-template-columns:1fr}#guidedAppFlow .g-preview{height:120px}}";
document.head.appendChild(style);
const panel=document.createElement("section");panel.id="guidedAppFlow";panel.setAttribute("aria-live","polite");
const anchor=document.querySelector(".prompt-card");if(anchor)anchor.insertAdjacentElement("afterend",panel);
let currentQuery="",timer=0,stage="questions",answers={};
const catalog=()=>window.HAxBROTemplateFactory&&typeof window.HAxBROTemplateFactory.list==="function"?window.HAxBROTemplateFactory.list():[];
const norm=s=>String(s||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const tokens=s=>norm(s).split(/\s+/).filter(x=>x.length>1&&!["the","and","for","with","that","this","make","build","create","please","app","application","website","tool","platform","using","called","named","want","need","me","my","a","an","of","to","in","on","from","into","your"].includes(x));
function recommend(q){
 const list=catalog();if(!list.length)return [];
 const w=tokens(q),raw=norm(q),has=re=>re.test(raw);
 const categoryRules=[{cat:"ai",re:/\b(ai|artificial intelligence|chatbot|assistant|copilot|llm|agent|prompt)\b/},{cat:"developer",re:/\b(code|developer|api|database|ide|repository|programming|automation)\b/},{cat:"business",re:/\b(crm|customer|sales|business|employee|hr|team|company)\b/},{cat:"finance",re:/\b(finance|budget|expense|money|bank|payment|invoice|tax|portfolio)\b/},{cat:"education",re:/\b(school|student|course|learning|quiz|exam|teacher|education|class)\b/},{cat:"commerce",re:/\b(shop|store|ecommerce|marketplace|product|cart|order|selling)\b/},{cat:"productivity",re:/\b(project|task|planner|workflow|calendar|schedule|habit)\b/},{cat:"social",re:/\b(social|community|forum|messaging|chat|network|feed)\b/},{cat:"media",re:/\b(video|music|podcast|photo|gallery|media|stream|editor)\b/},{cat:"travel",re:/\b(travel|hotel|flight|restaurant|booking|trip|reservation)\b/},{cat:"fitness",re:/\b(fitness|gym|workout|meal|diet)\b/}];
 const cat=categoryRules.find(x=>x.re.test(raw))?.cat;
 const aiWorkspace=has(/\b(ai|artificial intelligence)\b/)&&has(/\b(workspace|workbench|studio|assistant|chat|copilot)\b/);
 const aiAgent=has(/\b(agent|workflow|automation)\b/)&&has(/\b(ai|assistant|agent)\b/);
 const aiWriter=has(/\b(write|writing|writer|content|copywriting)\b/)&&has(/\b(ai|assistant|studio)\b/);
 const aiImage=has(/\b(image|picture|art|design|visual)\b/)&&has(/\b(ai|generator|studio)\b/);
 const scored=list.map(t=>{
  const text=norm([t.name,t.description,t.category,t.layout,t.kind].join(" "));
  let score=0;w.forEach(word=>{if(text.includes(word))score+=3});
  if(cat&&t.category===cat)score+=5;
  if(aiWorkspace){if(t.id==="pro-021")score+=60;if(t.id==="ai-black")score+=34;if(t.id==="ai-blue")score+=32;if(t.id==="ai-gradient")score+=25;if(t.id==="chatbot")score+=22;}
  if(aiAgent){if(t.id==="pro-022")score+=65;if(t.id==="ai-agent")score+=45;}
  if(aiWriter&&t.id==="writer")score+=65;
  if(aiImage&&t.id==="pro-029")score+=65;
  if(has(/\b(chat|chatbot|conversation|messaging)\b/)&&t.id==="pro-021")score+=28;
  if(has(/\b(customer support|support desk|helpdesk|ticket)\b/)&&t.id==="pro-008")score+=50;
  if(has(/\b(api tester|api testing|request tester)\b/)&&t.id==="pro-030")score+=55;
  if(has(/\b(online ide|code editor|coding workspace)\b/)&&t.id==="pro-024")score+=55;
  if(has(/\b(database|sql|records|tables)\b/)&&t.id==="pro-026")score+=55;
  if(has(/\b(crm|customer relationship|leads)\b/)&&t.id==="pro-002")score+=55;
  if(has(/\b(ecommerce|online store|shopping|shop)\b/)&&t.id==="pro-011")score+=55;
  if(has(/\b(invoice|billing|payment portal)\b/)&&t.id==="pro-005")score+=55;
  if(has(/\b(analytics|metrics|kpi)\b/)&&t.id==="pro-001")score+=55;
  return {t,score};
 }).sort((a,b)=>b.score-a.score);
 return scored.slice(0,3).map(x=>x.t);
}
function enrichedQuery(){return [currentQuery,answers.audience,answers.goal,answers.style].filter(Boolean).join(" ");}
function choose(t,button){
 window.HAxBROGuidedTemplateChoice={id:t.id,name:t.name,category:t.category,kind:t.kind,layout:t.layout,query:currentQuery};
 panel.querySelectorAll(".g-option").forEach(el=>{const active=el===button;el.setAttribute("aria-pressed",String(active));const label=el.querySelector(".g-choice");if(label)label.textContent=active?"SELECTED":"SELECT";});
 const note=$("#guidedAppMakerStatus");if(note)note.textContent="Selected: "+t.name+". Press Build Product to create this version.";
}
function showQuestions(){
 stage="questions";window.HAxBROGuidedTemplateChoice=null;
 panel.innerHTML='<div class="g-head"><span class="g-kicker">QUICK PROJECT BRIEF</span><span class="g-count">STEP 1 OF 2</span></div><h3>Let’s clarify what you’re building</h3><p class="g-sub">A few quick choices help KAI shape the right starting point.</p><div class="g-questions"><div class="g-question"><label for="gAudience">Who is it for?</label><select id="gAudience"><option value="Personal use">Just me</option><option value="A team">A team</option><option value="Customers">Customers</option><option value="The public">The public</option></select></div><div class="g-question"><label for="gGoal">Main purpose?</label><select id="gGoal"><option value="Organize work and information">Organize work</option><option value="Communicate and collaborate">Communicate</option><option value="Sell products or services">Sell or manage</option><option value="Create, analyse and automate">Create and automate</option></select></div><div class="g-question"><label for="gStyle">Preferred experience?</label><select id="gStyle"><option value="Professional minimal interface">Professional minimal</option><option value="Simple and beginner friendly">Simple and clear</option><option value="Feature rich workspace">Feature-rich</option></select></div></div><button type="button" class="g-continue" id="gContinue">Continue to previews</button>';
 panel.style.display="block";
 $("#gContinue").addEventListener("click",()=>{
  answers={audience:$("#gAudience").value,goal:$("#gGoal").value,style:$("#gStyle").value};
  showPreviews();
 });
}
function showPreviews(){
 stage="previews";
 const options=recommend(enrichedQuery());if(!options.length){panel.innerHTML='<p class="g-sub">I could not find a close starting point. Add a little more detail to your idea and try again.</p><button type="button" class="g-back" id="gBack">← Edit answers</button>';$("#gBack").addEventListener("click",showQuestions);return;}
 panel.innerHTML='<button type="button" class="g-back" id="gBack">← Edit answers</button><div class="g-head"><span class="g-kicker">MATCHED DESIGN DIRECTIONS</span><span class="g-count">STEP 2 OF 2 · 3 PREVIEWS</span></div><h3>Which of the following best matches your idea?</h3><p class="g-sub">Choose the closest layout. KAI will use it as the starting point for your build.</p><div class="g-options" id="gTemplateChoices"></div><div id="guidedAppMakerStatus">Recommended match selected. You can choose another preview.</div>';
 $("#gBack").addEventListener("click",showQuestions);
 const choices=$("#gTemplateChoices");
 options.forEach((t,index)=>{
  const button=document.createElement("button");button.type="button";button.className="g-option";button.setAttribute("aria-pressed","false");
  const iframe=document.createElement("iframe");iframe.className="g-preview";iframe.title=t.name+" preview";iframe.setAttribute("sandbox","allow-scripts");iframe.loading="lazy";
  try{const spec=window.HAxBROTemplateFactory.render(t.id,t.name,"Studio Light");const html=spec?.files?.find(f=>/index\.html$/i.test(f.path))?.content||spec?.files?.[0]?.content||"";iframe.srcdoc=html||"<p>Preview unavailable</p>";}catch(e){iframe.srcdoc="<body style='font:12px system-ui;padding:14px;color:#555'>Preview unavailable.</body>";}
  const meta=document.createElement("span");meta.className="g-meta";
  const title=document.createElement("span");title.className="g-name";title.textContent=t.name;
  const label=document.createElement("span");label.className="g-choice";label.textContent=index===0?"RECOMMENDED":"SELECT";
  meta.append(title,label);
  const desc=document.createElement("span");desc.className="g-desc";desc.textContent=t.description||"A matching starting layout, ready to customise.";
  button.append(iframe,meta,desc);button.addEventListener("click",()=>choose(t,button));choices.appendChild(button);
  if(index===0)choose(t,button);
 });
}
function render(){const q=prompt.value.trim();if(q.length<3){panel.style.display="none";panel.replaceChildren();currentQuery="";answers={};stage="questions";window.HAxBROGuidedTemplateChoice=null;return;}if(q!==currentQuery){currentQuery=q;answers={};showQuestions();}}
function schedule(){clearTimeout(timer);timer=setTimeout(render,250);}
prompt.addEventListener("input",schedule);prompt.addEventListener("change",render);
build.addEventListener("click",e=>{if(currentQuery!==prompt.value.trim())render();if(stage!=="previews"||!window.HAxBROGuidedTemplateChoice){e.preventDefault();e.stopImmediatePropagation();if(stage==="questions"){const note=document.createElement("p");note.textContent="Answer the quick questions and choose a preview before building.";note.style.cssText="font:11px system-ui;color:#555;margin:7px 0";const old=panel.querySelector(".g-validation");if(old)old.remove();note.className="g-validation";panel.appendChild(note);}return;}},true);
if(prompt.value.trim())render();
})();