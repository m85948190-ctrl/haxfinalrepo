(function(){
"use strict";
const VERSION="1.0.0";
const WORDS={
 store:["ecommerce","e commerce","online store","shop","shopping cart","product catalog","product listing","checkout","inventory store"],
 crm:["crm","customer relationship","lead tracker","sales pipeline","manage leads","client management","customer manager"],
 tracker:["todo","to do","task manager","task tracker","habit tracker","daily planner","project tracker","kanban","checklist"],
 dashboard:["dashboard","admin panel","analytics","control panel","reporting dashboard","management dashboard"],
 portfolio:["portfolio","personal website","developer site","designer site","case studies"],
 landing:["landing page","marketing website","business website","company website","website","web site","web app","web application","frontend","front end","browser app"],
 python:["python",".py","command line","cli","terminal","script","automation script"]
};
const FEATURE_MAP=[
 ["authentication",/\b(login|log in|sign in|sign up|register|account|authentication|auth)\b/],
 ["roles and permissions",/\b(admin role|roles|permissions|role based|access control)\b/],
 ["database or persistent storage",/\b(database|persistent|save data|store data|records|sqlite|postgres|mysql)\b/],
 ["search and filtering",/\b(search|filter|find|sort)\b/],
 ["create, edit and delete records",/\b(add|create|edit|update|delete|remove|manage)\b/],
 ["analytics and metrics",/\b(analytics|metrics|statistics|stats|charts|graphs|kpi|reports|reporting)\b/],
 ["export and import",/\b(export|download|csv|excel|import|upload file)\b/],
 ["notifications",/\b(notification|notify|reminder|alert|email)\b/],
 ["payments",/\b(payment|payments|checkout|billing|subscription|stripe|upi)\b/],
 ["calendar and scheduling",/\b(calendar|schedule|booking|appointment|availability|events)\b/],
 ["messaging",/\b(chat|messaging|messages|inbox|comments)\b/],
 ["file handling",/\b(file upload|upload files|file manager|documents|attachments)\b/],
 ["responsive interface",/\b(mobile|responsive|phone|tablet)\b/]
];
const PAGE_MAP=[
 ["Dashboard",/\b(dashboard|overview|home screen|summary)\b/],
 ["User management",/\b(user management|manage users|users|accounts)\b/],
 ["Products",/\b(products|catalog|inventory|items)\b/],
 ["Cart and checkout",/\b(cart|checkout|orders|purchases)\b/],
 ["Reports",/\b(reports|analytics|charts|statistics)\b/],
 ["Settings",/\b(settings|preferences|configuration)\b/],
 ["Profile",/\b(profile|my account|personal details)\b/],
 ["Calendar",/\b(calendar|schedule|appointments|booking)\b/],
 ["Tasks",/\b(tasks|to do|todo|checklist|kanban)\b/],
 ["Customers or leads",/\b(customers|clients|leads|sales pipeline)\b/]
];
const ENTITIES=[
 ["students",/\b(student|students|pupil|pupils|learner|learners)\b/],
 ["attendance",/\b(attendance|present|absent|absence)\b/],
 ["marks",/\b(marks|grades|scores|results|exams|examination)\b/],
 ["teachers",/\b(teacher|teachers|faculty|staff)\b/],
 ["classes",/\b(class|classes|classroom)\b/],
 ["courses",/\b(course|courses|subject|subjects|curriculum)\b/],
 ["users",/\b(user|users|member|members|account|accounts)\b/],
 ["products",/\b(product|products|inventory|stock|items)\b/],
 ["orders",/\b(order|orders|purchase|purchases)\b/],
 ["customers",/\b(customer|customers|client|clients|lead|leads)\b/],
 ["tasks",/\b(task|tasks|todo|to do|project|projects)\b/],
 ["appointments",/\b(appointment|appointments|booking|bookings|event|events)\b/],
 ["payments",/\b(payment|payments|invoice|invoices|billing)\b/]
];
const norm=s=>String(s||"").toLowerCase().replace(/[’']/g,"'").replace(/[^a-z0-9._\s-]/g," ").replace(/\s+/g," ").trim();
function parse(request,opts){
 const raw=String(request||"").trim();
 if(!raw)throw new Error("Describe the app or program you want to build.");
 const q=norm(raw),prior=opts&&opts.previous&&typeof opts.previous==="object"?opts.previous:null;
 const scores={store:0,crm:0,tracker:0,dashboard:0,portfolio:0,landing:0,python:0,custom:0},evidence={};
 for(const type of Object.keys(WORDS)){
  evidence[type]=WORDS[type].filter(p=>q.includes(p));
  scores[type]=evidence[type].reduce((n,p)=>n+(p.includes(" ")?3:1),0);
 }
 if(/\b(build|make|create|develop|generate|write)\b/.test(q)&&scores.python>0)scores.python+=2;
 if(/\b(admin|management|manage|monitor)\b/.test(q)&&scores.dashboard>0)scores.dashboard+=1;
 let projectType=Object.keys(scores).sort((a,b)=>scores[b]-scores[a])[0];
 if(scores[projectType]===0)projectType=null;
 if(!projectType&&/\b(app|application|software|system|tool|platform|program)\b/.test(q)&&/\b(build|make|create|develop|generate|write)\b/.test(q))projectType="custom";
 const language=/\b(python|\.py|command.?line|cli|terminal)\b/.test(q)?"python":(/\b(typescript|\.tsx?)\b/.test(q)?"typescript":(/\b(javascript|node\.js|\.js)\b/.test(q)?"javascript":"html"));
 const features=FEATURE_MAP.filter(x=>x[1].test(q)).map(x=>x[0]);
 const pages=PAGE_MAP.filter(x=>x[1].test(q)).map(x=>x[0]);
 const entities=ENTITIES.filter(x=>x[1].test(q)).map(x=>x[0]);
 if(entities.some(e=>["students","attendance","marks","teachers","courses"].includes(e))&&/\b(school|student|attendance|management system)\b/.test(q))projectType="custom";
 const actions=[];
 if(/\b(add|create|new)\b/.test(q))actions.push("create records");
 if(/\b(edit|update|modify)\b/.test(q))actions.push("edit records");
 if(/\b(delete|remove)\b/.test(q))actions.push("delete records");
 if(/\b(search|find|filter)\b/.test(q))actions.push("search and filter");
 if(/\b(export|download)\b/.test(q))actions.push("export data");
 if(/\b(import|upload)\b/.test(q))actions.push("import files or data");
 if(/\b(track|monitor|manage)\b/.test(q))actions.push("track and manage records");
 const constraints=[];
 if(/\b(no backend|frontend only|front end only|local only|offline)\b/.test(q))constraints.push("local-only");
 if(/\b(no api|without api|no external api)\b/.test(q))constraints.push("no-external-api");
 if(/\b(no login|without login|guest)\b/.test(q))constraints.push("no-authentication");
 if(/\b(mobile|responsive|phone|tablet)\b/.test(q)||language!=="python")constraints.push("responsive");
 const asksAI=/\b(ai|artificial intelligence|llm|language model|machine learning|neural network|autonomous agent)\b/.test(q);
 const asksBackend=/\b(backend|database|authentication|login|payments|payment gateway|cloud sync|server)\b/.test(q);
 const asksExternal=/\b(api integration|third.party|external api|stripe|google maps|sendgrid)\b/.test(q);
 const requestedFiles=(raw.match(/\b[\w.-]+\.(?:html|css|js|jsx|ts|tsx|py|json|sql|md)\b/gi)||[]);
 const modules=[...new Set([...pages,...features])],missing=[];
 if(projectType==="store"&&!features.includes("payments"))missing.push("Payment provider not specified; checkout must remain a demo.");
 if(asksBackend)missing.push("Server, database or authentication requirements need a real backend; local output cannot claim these are live.");
 if(asksAI)missing.push("Genuine AI inference is unavailable in this no-model engine; do not generate a fake chatbot.");
 if(!projectType)missing.push("Project type is not mapped to a supported architecture yet.");
 const blueprint={
  schema:"haxbro.project-blueprint.v1",understandingEngine:"HAxBRO Understanding Engine "+VERSION,
  request:raw,normalizedRequest:q,projectType,language,
  intent:projectType?("Create a "+projectType+" project"):"Unclassified software request",
  evidence,features:[...new Set(features)],pages:[...new Set(pages)],dataEntities:entities,actions,
  constraints,requestedFiles:[...new Set(requestedFiles)],modules,
  dependencies:projectType==="store"?["product catalogue","cart state","checkout flow"]:projectType==="crm"?["lead records","lead status workflow"]:projectType==="tracker"?["task records","completion state"]:projectType==="dashboard"?["metric aggregation","report views"]:[],
  complexity:modules.length+entities.length+actions.length>9?"high":modules.length+entities.length+actions.length>4?"medium":"low",
  requiresAI:asksAI,requiresBackend:asksBackend,requiresExternalService:asksExternal,
  unsupportedOrUnverified:missing,
  generationPolicy:"Generate only supported functionality; label mock data, local storage and unavailable services. Never claim unimplemented features work.",
  createdAt:new Date().toISOString()
 };
 if(prior&&/\b(that|it|same app|also add|add this|change it|update it)\b/.test(q)){
  blueprint.contextReference=true;blueprint.previousProjectType=prior.projectType||null;
  if(!projectType&&prior.projectType)blueprint.projectType=prior.projectType;
  blueprint.intent="Refine the previous "+(blueprint.projectType||"")+" project";
 }
 return blueprint;
}
function explain(b){
 const items=[];
 if(b.features.length)items.push(b.features.join(", "));
 if(b.pages.length)items.push("pages: "+b.pages.join(", "));
 if(b.dataEntities.length)items.push("data: "+b.dataEntities.join(", "));
 return "Understood as "+(b.projectType||"unclassified request")+" ("+b.language+"). "+(items.length?items.join(" · "):"No specific modules detected.")+" Complexity: "+b.complexity+".";
}
window.HAxBROUnderstanding=Object.freeze({version:VERSION,parse,explain,capabilities:()=>({externalModels:false,externalAPIs:false,methods:["phrase grammar","weighted intent classification","feature extraction","entity and action extraction","dependency mapping","context references"],output:"structured project blueprint"})});
})();