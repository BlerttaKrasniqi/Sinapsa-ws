/* Sinapsa – aplikacioni (faza 1) */
(function(){
"use strict";
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const app=$("#app");
let FACULTIES=["Mjekësi","Stomatologji","Farmaci","Infermieri dhe Shkenca Shëndetësore","Juridik","Ekonomik","Shkenca Politike","Administratë Publike","Filologjik","Gjuhë të Huaja","Filozofik","Psikologji","Sociologji","Histori","Gjeografi","Edukim","Matematikë","Fizikë","Kimi","Biologji","Shkenca Kompjuterike","Inxhinieri Elektrike dhe Kompjuterike","Inxhinieri Mekanike","Ndërtimtari","Arkitekturë","Inxhinieri Kimike dhe Teknologjike","Gjeoshkenca dhe Miniera","Bujqësi dhe Veterinari","Shkenca Ushqimore","Shkenca Sportive","Arte","Muzikë","Gazetari dhe Komunikim","Turizëm","Siguri dhe Studime Mbrojtëse","Tjetër"];
const MAT_EXT=["pdf","doc","docx","odt","rtf","ppt","pptx","odp","xls","xlsx","ods","csv","txt","png","jpg","jpeg","gif","webp","zip","rar","7z"];
const AI_EXT=["pdf","png","jpg","jpeg","gif","webp","docx","pptx","odt","odp","txt"];
const MAX_MB=50, AI_MAX_MB=40;
const SOCIALS=[
  {name:"Instagram",handle:"@sinapsa.al",url:"https://www.instagram.com/sinapsa.al/",icon:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>'},
  {name:"TikTok",handle:"@sinapsa.al",url:"https://www.tiktok.com/@sinapsa.al",icon:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5"/><path d="M14 3c.4 2.6 2.3 4.5 5 4.8"/></svg>'},
  {name:"Facebook",handle:"Sinapsa",url:"https://www.facebook.com/profile.php?id=61588422658031",icon:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M15 3h-2.5A3.5 3.5 0 0 0 9 6.5V21M6 11h8"/></svg>'}
];

/* ---------- gjendja ---------- */
let dbState="loading", sets=[], materials=[], me=null, aiOn=false, googleOn=false, LIMITS={free:5,premium:150};
let view={name:"home"}, query="";

/* ---------- ndihmëse ---------- */
function lsGet(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}}
function lsSet(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}
function visitorId(){let v=lsGet("sin_vid","");if(!v){v=(window.crypto&&crypto.randomUUID?crypto.randomUUID():String(Math.random()).slice(2)+Date.now());lsSet("sin_vid",v)}return v}
function ownerKeys(){return lsGet("sin_keys",{})}
const ownerHeader=id=>{const k=ownerKeys()[id];return k?{"X-Owner-Key":k}:{}};
function canManage(item){return !!(item&&(item.mine||(me&&me.isAdmin)||ownerKeys()[item.id]))}
function isMine(item){return !!(item&&(item.mine||ownerKeys()[item.id]))}
async function api(method,path,body,extra){
  const headers=Object.assign({"X-Visitor":visitorId()},body?{"Content-Type":"application/json"}:{},extra||{});
  let r;
  try{r=await fetch(path,{method,headers,body:body?JSON.stringify(body):undefined,credentials:"same-origin"})}
  catch(e){const er=new Error("Nuk u lidh me serverin. Kontrolloni internetin dhe provoni përsëri.");er.status=0;throw er}
  const j=await r.json().catch(()=>({}));
  if(!r.ok){const e=new Error(j.error||"Diçka shkoi keq. Ju lutemi provoni përsëri.");e.status=r.status;throw e}
  return j;
}
function uploadFile(file,onProgress,name){
  return new Promise((resolve,reject)=>{
    const x=new XMLHttpRequest();
    x.open("POST","/api/upload?name="+encodeURIComponent(name||file.name));
    x.setRequestHeader("Content-Type","application/octet-stream");
    x.upload.onprogress=e=>{if(e.lengthComputable&&onProgress)onProgress(e.loaded/e.total)};
    x.onload=()=>{let j={};try{j=JSON.parse(x.responseText)}catch(e){}
      if(x.status>=200&&x.status<300)resolve(j);else reject(new Error(j.error||"Ngarkimi dështoi. Provoni përsëri."))};
    x.onerror=()=>reject(new Error("Nuk u lidh me serverin. Kontrolloni internetin dhe provoni përsëri."));
    x.send(file);
  });
}
function toast(msg){$$(".toast").forEach(t=>t.remove());const t=document.createElement("div");t.className="toast";t.setAttribute("role","status");t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),3200)}
function hue(name){let h=0;for(const c of String(name))h=(h*31+c.charCodeAt(0))%360;return h}
function initials(n){const p=String(n||"?").trim().split(/\s+/);return((p[0]||"?")[0]+(p.length>1?p[p.length-1][0]:"")).toUpperCase()}
function ago(t){if(!t)return"";const s=(Date.now()-t)/1000;if(s<60)return"tani";
  if(s<3600)return"para "+Math.floor(s/60)+" min";
  if(s<86400){const h=Math.floor(s/3600);return"para "+h+(h===1?" ore":" orësh")}
  const d=Math.floor(s/86400);if(d<30)return"para "+d+(d===1?" dite":" ditësh");
  return new Date(t).toLocaleDateString("sq-AL")}
function fmtSize(b){if(!b)return"";if(b<1024)return b+" B";if(b<1048576)return Math.round(b/1024)+" KB";return(b/1048576).toFixed(1).replace(".",",")+" MB"}
const plural=(n,one,many)=>n+" "+(n===1?one:many);
function extOf(name){const m=String(name||"").toLowerCase().match(/\.([a-z0-9]+)$/);return m?m[1]:""}
function kindOf(name){const e=extOf(name);
  if(e==="pdf")return["pdf","PDF"];
  if(["doc","docx","odt","rtf"].includes(e))return["word","WORD"];
  if(["ppt","pptx","odp"].includes(e))return["ppt","PPT"];
  if(["xls","xlsx","ods","csv"].includes(e))return["excel","EXCEL"];
  if(["png","jpg","jpeg","gif","webp"].includes(e))return["foto","FOTO"];
  if(e==="txt")return["tekst","TEKST"];
  if(["zip","rar","7z"].includes(e))return["zip","ZIP"];
  return["tjeter",(e||"?").toUpperCase().slice(0,5)]}
const fileUrl=f=>f&&f.asset?"/uploads/"+encodeURIComponent(f.asset):"";
const dlUrl=(asset,name)=>"/uploads/"+encodeURIComponent(asset)+"?download=1&name="+encodeURIComponent(name||asset);
function typeBox(name,asset,preview){const [k,l]=kindOf(name);const src=preview||(k==="foto"&&asset?"/uploads/"+encodeURIComponent(asset):"");
  return `<span class="ftype t-${k}" aria-hidden="true">${src?`<img src="${esc(src)}" alt="" loading="lazy">`:esc(l)}</span>`}
const facultyOptions=(sel,all)=>(all?`<option value="">Të gjitha fakultetet</option>`:"")+FACULTIES.map(f=>`<option ${f===sel?"selected":""}>${esc(f)}</option>`).join("");
const gradeOptions=(sel,all)=>(all?`<option value="">Të gjitha klasat</option>`:"")+Array.from({length:12},(_,i)=>`<option value="${i+1}" ${+sel===i+1?"selected":""}>Klasa ${i+1}</option>`).join("");
const yearOptions=sel=>Array.from({length:6},(_,i)=>`<option value="${i+1}" ${+sel===i+1?"selected":""}>Viti ${i+1}</option>`).join("");
const reduceMotion=()=>matchMedia("(prefers-reduced-motion: reduce)").matches;
const firstName=n=>String(n||"").trim().split(/\s+/)[0]||"";
function levelLabel(x){return x.level==="school"?`Klasa ${x.grade}`:(x.faculty||"Universitet")}
function levelPill(x){return x.level==="school"?`<span class="pill sch">${I.school} Klasa ${esc(x.grade)}</span>`:`<span class="pill fac">${I.cap} ${esc(x.faculty||"Tjetër")}</span>`}

/* ---------- ikonat ---------- */
const sv=(d,w)=>`<svg width="${w||22}" height="${w||22}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I={
  back:sv('<path d="M15 18l-6-6 6-6"/>',18), next:sv('<path d="M9 18l6-6-6-6"/>'), prev:sv('<path d="M15 18l-6-6 6-6"/>'),
  arrow:sv('<path d="M5 12h14M13 6l6 6-6 6"/>',18),
  trash:sv('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',18),
  img:sv('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 17-5-5-9 8"/>',18),
  up:sv('<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',30),
  upS:sv('<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',18),
  down:sv('<path d="M12 4v12M7 11l5 5 5-5M5 20h14"/>',18),
  ext:sv('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',16),
  shuffle:sv('<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>',18),
  cap:sv('<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2 9 2 12 0v-5"/>',14),
  school:sv('<path d="M3 21h18M5 21V10l7-5 7 5v11M10 21v-5h4v5"/>',14),
  cards:sv('<rect x="3" y="6" width="14" height="14" rx="2.5"/><path d="M7 3h11a3 3 0 0 1 3 3v11"/>'),
  cardsS:sv('<rect x="3" y="6" width="14" height="14" rx="2.5"/><path d="M7 3h11a3 3 0 0 1 3 3v11"/>',14),
  folder:sv('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
  game:sv('<rect x="2" y="7" width="20" height="11" rx="5"/><path d="M7 11v3M5.5 12.5h3"/><circle cx="16" cy="11.5" r="1" fill="currentColor"/><circle cx="18" cy="14" r="1" fill="currentColor"/>'),
  gameS:sv('<rect x="2" y="7" width="20" height="11" rx="5"/><path d="M7 11v3M5.5 12.5h3"/><circle cx="16" cy="11.5" r="1" fill="currentColor"/><circle cx="18" cy="14" r="1" fill="currentColor"/>',16),
  users:sv('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.6"/><path d="M16 14.2a5 5 0 0 1 5.5 5.3"/>'),
  info:sv('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>'),
  trophy:sv('<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M9 17h6"/>'),
  trophyS:sv('<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M9 17h6"/>',16),
  crown:sv('<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z"/>'),
  crownS:sv('<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z"/>',16),
  user:sv('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',18),
  out:sv('<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l5-5-5-5M15 12H3"/>',18),
  spark:sv('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>'),
  sparkS:sv('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',16),
  pen:sv('<path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4"/>',18),
  home:sv('<path d="M3 11l9-7 9 7M5 10v10h14V10"/>',18),
  shield:sv('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',16),
  check:sv('<path d="m5 12 4 4 10-10"/>'),
  x:sv('<path d="M6 6l12 12M18 6 6 18"/>'),
  timer:sv('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/>'),
  bolt:sv('<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>'),
  brain:sv('<path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 6 1V5a2 2 0 0 0-3-1zM15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-6 1"/>'),
  balloon:sv('<path d="M12 3a6 6 0 0 1 6 6c0 4-3 7-6 7s-6-3-6-7a6 6 0 0 1 6-6z"/><path d="M12 16l-1 2h2zM12 18c0 2-2 2-2 4"/>'),
  fill:sv('<path d="M4 7h6M14 7h6M4 12h3M17 12h3M9 12h6"/><path d="M8 17h8" stroke-dasharray="2 2.5"/>'),
  compass:sv('<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>'),
  moon:sv('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>'),
  sun:sv('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  target:sv('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>'),
  lock:sv('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  heart:'<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.5-9.3C1.1 8.3 3.3 4.5 7 4.5c2 0 3.6 1.1 5 2.9 1.4-1.8 3-2.9 5-2.9 3.7 0 5.9 3.8 4.5 7.2C19.5 16.4 12 21 12 21z"/></svg>',
  flame:'<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2c1 3.5 5 6 5 11a5 5 0 0 1-10 0c0-2.2 1-3.8 2.3-5 .2 1.6 1 2.7 2.2 3.2C11 8.6 11.3 5 12 2z"/></svg>',
  flameL:'<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2c1 3.5 5 6 5 11a5 5 0 0 1-10 0c0-2.2 1-3.8 2.3-5 .2 1.6 1 2.7 2.2 3.2C11 8.6 11.3 5 12 2z"/></svg>',
  star:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.8 2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/></svg>',
  starS:'<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m12 2.8 2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/></svg>',
  starL:'<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m12 2.8 2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/></svg>',
  sound:sv('<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>',18),
  mute:sv('<path d="M11 5 6 9H3v6h3l5 4z"/><path d="m22 9-6 6M16 9l6 6"/>',18),
  google:'<svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>',
};
const sm=(cls,style)=>`<span class="smark ${cls||""}" style="${style||""}" aria-hidden="true"></span>`;

/* ---------- avatarët ---------- */
const AV_COL=[["#7A5CFF","#E4DCFF"],["#FF4FA0","#FFE0EF"],["#16C79A","#D3F7EA"],["#2FA8FF","#DCF0FF"],["#FF8A3D","#FFE6D4"],["#F2A900","#FFF1C7"],["#1800AD","#DCD7FF"],["#FF5A72","#FFE1E6"]];
const AV_IDS=Array.from({length:16},(_,i)=>"a"+(i+1));
function avatarSvg(id){
  const n=Math.max(0,(parseInt(String(id).slice(1),10)||1)-1)%16,[c,l]=AV_COL[n%8],shape=n%4,acc=[0,1,2,3,4,5,1,2,5,4,3,0,2,5,1,4][n],closed=n%5===3;
  let ears="";
  if(shape===1)ears=`<path d="M13 30 L16 10 L27 22Z M51 30 L48 10 L37 22Z" fill="${c}"/>`;
  if(shape===2)ears=`<circle cx="15" cy="22" r="7.5" fill="${c}"/><circle cx="49" cy="22" r="7.5" fill="${c}"/><circle cx="15" cy="22" r="3.5" fill="${l}"/><circle cx="49" cy="22" r="3.5" fill="${l}"/>`;
  if(shape===3)ears=`<path d="M32 18 V9" stroke="${c}" stroke-width="3" stroke-linecap="round"/><circle cx="32" cy="8" r="4" fill="#FFC93C"/>`;
  const body=shape===0?`<ellipse cx="32" cy="44" rx="23" ry="24" fill="${c}"/>`:`<ellipse cx="32" cy="45" rx="22" ry="25" fill="${c}"/>`;
  const eyes=closed?`<path d="M20 38q4-4 8 0M36 38q4-4 8 0" stroke="#15123B" stroke-width="2.6" fill="none" stroke-linecap="round"/>`
    :`<circle cx="24" cy="38" r="5.4" fill="#fff"/><circle cx="40" cy="38" r="5.4" fill="#fff"/><circle cx="${25+(n%3)-1}" cy="38.6" r="2.7" fill="#15123B"/><circle cx="${41+(n%3)-1}" cy="38.6" r="2.7" fill="#15123B"/>`;
  const mouth=n%3===1?`<ellipse cx="32" cy="48.5" rx="3.6" ry="2.8" fill="#15123B"/>`:`<path d="M26.5 46.5q5.5 5.5 11 0" stroke="#15123B" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
  const cheeks=`<circle cx="18.5" cy="46" r="3.2" fill="#FF8FB8" opacity=".7"/><circle cx="45.5" cy="46" r="3.2" fill="#FF8FB8" opacity=".7"/>`;
  const A=[
    "",
    `<path d="M14 21 L32 13 L50 21 L32 29Z" fill="#15123B"/><path d="M23 25v5c6 3 12 3 18 0v-5" fill="#15123B"/><path d="M50 21v8" stroke="#FFC93C" stroke-width="2"/><circle cx="50" cy="30" r="2" fill="#FFC93C"/>`,
    `<circle cx="24" cy="38" r="8" fill="none" stroke="#15123B" stroke-width="2.4"/><circle cx="40" cy="38" r="8" fill="none" stroke="#15123B" stroke-width="2.4"/><path d="M32 37.5h0" stroke="#15123B" stroke-width="2.4"/><path d="M31 37h2" stroke="#15123B" stroke-width="2.4"/>`,
    `<path d="M40 20 L48 14 L48 26Z M56 20 L48 14 L48 26Z" fill="#FF4FA0"/><circle cx="48" cy="20" r="2.6" fill="#D61F78"/>`,
    `<path d="M11 38 A21 21 0 0 1 53 38" stroke="#15123B" stroke-width="3.4" fill="none"/><rect x="7" y="34" width="8" height="13" rx="3" fill="#15123B"/><rect x="49" y="34" width="8" height="13" rx="3" fill="#15123B"/>`,
    `<path d="M13 14l1.6 3.4 3.7.5-2.7 2.5.7 3.7-3.3-1.8-3.3 1.8.7-3.7L8.2 17.9l3.7-.5z" fill="#FFC93C"/>`
  ];
  return `<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" fill="${l}"/>${ears}${body}${eyes}${mouth}${cheeks}${A[acc]}</svg>`;
}
function avHtml(person,size,ring){
  const a=person&&person.avatar,name=(person&&person.name)||"?",cls=`av av-${size||40}${ring?" av-ring":""}`;
  if(a&&a.asset)return `<span class="${cls}"><img src="/uploads/${encodeURIComponent(a.asset)}" alt="" loading="lazy"></span>`;
  if(a&&a.preset)return `<span class="${cls}">${avatarSvg(a.preset)}</span>`;
  return `<span class="${cls}" style="background:hsl(${(hue(name)%90)+230} 70% 55%)" aria-hidden="true">${esc(initials(name))}</span>`;
}

/* ---------- ilustrimet ---------- */
const ART={
  uni:`<svg viewBox="0 0 320 200" aria-hidden="true"><rect width="320" height="200" fill="#E2F2FF"/><circle cx="270" cy="40" r="22" fill="#FFC93C"/><path d="M0 160h320v40H0z" fill="#C7E6FF"/>
    <rect x="40" y="52" width="70" height="48" rx="8" fill="#fff"/><path d="M52 66h46M52 76h34M52 86h40" stroke="#2FA8FF" stroke-width="4" stroke-linecap="round"/>
    <rect x="96" y="138" width="150" height="10" rx="5" fill="#15123B"/><rect x="132" y="96" width="78" height="46" rx="6" fill="#1800AD"/><rect x="138" y="102" width="66" height="34" rx="3" fill="#ECE9FF"/><path d="M146 112h30M146 120h44M146 128h22" stroke="#7A5CFF" stroke-width="3" stroke-linecap="round"/>
    <path d="M150 150c0-30 12-44 28-44s28 14 28 44z" fill="#7A5CFF"/><circle cx="178" cy="78" r="18" fill="#F6C9A8"/><path d="M160 74c2-14 34-16 36 0-8-6-26-6-36 0z" fill="#3A2A1A"/>
    <path d="M152 58l26-12 26 12-26 12z" fill="#15123B"/><path d="M165 64v8c8 4 18 4 26 0v-8" fill="#15123B"/><path d="M204 58v14" stroke="#FFC93C" stroke-width="3"/><circle cx="204" cy="74" r="3.5" fill="#FFC93C"/>
    <circle cx="172" cy="80" r="2" fill="#15123B"/><circle cx="184" cy="80" r="2" fill="#15123B"/><path d="M173 87q5 4 10 0" stroke="#15123B" stroke-width="2" fill="none" stroke-linecap="round"/>
    <rect x="236" y="112" width="44" height="10" rx="3" fill="#FF4FA0"/><rect x="240" y="122" width="40" height="10" rx="3" fill="#16C79A"/><rect x="234" y="132" width="46" height="10" rx="3" fill="#FFC93C"/>
    <path d="M60 128l5 10 11 1-8 7 2 11-10-5-10 5 2-11-8-7 11-1z" fill="#FFC93C"/></svg>`,
  teacher:`<svg viewBox="0 0 320 200" aria-hidden="true"><rect width="320" height="200" fill="#DDF8EF"/><path d="M0 168h320v32H0z" fill="#BDEEDC"/>
    <rect x="30" y="30" width="170" height="104" rx="10" fill="#15123B"/><rect x="38" y="38" width="154" height="88" rx="6" fill="#1F6B57"/>
    <path d="M52 108l28-26 22 16 34-36 30 20" stroke="#FFC93C" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><text x="150" y="70" font-family="Arial" font-weight="900" font-size="26" fill="#fff">A+</text>
    <path d="M196 116l42-22" stroke="#C2520D" stroke-width="5" stroke-linecap="round"/>
    <path d="M218 172c0-36 14-54 34-54s34 18 34 54z" fill="#16C79A"/><circle cx="252" cy="90" r="20" fill="#E8B48F"/><path d="M230 88c0-18 44-20 44 0-2-8-10-12-22-12s-20 4-22 12z" fill="#5A3A22"/><path d="M231 88c-2 10 0 20 4 24M273 88c2 10 0 20-4 24" stroke="#5A3A22" stroke-width="6" stroke-linecap="round"/>
    <circle cx="245" cy="92" r="2" fill="#15123B"/><circle cx="259" cy="92" r="2" fill="#15123B"/><path d="M246 100q6 4 12 0" stroke="#15123B" stroke-width="2" fill="none" stroke-linecap="round"/>
    <circle cx="70" cy="160" r="12" fill="#FF5A72"/><path d="M70 148q2-8 8-8" stroke="#0A8A69" stroke-width="3" fill="none"/><rect x="96" y="150" width="60" height="18" rx="4" fill="#2FA8FF"/><rect x="100" y="140" width="52" height="10" rx="3" fill="#FF8A3D"/></svg>`,
  kids:`<svg viewBox="0 0 320 200" aria-hidden="true"><rect width="320" height="200" fill="#FFF4D1"/><path d="M0 164h320v36H0z" fill="#FFE39A"/>
    <path d="M60 20v60M84 16v56" stroke="#15123B" stroke-width="1.5"/><ellipse cx="60" cy="30" rx="16" ry="19" fill="#FF4FA0"/><ellipse cx="84" cy="24" rx="15" ry="18" fill="#2FA8FF"/><ellipse cx="38" cy="40" rx="13" ry="16" fill="#16C79A"/><path d="M38 56v26" stroke="#15123B" stroke-width="1.5"/>
    <path d="M100 168c0-30 10-46 26-46s26 16 26 46z" fill="#FF8A3D"/><rect x="138" y="128" width="20" height="30" rx="6" fill="#7A5CFF"/><circle cx="126" cy="102" r="17" fill="#F6C9A8"/><path d="M109 98c2-16 32-16 34 0-6-4-12-6-17-6s-12 2-17 6z" fill="#3A2A1A"/><circle cx="120" cy="104" r="2" fill="#15123B"/><circle cx="132" cy="104" r="2" fill="#15123B"/><path d="M121 111q5 4 10 0" stroke="#15123B" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M176 168c0-28 10-42 26-42s26 14 26 42z" fill="#16C79A"/><circle cx="202" cy="108" r="16" fill="#C98E64"/><path d="M186 104c0-14 32-14 32 0-4-4-10-6-16-6s-12 2-16 6z" fill="#15123B"/><circle cx="186" cy="94" r="6" fill="#15123B"/><circle cx="218" cy="94" r="6" fill="#15123B"/><circle cx="196" cy="110" r="2" fill="#15123B"/><circle cx="208" cy="110" r="2" fill="#15123B"/><path d="M197 117q5 4 10 0" stroke="#15123B" stroke-width="2" fill="none" stroke-linecap="round"/>
    <rect x="244" y="138" width="26" height="26" rx="4" fill="#FF5A72"/><rect x="270" y="138" width="26" height="26" rx="4" fill="#2FA8FF"/><rect x="257" y="112" width="26" height="26" rx="4" fill="#FFC93C"/>
    <text x="250" y="157" font-family="Arial" font-weight="900" font-size="16" fill="#fff">A</text><text x="276" y="157" font-family="Arial" font-weight="900" font-size="16" fill="#fff">B</text><text x="263" y="131" font-family="Arial" font-weight="900" font-size="16" fill="#15123B">C</text>
    <path d="M262 40l5 10 11 1-8 7 2 11-10-5-10 5 2-11-8-7 11-1z" fill="#FF8A3D"/><circle cx="200" cy="40" r="5" fill="#7A5CFF"/><circle cx="226" cy="64" r="3" fill="#FF4FA0"/></svg>`
};

/* ---------- rrugët (#/...) ---------- */
function parseHash(){
  const raw=location.hash.replace(/^#\/?/,"");const [path,qs]=raw.split("?");
  const parts=(path||"").split("/").filter(Boolean).map(x=>{try{return decodeURIComponent(x)}catch(e){return x}});
  const params=new URLSearchParams(qs||"");
  const [a,b,c]=parts;
  let v;
  if(!a)v={name:"root"};
  else if(a==="hyr")v={name:"auth",tab:"login"};
  else if(a==="regjistrohu")v={name:"auth",tab:"signup"};
  else if(a==="kreu")v={name:"home"};
  else if(a==="profili")v={name:"profile"};
  else if(a==="materialet")v=b==="ngarko"?{name:"upload"}:{name:"materials"};
  else if(a==="material"&&b)v={name:"material",id:b};
  else if(a==="kartat")v=b==="krijo"?{name:"aicreate",purpose:"cards"}:b==="manual"?{name:"manual"}:{name:"sets"};
  else if(a==="lojerat")v=b==="krijo"?{name:"aicreate",purpose:"games"}:{name:"games"};
  else if(a==="set"&&b)v={name:"set",id:b,mode:c||""};
  else if(a==="ndrysho"&&b)v={name:"edit",id:b};
  else if(a==="grupet")v={name:"groups"};
  else if(a==="rreth-nesh")v={name:"about"};
  else if(a==="arritjet")v={name:"achievements"};
  else if(a==="premium")v={name:"premium"};
  else if(a==="admin")v={name:"admin"};
  else if(a==="te-miat")v={name:"mine"};
  else if(a==="kerko")v={name:"search"};
  else v={name:"root"};
  v.params=params;return v;
}
function hashFor(v){
  const m={root:"",home:"kreu",profile:"profili",materials:"materialet",upload:"materialet/ngarko",sets:"kartat",manual:"kartat/manual",games:"lojerat",groups:"grupet",about:"rreth-nesh",achievements:"arritjet",premium:"premium",admin:"admin",mine:"te-miat",search:"kerko"};
  if(v.name==="auth")return v.tab==="signup"?"#/regjistrohu":"#/hyr";
  if(v.name==="material")return "#/material/"+encodeURIComponent(v.id);
  if(v.name==="set")return "#/set/"+encodeURIComponent(v.id)+(v.mode?"/"+v.mode:"");
  if(v.name==="edit")return "#/ndrysho/"+encodeURIComponent(v.id);
  if(v.name==="aicreate")return v.purpose==="games"?"#/lojerat/krijo":"#/kartat/krijo";
  return "#/"+(m[v.name]||"");
}
let skipHash=null;
function go(name,extra){
  view=Object.assign({name,params:new URLSearchParams()},extra||{});
  closeMenus();
  const h=hashFor(view);if(location.hash!==h){skipHash=h;location.hash=h}
  render();window.scrollTo(0,0);
}
window.addEventListener("hashchange",()=>{
  if(location.hash===skipHash){skipHash=null;return}
  skipHash=null;view=parseHash();closeMenus();render();window.scrollTo(0,0);
});
function setMode(mode){view.mode=mode;try{history.replaceState(null,"",hashFor(view))}catch(e){}}

/* Faqet që kërkojnë llogari */
const OPEN_VIEWS=["root","auth","about","materials","sets","games","search","groups","premium"];
function needLogin(msg){toast(msg||"Hyni ose regjistrohuni falas për ta përdorur këtë.");go("auth",{tab:"signup"})}

/* ---------- menyja ---------- */
function closeMenus(){$$(".dd-menu").forEach(m=>m.remove());const mm=$("#mmenu");if(mm)mm.classList.remove("open");const h=$("#hamb");if(h)h.setAttribute("aria-expanded","false")}
document.addEventListener("click",e=>{if(!e.target.closest(".dd"))$$(".dd-menu").forEach(m=>m.remove())});
const NAV=[["home","Kreu"],["materials","Materialet"],["sets","Kartat & Kuizet"],["games","Lojërat"],["groups","Grupet"],["about","Rreth nesh"]];
function navCurrent(){const n=view.name;if(n==="material"||n==="upload")return"materials";if(n==="manual"||n==="edit"||(n==="aicreate"&&view.purpose!=="games"))return"sets";if(n==="aicreate")return"games";if(n==="set"){const s=sets.find(x=>x.id===view.id);return s&&s.purpose==="games"?"games":"sets"}return n}
function renderNav(){
  const cur=navCurrent();
  const links=(me?NAV:NAV.filter(([k])=>k!=="home")).map(([k,l])=>`<button class="menu-link" data-nav="${k}" ${cur===k?'aria-current="page"':""}>${l}</button>`).join("");
  const plan=me?(me.isAdmin?`<span class="badge-plan admin">ADMIN</span>`:me.plan==="premium"?`<span class="badge-plan premium">PREMIUM</span>`:""):"";
  const right=me?`<span class="dd"><button class="user-chip" id="uchip" aria-haspopup="true" aria-label="Llogaria juaj">${avHtml(me,32)}<span class="nm">${esc(firstName(me.name))}</span>${plan}</button></span>`
    :`<button class="btn btn-ghost btn-sm" data-nav="login">Hyr</button><button class="btn btn-fun btn-sm" data-nav="signup">Regjistrohu falas</button>`;
  $("#menu").innerHTML=links+`<span style="width:8px"></span>`+right;
  $("#mmenu").innerHTML=links+(me?`<button class="menu-link" data-nav="profile">Profili im</button><button class="menu-link" data-nav="achievements">Arritjet</button><button class="menu-link" data-nav="mine">Të miat</button><button class="menu-link" data-nav="premium">Premium</button>${me.isAdmin?`<button class="menu-link" data-nav="admin">Paneli i adminit</button>`:""}<button class="menu-link" data-nav="logout">Dil (${esc(me.name)})</button>`
    :`<button class="btn btn-ghost" data-nav="login">Hyr</button><button class="btn btn-fun" data-nav="signup">Regjistrohu falas</button>`);
  $$("[data-nav]",$(".nav")).forEach(b=>b.onclick=()=>navTo(b.dataset.nav));
  const uc=$("#uchip");
  if(uc)uc.onclick=e=>{e.stopPropagation();if($(".dd-menu")){closeMenus();return}
    const m=document.createElement("div");m.className="dd-menu";
    m.innerHTML=`<div class="who"><b style="color:var(--ink)">${esc(me.name)}</b><br>${esc(me.email)}</div><button data-nav="profile">${I.user} Profili im</button><button data-nav="achievements">Arritjet dhe renditja</button><button data-nav="mine">Të miat</button><button data-nav="premium">${me.plan==="premium"?"Plani Premium":"Kalo në Premium"}</button>${me.isAdmin?`<button data-nav="admin">Paneli i adminit</button>`:""}<button data-nav="logout">${I.out} Dil</button>`;
    uc.parentNode.appendChild(m);$$("[data-nav]",m).forEach(b=>b.onclick=()=>navTo(b.dataset.nav))};
}
async function navTo(k){
  closeMenus();
  if(k==="login")return go("auth",{tab:"login"});
  if(k==="signup")return go("auth",{tab:"signup"});
  if(k==="logout"){try{await api("POST","/api/auth/logout")}catch(e){}me=null;P=null;toast("Dolët nga llogaria");await refresh(true);return go("root")}
  if(k==="home"){query="";$("#q").value=""}
  go(k);
}
$("#brand").onclick=()=>{query="";$("#q").value="";go(me?"home":"root")};
$("#hamb").onclick=()=>{const m=$("#mmenu");const o=m.classList.toggle("open");$("#hamb").setAttribute("aria-expanded",String(o))};
let qT;$("#q").addEventListener("input",e=>{clearTimeout(qT);qT=setTimeout(()=>{query=e.target.value.trim();
  if(query){if(view.name!=="search"&&!["materials","sets","games"].includes(view.name))go("search");else render()}else if(view.name==="search")go(me?"home":"root");else render()},180)});

/* ---------- këmba ---------- */
function renderFoot(){
  $("#foot").innerHTML=`<div class="info-box"><div class="info-in">
    <svg class="deco" viewBox="0 0 100 120" aria-hidden="true"><path fill="currentColor" d="M70 8C40 0 14 14 16 38c2 20 26 26 40 31 12 4 16 10 14 17-3 10-22 12-46 2l-8 22c32 14 74 8 78-24 3-22-16-32-34-38-14-5-22-8-21-15 1-9 20-11 40-2l8-21z"/></svg>
    <div><span class="wordmark">${sm()}<span class="wm-text">Sinapsa</span></span><p>Platforma ku studentët, nxënësit dhe mësuesit ndajnë materiale dhe mësojnë duke luajtur. Ngarko materialin – Sinapsa krijon karta, kuize dhe lojëra për ty.</p></div>
    <div><h4>Faqet</h4><ul>${[["materials","Materialet"],["sets","Kartat & Kuizet"],["games","Lojërat"],["groups","Grupet e studimit"],["premium","Premium"],["about","Rreth nesh"]].map(([k,l])=>`<li><button class="lnk" data-fnav="${k}">${l}</button></li>`).join("")}</ul></div>
    <div><h4>Na ndiqni</h4><div class="socials">${SOCIALS.map(s=>`<a class="soc" href="${s.url}" target="_blank" rel="noopener">${s.icon}<span>${s.name} <span style="opacity:.7;font-weight:600">${esc(s.handle)}</span></span></a>`).join("")}</div></div>
  </div></div>
  <div class="copy"><span>© ${new Date().getFullYear()} Sinapsa · Mëso duke luajtur</span><span>Keni gjetur diçka të gabuar? Shtypni “Raporto” te përmbajtja.</span></div>`;
  $$("[data-fnav]").forEach(b=>b.onclick=()=>go(b.dataset.fnav));
}

/* ---------- faqja hyrëse (për vizitorët) ---------- */
let SU=null; // regjistrimi në dy hapa
function newSU(){return{step:1,name:"",email:"",password:"",age:"",kind:"",institution:"",faculty:"",year:"",grade:""}}
function floatS(){
  const S=[["8%","14%",46,"var(--violet)","-12deg"],["90%","10%",34,"var(--pink)","14deg"],["4%","78%",30,"var(--sky)","8deg"],["52%","4%",26,"var(--sun)","-20deg"],["94%","72%",40,"var(--mint)","-6deg"]];
  return S.map(([l,t,w,c,r],i)=>`<span class="float-s" style="left:${l};top:${t};color:${c};--r:${r};animation-delay:-${i*1.7}s">${sm("","width:"+w+"px;height:"+Math.round(w*1.15)+"px")}</span>`).join("");
}
function videoBlock(){
  return `<div class="video-frame"><div class="chrome" aria-hidden="true"><i></i><i></i><i></i><span>sinapsa</span></div>
    <video id="demo-v" src="/demo.mp4" poster="/demo.jpg" autoplay muted loop playsinline preload="metadata" aria-label="Video: si funksionon Sinapsa – ngarko materialin, AI krijon kartat dhe lojërat, luaj dhe fito arritje"></video>
    <button class="vbtn" id="demo-p" aria-label="Ndalo videon"></button></div>`;
}
function bindVideo(){
  const dv=$("#demo-v"),dp=$("#demo-p");if(!dv||!dp)return;
  if(reduceMotion()){dv.removeAttribute("autoplay");dv.pause()}
  const icon=()=>{dp.innerHTML=dv.paused?'<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 5v14l12-7z"/></svg>':'<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';dp.setAttribute("aria-label",dv.paused?"Luaj videon":"Ndalo videon")};
  dp.onclick=()=>{dv.paused?dv.play().catch(()=>{}):dv.pause();icon()};dv.onplay=dv.onpause=icon;icon();
}
const SECTORS=[
  {k:"materials",c:"c-sky",icon:I.folder,t:"Materialet",d:"Ngarko skripta, ligjërata e foto të shënimeve – disa skedarë bëhen një material i vetëm. Ndihmo kolegët."},
  {k:"sets",c:"c-violet",icon:I.cards,t:"Kartat & Kuizet",d:"Ngarko materialin dhe AI krijon karta e kuiz që mbulojnë gjithçka – 60, 100 ose 200 karta, sa të duhen."},
  {k:"games",c:"c-pink",icon:I.game,t:"Lojërat",d:"8 lojëra nga i njëjti material: Kuiz, Sprint, Përputh, Memory, Balona e të tjera. Zgjidh një ose luaji të gjitha."},
  {k:"groups",c:"c-mint",icon:I.users,t:"Grupet e studimit",d:"Klasa me kod, sfida live si Kahoot dhe detyra nga mësuesi.",soon:true},
  {k:"achievements",c:"c-sun",icon:I.trophy,t:"Arritjet",d:"XP, nivele, medalje bronzi deri diamanti, seri ditësh dhe renditja e javës."},
  {k:"about",c:"c-orange",icon:I.info,t:"Rreth nesh",d:"Kush jemi, si funksionon Sinapsa dhe ku na gjeni në rrjetet sociale."},
];
function sectorsHtml(list){
  return `<div class="sectors">${(list||SECTORS).map(s=>`<button class="sector ${s.c}${s.soon?" soon":""}" data-sector="${s.k}"><span class="ic">${s.icon}</span><h3>${s.t}</h3><p>${s.d}</p><span class="go">${s.soon?"Së shpejti":"Hap"} ${s.soon?"":I.arrow}</span>${s.soon?`<span class="soon-b">Së shpejti</span>`:""}<span class="deco">${sm("","width:100%;height:100%")}</span></button>`).join("")}</div>`;
}
function bindSectors(){$$("[data-sector]",app).forEach(b=>b.onclick=()=>{const k=b.dataset.sector;if(!me&&k==="achievements")return needLogin();go(k)})}
function whoHtml(){
  return `<div class="who-grid">
    <div class="who-card c-sky"><div class="art">${ART.uni}</div><div class="body"><h3>Studentët e fakulteteve</h3><p>Ngarko ligjëratat dhe skriptat, shkëmbe materiale sipas universitetit e fakultetit dhe përgatitu për provime me karta e lojëra.</p></div></div>
    <div class="who-card c-mint"><div class="art">${ART.teacher}</div><div class="body"><h3>Mësuesit</h3><p>Ngarko mësimin e ditës dhe merr menjëherë kuize e lojëra për klasën. Së shpejti: klasa me kod dhe sfida live.</p></div></div>
    <div class="who-card c-sun"><div class="art">${ART.kids}</div><div class="body"><h3>Nxënësit (klasa 1–12)</h3><p>Lojëra më të gëzuara e më të thjeshta për shkollën: balona, memory dhe yje për çdo përgjigje të saktë.</p></div></div>
  </div>`;
}
function renderLanding(){
  const tab=view.name==="auth"&&view.tab==="login"?"login":"signup";
  const gerr=view.params&&view.params.get("gabim");
  app.className="wide";
  app.innerHTML=`
  <section class="land-hero">${floatS()}
    <div class="land-in">
      <div>
        <span class="eyebrow">${I.sparkS} Për studentë, nxënës dhe mësues</span>
        <h1 class="land-title">Mëso duke <span class="wm-text">luajtur.</span></h1>
        <p class="land-sub">Ngarko një PDF, ligjëratë ose foto të shënimeve. Sinapsa krijon me AI karta, kuize dhe 8 lojëra që mbulojnë të gjithë materialin – dhe ti fiton XP, medalje e vend në renditje.</p>
        <div class="chips">
          <span class="chip"><i style="background:var(--violet)"></i>Karta & kuize me AI</span>
          <span class="chip"><i style="background:var(--pink)"></i>8 lojëra</span>
          <span class="chip"><i style="background:var(--sky)"></i>Materiale nga kolegët</span>
          <span class="chip"><i style="background:var(--sun)"></i>Arritje & renditje</span>
        </div>
      </div>
      <div class="auth-card" id="auth-card">${authCardHtml(tab,gerr)}</div>
    </div>
  </section>
  <section class="land-sec" id="video">
    <span class="eyebrow">Si funksionon</span><h2>Nga materiali te loja në një minutë</h2>
    <p class="lead">Shiko videon e shkurtër – pastaj provoje vetë.</p>
    <div class="how">${videoBlock()}
      <ol class="how-steps">
        <li><b class="n" style="background:var(--sky)">1</b><div><strong>Krijo llogarinë</strong><span>Me email ose Google. Na trego shkollën ose universitetin dhe vitin.</span></div></li>
        <li><b class="n" style="background:var(--violet)">2</b><div><strong>Ngarko materialin</strong><span>PDF, Word, PowerPoint ose foto – edhe disa njëherësh. Bëhen një set i vetëm.</span></div></li>
        <li><b class="n" style="background:var(--pink)">3</b><div><strong>AI krijon gjithçka</strong><span>Karta për çdo pjesë të rëndësishme, kuiz dhe fjali për t'u plotësuar.</span></div></li>
        <li><b class="n" style="background:var(--sun);color:var(--ink)">4</b><div><strong>Luaj dhe fito</strong><span>Zgjidh lojën që të pëlqen ose luaji të gjitha. Mblidh XP dhe medalje.</span></div></li>
      </ol>
    </div>
  </section>
  <section class="land-sec"><span class="eyebrow">Sektorët</span><h2>Çfarë gjen në Sinapsa</h2><p class="lead">Mund t'i shfletosh pa llogari. Për të ngarkuar, krijuar dhe luajtur, regjistrohu falas.</p>${sectorsHtml()}</section>
  <section class="land-sec"><span class="eyebrow">Për kë është</span><h2>Një vend për të gjithë ata që mësojnë</h2><p class="lead">Përmbajtja e universitetit dhe e shkollës mbahet e ndarë, që secili të gjejë shpejt atë që i duhet.</p>${whoHtml()}</section>
  <section class="land-sec" style="text-align:center"><h2>Gati për të filluar?</h2><p class="lead" style="margin-inline:auto">Falas, pa kartë bankare. Çdo muaj merr ${LIMITS.free} sete me AI pa pagesë.</p><button class="btn btn-fun btn-lg" id="cta-su">${I.spark} Krijo llogari falas</button></section>`;
  bindAuthCard();bindVideo();bindSectors();
  $("#cta-su").onclick=()=>{SU=SU||newSU();setAuthTab("signup");$("#auth-card").scrollIntoView({behavior:reduceMotion()?"auto":"smooth",block:"center"})};
  if(view.name==="auth"&&innerWidth<960)setTimeout(()=>{const c=$("#auth-card");if(c)c.scrollIntoView({block:"start"})},50);
}
function gBtn(){return googleOn?`<a class="gbtn" href="/api/auth/google">${I.google} Vazhdo me Google</a>`:`<button type="button" class="gbtn" aria-disabled="true" id="g-off">${I.google} Vazhdo me Google</button>`}
function authCardHtml(tab,gerr){
  const ge=gerr==="google-off"?"Hyrja me Google nuk është aktivizuar ende. Përdorni email-in.":gerr?"Hyrja me Google nuk u krye. Provoni përsëri ose përdorni email-in.":"";
  if(tab==="login")return `<h2>Mirë se u ktheve!</h2><p class="sub">Hyr për të vazhduar aty ku e le.</p>
    <div class="tabs" role="tablist"><button role="tab" aria-selected="true" data-atab="login">Hyr</button><button role="tab" aria-selected="false" data-atab="signup">Regjistrohu</button></div>
    ${gBtn()}<div class="or">ose me email</div>
    <form class="auth-form" id="lform" novalidate>
      <label class="f">Email<input class="t" id="l-email" type="email" autocomplete="email" maxlength="120" placeholder="emri@shembull.com"></label>
      <label class="f">Fjalëkalimi<input class="t" id="l-pass" type="password" autocomplete="current-password"></label>
      <div class="err" id="a-err" role="alert">${esc(ge)}</div>
      <button class="btn btn-primary btn-lg" type="submit" id="l-btn">Hyr</button>
    </form>`;
  SU=SU||newSU();
  const s=SU;
  const head=`<h2>${s.step===1?"Krijo llogari falas":"Na trego pak për veten"}</h2><p class="sub">${s.step===1?"Duhen vetëm 30 sekonda.":"Kështu të tregojmë materialet dhe lojërat për nivelin tënd."}</p>
    <div class="tabs" role="tablist"><button role="tab" aria-selected="false" data-atab="login">Hyr</button><button role="tab" aria-selected="true" data-atab="signup">Regjistrohu</button></div>
    <div class="steps-dots" aria-label="Hapi ${s.step} nga 2"><i class="on"></i><i class="${s.step===2?"on":""}"></i></div>`;
  if(s.step===1)return head+`${gBtn()}<div class="or">ose me email</div>
    <form class="auth-form" id="sform1" novalidate>
      <label class="f">Emri dhe mbiemri<input class="t" id="s-name" autocomplete="name" maxlength="60" placeholder="p.sh. Drilon Berisha" value="${esc(s.name)}"></label>
      <label class="f">Email<input class="t" id="s-email" type="email" autocomplete="email" maxlength="120" placeholder="emri@shembull.com" value="${esc(s.email)}"></label>
      <label class="f">Fjalëkalimi <span class="opt">(të paktën 8 shkronja)</span><input class="t" id="s-pass" type="password" autocomplete="new-password" value="${esc(s.password)}"></label>
      <div class="err" id="a-err" role="alert">${esc(ge)}</div>
      <button class="btn btn-primary btn-lg" type="submit">Vazhdo ${I.arrow}</button>
    </form>`;
  return head+`<form class="auth-form" id="sform2" novalidate>${profileFieldsHtml(s,"s")}
      <div class="err" id="a-err" role="alert"></div>
      <div style="display:flex;gap:10px"><button class="btn btn-ghost" type="button" id="s-back">${I.back} Prapa</button><button class="btn btn-fun btn-lg" type="submit" id="s-btn" style="flex:1">Krijo llogarinë</button></div>
      <p style="font-size:12.5px;color:var(--muted);margin:0">Duke u regjistruar pranoni që materialet që ngarkoni t'i shohin përdoruesit e tjerë të Sinapsës.</p>
    </form>`;
}
/* Fushat e profilit (përdoren te regjistrimi dhe te profili) */
function profileFieldsHtml(d,px){
  const k=d.kind;
  return `<label class="f">Mosha<input class="t" id="${px}-age" type="number" inputmode="numeric" min="5" max="99" placeholder="p.sh. 20" value="${esc(d.age||"")}" style="max-width:140px"></label>
    <div class="f"><span>Unë jam</span><div class="kind-cards" role="group" aria-label="Unë jam">
      <button type="button" class="kind" data-kind="uni" aria-pressed="${k==="uni"}">${I.cap.replace(/14/g,"20")} Student<small>Universitet</small></button>
      <button type="button" class="kind" data-kind="school" aria-pressed="${k==="school"}">${I.school.replace(/14/g,"20")} Nxënës<small>Klasa 1–12</small></button>
      <button type="button" class="kind" data-kind="teacher" aria-pressed="${k==="teacher"}">${I.users.replace(/22/g,"20")} Mësues<small>Shkollë ose universitet</small></button>
    </div></div>
    ${k?`<label class="f">${k==="uni"?"Universiteti":k==="school"?"Shkolla":"Shkolla ose universiteti"}<input class="t" id="${px}-inst" maxlength="120" placeholder="${k==="uni"?"p.sh. Universiteti i Prishtinës":k==="school"?"p.sh. SHFMU “Naim Frashëri”":"p.sh. Gjimnazi “Sami Frashëri”"}" value="${esc(d.institution||"")}"></label>
    ${k!=="school"?`<label class="f">Fakulteti <span class="opt">${k==="teacher"?"(opsional)":""}</span><select class="t" id="${px}-fac"><option value="">${k==="teacher"?"– Nuk jap në universitet –":"– Zgjidhni fakultetin –"}</option>${facultyOptions(d.faculty)}</select></label>`:""}
    ${k==="uni"?`<label class="f">Viti i studimeve<select class="t" id="${px}-year"><option value="">– Zgjidhni vitin –</option>${yearOptions(d.year)}</select></label>`:""}
    ${k==="school"?`<label class="f">Klasa<select class="t" id="${px}-grade"><option value="">– Zgjidhni klasën –</option>${gradeOptions(d.grade)}</select></label>`:""}`:""}`;
}
function readProfileFields(d,px,root){
  const v=id=>{const el=$("#"+px+"-"+id,root);return el?el.value.trim():undefined};
  const a=v("age");if(a!==undefined)d.age=a;
  const i=v("inst");if(i!==undefined)d.institution=i;
  const f=v("fac");if(f!==undefined)d.faculty=f;
  const y=v("year");if(y!==undefined)d.year=y;
  const g=v("grade");if(g!==undefined)d.grade=g;
}
function checkProfile(d){
  const age=parseInt(d.age,10);
  if(!age||age<5||age>99)return"Shkruani moshën tuaj.";
  if(age<13)return"Llogaritë për fëmijët nën 13 vjeç do të hapen së shpejti, me email-in e prindit.";
  if(!d.kind)return"Zgjidhni: student, nxënës apo mësues.";
  if(!d.institution)return d.kind==="uni"?"Shkruani universitetin.":"Shkruani shkollën.";
  if(d.kind==="uni"&&!d.faculty)return"Zgjidhni fakultetin.";
  if(d.kind==="uni"&&!d.year)return"Zgjidhni vitin e studimeve.";
  if(d.kind==="school"&&!d.grade)return"Zgjidhni klasën.";
  return"";
}
function setAuthTab(t){const c=$("#auth-card");if(!c)return;view.tab=t;c.innerHTML=authCardHtml(t);bindAuthCard();try{history.replaceState(null,"",t==="login"?"#/hyr":"#/regjistrohu")}catch(e){}}
function bindAuthCard(){
  const c=$("#auth-card");if(!c)return;
  $$("[data-atab]",c).forEach(b=>b.onclick=()=>setAuthTab(b.dataset.atab));
  const goff=$("#g-off",c);if(goff)goff.onclick=()=>toast("Hyrja me Google do të aktivizohet së shpejti. Për tani përdorni email-in.");
  const lf=$("#lform",c);
  if(lf)lf.onsubmit=async e=>{e.preventDefault();const err=$("#a-err"),btn=$("#l-btn");err.textContent="";
    const body={email:$("#l-email").value.trim(),password:$("#l-pass").value,keys:ownerKeys()};
    if(!body.email||!body.password){err.textContent="Plotësoni email-in dhe fjalëkalimin.";return}
    btn.disabled=true;btn.textContent="Duke hyrë…";
    try{const r=await api("POST","/api/auth/login",body);me=r.me;afterLogin(`Mirë se u ktheve, ${firstName(me.name)}!`)}
    catch(ex){btn.disabled=false;btn.textContent="Hyr";err.textContent=ex.message}};
  const f1=$("#sform1",c);
  if(f1)f1.onsubmit=e=>{e.preventDefault();const err=$("#a-err");
    SU.name=$("#s-name").value.trim();SU.email=$("#s-email").value.trim();SU.password=$("#s-pass").value;
    if(!SU.name){err.textContent="Shkruani emrin tuaj.";$("#s-name").focus();return}
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(SU.email)){err.textContent="Shkruani një email të vlefshëm.";$("#s-email").focus();return}
    if(SU.password.length<8){err.textContent="Fjalëkalimi duhet të ketë të paktën 8 shkronja.";$("#s-pass").focus();return}
    SU.step=2;setAuthTab("signup");const a=$("#s-age");if(a)a.focus()};
  const f2=$("#sform2",c);
  if(f2){f2.dataset.px="s";
    $$("[data-kind]",f2).forEach(b=>b.onclick=()=>{readProfileFields(SU,"s",f2);SU.kind=b.dataset.kind;setAuthTab("signup");const i=$("#s-inst");if(i)i.focus()});
    $("#s-back").onclick=()=>{readProfileFields(SU,"s",f2);SU.step=1;setAuthTab("signup")};
    f2.onsubmit=async e=>{e.preventDefault();const err=$("#a-err"),btn=$("#s-btn");readProfileFields(SU,"s",f2);
      const bad=checkProfile(SU);if(bad){err.textContent=bad;return}
      btn.disabled=true;btn.textContent="Duke krijuar…";
      try{const r=await api("POST","/api/auth/signup",{name:SU.name,email:SU.email,password:SU.password,age:+SU.age,kind:SU.kind,institution:SU.institution,faculty:SU.faculty,year:SU.year?+SU.year:undefined,grade:SU.grade?+SU.grade:undefined,keys:ownerKeys()});
        me=r.me;SU=null;afterLogin(`Mirë se erdhe në Sinapsa, ${firstName(me.name)}!`,true)}
      catch(ex){btn.disabled=false;btn.textContent="Krijo llogarinë";err.textContent=ex.message;if(ex.status===409){SU.step=1}}};
  }
}
async function afterLogin(msg,isNew){
  P=null;loadProf();toast(msg);await refresh(true);
  if(isNew){setTimeout(()=>confetti(),200)}
  go(me.profileDone?"home":"profile",me.profileDone?{}:{params:new URLSearchParams("ri=1")});
}

/* ---------- profili dhe avatari ---------- */
let PF=null;
function renderProfile(){
  if(!me)return needLogin();
  const onboarding=!me.profileDone||(view.params&&view.params.get("ri")==="1");
  if(!PF||PF._uid!==me.id)PF={_uid:me.id,name:me.name,age:me.age||"",kind:me.kind||"",institution:me.institution||"",faculty:me.faculty||"",year:me.year||"",grade:me.grade||""};
  const cur=me.avatar&&me.avatar.preset;
  app.innerHTML=`
  ${onboarding?`<div class="welcome"><div><span class="eyebrow">${I.sparkS} Edhe një hap</span><h1>Mirë se erdhe, ${esc(firstName(me.name))}!</h1><p>Zgjidh një avatar dhe na trego shkollën ose universitetin. Kështu të tregojmë materialet dhe lojërat e duhura.</p></div>${avHtml(me,96,true)}</div>`
    :`<div class="page-head"><div><h1>Profili im</h1><p>Avatari, të dhënat e studimit dhe fjalëkalimi.</p></div><button class="btn btn-ghost" id="to-ach">${I.trophyS} Arritjet e mia</button></div>`}
  <section class="panel"><h2>Avatari</h2><p class="hint">Zgjidh një nga personazhet e Sinapsës ose ngarko foton tënde.</p>
    <div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap;margin-bottom:16px"><span id="av-now">${avHtml(me,96,true)}</span>
      <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn btn-primary" id="av-up">${I.img} Ngarko foto</button>${me.avatar?`<button class="btn btn-ghost" id="av-rm">Hiq avatarin</button>`:""}</div>
      <input type="file" id="av-file" accept="image/png,image/jpeg,image/webp,image/gif" hidden></div>
    <div class="av-grid">${AV_IDS.map(id=>`<button class="av-opt" data-av="${id}" aria-pressed="${cur===id}" aria-label="Avatari ${id.slice(1)}"><span class="av">${avatarSvg(id)}</span></button>`).join("")}</div>
  </section>
  <section class="panel" data-px="p"><h2>Të dhënat e mia</h2><p class="hint">Emri yt shfaqet te materialet dhe setet që krijon.</p>
    <form id="pform" class="auth-form" data-px="p" novalidate>
      <label class="f">Emri dhe mbiemri<input class="t" id="p-name" maxlength="60" value="${esc(PF.name)}"></label>
      ${profileFieldsHtml(PF,"p")}
      <div class="err" id="p-err" role="alert"></div>
      <div><button class="btn btn-fun btn-lg" type="submit" id="p-save">${onboarding?"Ruaj dhe vazhdo":"Ruaj ndryshimet"}</button></div>
    </form>
  </section>
  ${onboarding?"":`<section class="panel"><h2>${me.hasPassword?"Ndrysho fjalëkalimin":"Vendos një fjalëkalim"}</h2><p class="hint">${me.hasPassword?"Të paktën 8 shkronja.":"Hyni me Google. Nëse doni, vendosni edhe një fjalëkalim për të hyrë me email."}</p>
    <form id="pwform" style="display:flex;gap:10px;flex-wrap:wrap"><label class="sr" for="pw-new">Fjalëkalimi i ri</label><input class="t" id="pw-new" type="password" autocomplete="new-password" placeholder="Fjalëkalimi i ri" style="max-width:320px"><button class="btn btn-primary" type="submit">Ruaje</button></form></section>
  <section class="panel"><h2>Plani</h2><p class="hint" style="margin-bottom:10px">${me.plan==="premium"?"Keni planin Premium.":"Keni planin Falas."} Këtë muaj keni përdorur <b>${me.ai.used}</b> nga <b>${me.ai.limit>=9999?"pa kufi":me.ai.limit}</b> sete me AI.</p><button class="btn btn-ghost" data-go2="premium">${I.crownS} Shiko planet</button></section>`}`;
  const f=$("#pform");
  $$("[data-kind]",f).forEach(b=>b.onclick=()=>{readProfileFields(PF,"p",f);PF.name=$("#p-name").value;PF.kind=b.dataset.kind;renderProfile();const i=$("#p-inst");if(i)i.focus()});
  f.onsubmit=async e=>{e.preventDefault();const err=$("#p-err");err.textContent="";readProfileFields(PF,"p",f);PF.name=$("#p-name").value.trim();
    if(!PF.name){err.textContent="Shkruani emrin tuaj.";return}
    const bad=checkProfile(PF);if(bad){err.textContent=bad;return}
    const btn=$("#p-save");btn.disabled=true;
    try{const r=await api("PUT","/api/me",{name:PF.name,age:+PF.age,kind:PF.kind,institution:PF.institution,faculty:PF.faculty,year:PF.year?+PF.year:undefined,grade:PF.grade?+PF.grade:undefined});
      me=r.me;PF=null;renderNav();toast("Profili u ruajt");
      if(onboarding){lsSet("sin_lvl",me.kind==="school"?"school":"uni");go("home")}else renderProfile()}
    catch(ex){btn.disabled=false;err.textContent=ex.message}};
  const setAv=async av=>{try{const r=await api("PUT","/api/me",{avatar:av});me=r.me;renderNav();
      $("#av-now").innerHTML=avHtml(me,96,true);$$("[data-av]").forEach(b=>b.setAttribute("aria-pressed",String(!!(me.avatar&&me.avatar.preset===b.dataset.av))));toast("Avatari u ndryshua")}catch(ex){toast(ex.message)}};
  $$("[data-av]").forEach(b=>b.onclick=()=>setAv({preset:b.dataset.av}));
  const fi=$("#av-file");$("#av-up").onclick=()=>fi.click();
  fi.onchange=async()=>{const file=fi.files[0];fi.value="";if(!file)return;
    if(!/^image\//.test(file.type)){toast("Zgjidhni një foto.");return}
    try{toast("Duke ngarkuar foton…");const blob=await squareImage(file,320);const r=await uploadFile(blob,null,"avatar.jpg");await setAv({asset:r.id})}catch(ex){toast(ex.message||"Fotoja nuk u ngarkua.")}};
  const rm=$("#av-rm");if(rm)rm.onclick=()=>setAv(null);
  const pw=$("#pwform");if(pw)pw.onsubmit=async e=>{e.preventDefault();const v=$("#pw-new").value;if(v.length<8){toast("Fjalëkalimi duhet të ketë të paktën 8 shkronja.");return}
    try{const r=await api("PUT","/api/me",{password:v});me=r.me;$("#pw-new").value="";toast("Fjalëkalimi u ruajt")}catch(ex){toast(ex.message)}};
  const ta=$("#to-ach");if(ta)ta.onclick=()=>go("achievements");
  bindCommon();
}
/* Prerja e fotos në katror (në shfletues, para ngarkimit) */
function squareImage(file,size){
  return new Promise((resolve,reject)=>{
    const img=new Image(),url=URL.createObjectURL(file);
    img.onload=()=>{const s=Math.min(img.naturalWidth,img.naturalHeight),c=document.createElement("canvas");c.width=c.height=size;
      c.getContext("2d").drawImage(img,(img.naturalWidth-s)/2,(img.naturalHeight-s)/2,s,s,0,0,size,size);URL.revokeObjectURL(url);
      c.toBlob(b=>b?resolve(b):reject(new Error("Fotoja nuk u përpunua.")),"image/jpeg",.88)};
    img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("Kjo foto nuk mund të hapet."))};
    img.src=url;
  });
}

/* ---------- filtrat e listave ---------- */
function defaultLvl(){return me&&(me.kind==="school")?"school":"uni"}
const FL={lvl:null,fac:"",grade:"",inst:""};
function lvl(){return FL.lvl||lsGet("sin_lvl",null)||defaultLvl()}
function words(q){return q.toLowerCase().split(/\s+/).filter(Boolean)}
function hayOf(x){return [x.title,x.author,x.uploader,x.faculty,x.subject,x.description,x.institution,x.level==="school"?"klasa "+x.grade:"",...(x.files||[]).map(f=>f.name)].join(" ").toLowerCase()}
function passFilters(x,ignoreLevel){
  if(!ignoreLevel){const L=lvl();if((x.level||"uni")!==L)return false;
    if(L==="uni"&&FL.fac&&x.faculty!==FL.fac)return false;
    if(L==="school"&&FL.grade&&+x.grade!==+FL.grade)return false;
    if(FL.inst&&!String(x.institution||"").toLowerCase().includes(FL.inst.toLowerCase()))return false;}
  if(query){const h=hayOf(x);if(!words(query).every(w=>h.includes(w)))return false}
  return true;
}
function filtersHtml(){
  const L=lvl();
  return `<div class="filters">${seg("lvl",[["uni","Universitet"],["school","Shkolla · klasa 1–12"]],L)}
    ${L==="uni"?`<label class="sr" for="ff">Fakulteti</label><select class="t" id="ff">${facultyOptions(FL.fac,true)}</select>`:`<label class="sr" for="fg">Klasa</label><select class="t" id="fg">${gradeOptions(FL.grade,true)}</select>`}
    <label class="sr" for="fi">${L==="uni"?"Universiteti":"Shkolla"}</label><input class="t" id="fi" placeholder="${L==="uni"?"Universiteti…":"Shkolla…"}" value="${esc(FL.inst)}" style="max-width:220px">
    ${FL.fac||FL.grade||FL.inst?`<button class="link-btn" id="f-clear">Hiq filtrat</button>`:""}</div>`;
}
function bindFilters(rerender){
  $$("[data-lvl]",app).forEach(b=>b.onclick=()=>{FL.lvl=b.dataset.lvl;lsSet("sin_lvl",FL.lvl);FL.fac="";FL.grade="";rerender()});
  const ff=$("#ff");if(ff)ff.onchange=()=>{FL.fac=ff.value;rerender()};
  const fg=$("#fg");if(fg)fg.onchange=()=>{FL.grade=fg.value;rerender()};
  const fi=$("#fi");if(fi){let t;fi.oninput=()=>{clearTimeout(t);t=setTimeout(()=>{FL.inst=fi.value.trim();rerender();const n=$("#fi");if(n){n.focus();n.setSelectionRange(n.value.length,n.value.length)}},300)}}
  const fc=$("#f-clear");if(fc)fc.onclick=()=>{FL.fac="";FL.grade="";FL.inst="";rerender()};
}
const seg=(name,vals,cur)=>`<div class="seg" role="group">${vals.map(([v,l])=>`<button type="button" data-${name}="${v}" aria-pressed="${String(cur)===String(v)}">${l}</button>`).join("")}</div>`;
function emptyBox(title,text,btn){return `<div class="empty"><h3>${title}</h3>${text?`<p>${text}</p>`:""}${btn||""}</div>`}
function banner(){return dbState==="offline"?`<div class="notice">Nuk po lidhemi dot me serverin e Sinapsës. Kontrolloni internetin dhe rifreskoni faqen.</div>`:""}
const STRIPE=["var(--violet)","var(--pink)","var(--sky)","var(--mint)","var(--orange)","var(--sun)","var(--coral)"];
function authorRow(x,label,name){return `<div class="author">${avHtml({name,avatar:x.authorAvatar},32)}<div><div class="by">${label} · ${esc(ago(x.createdAt))}</div><div class="nm">${esc(name||"Anonim")}</div></div></div>`}
function matCard(m){
  const f=m.files||[];
  return `<button class="item-card" data-mat="${esc(m.id)}" style="--c:${STRIPE[hue(m.id)%7]}"><span class="stripe"></span>
    <div style="display:flex;gap:12px;align-items:center">${typeBox(f[0]&&f[0].name,f[0]&&f[0].asset)}<div class="meta-row">${levelPill(m)}${m.subject?`<span class="pill">${esc(m.subject)}</span>`:""}</div></div>
    <h3>${esc(m.title)}</h3>
    <div class="meta-row">${f.length>1?`<span>${plural(f.length,"skedar","skedarë")} së bashku</span><span aria-hidden="true">·</span>`:""}<span>${esc(fmtSize(f.reduce((a,x)=>a+(x.size||0),0)))}</span>${m.institution?`<span aria-hidden="true">·</span><span>${esc(m.institution)}</span>`:""}</div>
    ${authorRow(m,"Ngarkuar",m.uploader)}</button>`;
}
function setCard(s){
  const n=(s.cards||[]).length,q=(s.quiz||[]).length;
  const st=s.status==="pending"?`<span class="status-chip pending"><span class="spinner"></span> Po krijohet…</span>`:s.status==="failed"?`<span class="status-chip failed">Nuk u krijua</span>`:"";
  return `<button class="item-card" data-open="${esc(s.id)}" style="--c:${s.purpose==="games"?"var(--pink)":STRIPE[hue(s.id)%7]}"><span class="stripe"></span>
    <div class="meta-row">${levelPill(s)}${s.ai?`<span class="pill ai">${I.sparkS.replace(/16/g,"12")} AI</span>`:""}${s.purpose==="games"?`<span class="pill ai">${I.gameS.replace(/16/g,"12")} Lojëra</span>`:""}${st}</div>
    <h3>${esc(s.title||"Set pa titull")}</h3>
    <div class="meta-row">${s.subject?`<span>${esc(s.subject)}</span><span aria-hidden="true">·</span>`:""}${s.status==="ready"?`<span>${plural(n,"kartë","karta")}</span>${q?`<span aria-hidden="true">·</span><span>${q} pyetje</span>`:""}`:`<span>${plural((s.files||[]).length,"skedar","skedarë")}</span>`}${s.institution?`<span aria-hidden="true">·</span><span>${esc(s.institution)}</span>`:""}</div>
    ${authorRow(s,"Krijuar",s.author)}</button>`;
}
function bindCommon(){
  $$("[data-open]",app).forEach(b=>b.onclick=()=>{if(!me)return needLogin("Hyni ose regjistrohuni falas për të luajtur me këtë set.");go("set",{id:b.dataset.open})});
  $$("[data-mat]",app).forEach(b=>b.onclick=()=>{if(!me)return needLogin("Hyni ose regjistrohuni falas për ta hapur materialin.");go("material",{id:b.dataset.mat})});
  $$("[data-go2]",app).forEach(b=>b.onclick=()=>{const g=b.dataset.go2;if(!me&&!OPEN_VIEWS.includes(g))return needLogin();go(g)});
  $$("[data-create]",app).forEach(b=>b.onclick=()=>{if(!me)return needLogin();go("aicreate",{purpose:b.dataset.create})});
}
const loadingBox=()=>emptyBox("Duke u ngarkuar…");
function grid(list,fn,empty){return dbState==="loading"?loadingBox():list.length?`<div class="grid">${list.map(fn).join("")}</div>`:empty}

/* ---------- kreu (pas hyrjes) ---------- */
let LB=null,lbAt=0;
async function loadLeaderboard(force){if(!me)return null;if(!force&&LB&&Date.now()-lbAt<60000)return LB;try{LB=await api("GET","/api/leaderboard");lbAt=Date.now()}catch(e){}return LB}
function lbHtml(d,limit){
  if(!d)return `<div class="lb"><div class="lb-row"><span></span><span></span><span style="color:var(--muted)">Duke u ngarkuar…</span><span></span></div></div>`;
  const rows=d.rows.slice(0,limit||20);
  if(!rows.length)return `<div class="empty" style="padding:22px"><h3>Renditja e kësaj jave është bosh</h3><p>Luaj një lojë dhe dil i pari!</p></div>`;
  return `<div class="lb">${rows.map((r,i)=>`<div class="lb-row${r.me?" me":""}"><span class="rk${i<3?" top"+(i+1):""}">${i<3?["🥇","🥈","🥉"][i]:i+1}</span>${avHtml(r,32)}<b>${esc(r.name)}${r.me?" (ti)":""}</b><span class="x">${r.xp} XP</span></div>`).join("")}</div>`;
}
function renderHome(){
  if(!me)return renderLanding();
  const p=prof(),L=levelInfo(p.xp),my=lvl();
  const mySets=sets.filter(s=>s.status==="ready"&&(s.level||"uni")===my&&(my!=="uni"||!me.faculty||s.faculty===me.faculty));
  const recent=(mySets.length?mySets:sets.filter(s=>s.status==="ready"&&(s.level||"uni")===my)).slice(0,6);
  const pending=sets.filter(s=>s.mine&&s.status!=="ready");
  app.innerHTML=`${banner()}
  <div class="welcome">
    <div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap">${avHtml(me,96,true)}<div style="min-width:0;flex:1"><span class="eyebrow">${I.sparkS} ${greet()}</span><h1>${esc(firstName(me.name))}, çfarë mësojmë sot?</h1>
      <p>Niveli ${L.n} · ${L.title} · ${p.xp} XP${dayStreak()?` · ${I.flame} ${plural(dayStreak(),"ditë","ditë")} rresht`:""}</p><div class="lvl-bar" style="width:260px"><i style="width:${L.pct}%"></i></div></div></div>
    <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn btn-fun btn-lg" data-create="games">${I.spark} Krijo lojëra me AI</button><button class="btn btn-ghost" data-go2="upload">${I.upS} Ngarko material</button></div>
  </div>
  ${pending.length?`<div class="notice" style="background:var(--violet-soft)">${pending.map(s=>`<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:4px 0">${s.status==="pending"?`<span class="spinner" style="color:var(--violet)"></span> <b>${esc(s.title)}</b> po krijohet…`:`<b>${esc(s.title)}</b> nuk u krijua.`} <button class="link-btn" data-open="${esc(s.id)}">Hape</button></div>`).join("")}</div>`:""}
  <div class="section-head"><h2>Detyrat e ditës</h2><span class="meta-row">Rinisen çdo mëngjes · +${QUEST_XP} XP secila</span></div>
  ${questsHtml()}
  <section class="section"><div class="section-head"><h2>Sektorët</h2></div>${sectorsHtml()}</section>
  <div class="home-cols">
    <div>
      <section class="section"><div class="section-head"><h2>Të rejat për ty</h2><span class="meta-row">${my==="school"?"Shkolla":esc(me.faculty||"Universitet")} · <button class="link-btn" data-go2="sets">Shiko të gjitha</button></span></div>
        ${grid(recent,setCard,emptyBox("Ende nuk ka sete për nivelin tënd","Bëhu i pari: ngarko një ligjëratë dhe AI krijon kartat e lojërat.",`<button class="btn btn-primary" data-create="cards">${I.spark} Krijo me AI</button>`))}</section>
      <section class="section"><div class="section-head"><h2>Materialet më të reja</h2><span class="meta-row"><button class="link-btn" data-go2="materials">Shiko të gjitha</button></span></div>
        ${grid(materials.filter(m=>(m.level||"uni")===my).slice(0,4),matCard,emptyBox("Ende nuk ka materiale","Ndaj skriptat dhe ligjëratat me kolegët.",`<button class="btn btn-primary" data-go2="upload">Ngarko material</button>`))}</section>
    </div>
    <aside><div class="section-head"><h2>Renditja e javës</h2><button class="link-btn" data-go2="achievements">E plotë</button></div><div id="lb-mini">${lbHtml(LB,8)}</div>
      <div class="panel" style="margin-top:16px"><h2>Medaljet e tua</h2><p class="hint">${achCount().got} nga ${achCount().all} nivele medaljesh.</p><div style="display:flex;gap:8px;flex-wrap:wrap">${ACH.map(a=>{const t=achTier(a,p);return t?medal(a,t,true):""}).join("")||`<span style="color:var(--muted);font-size:14px">Luaj lojën e parë për medaljen e parë!</span>`}</div></div></aside>
  </div>
  <section class="section"><div class="section-head"><h2>Sinapsa për të gjithë</h2></div>${whoHtml()}</section>`;
  bindCommon();bindSectors();bindQuests();
  loadLeaderboard().then(d=>{const el=$("#lb-mini");if(el&&view.name==="home")el.innerHTML=lbHtml(d,8)});
}
function greet(){const h=new Date().getHours();return h<11?"Mirëmëngjes":h<18?"Mirëdita":"Mirëmbrëma"}

/* ---------- listat ---------- */
function pageHead(title,sub,btns){return `<div class="page-head"><div><h1>${title}</h1>${sub?`<p>${sub}</p>`:""}</div>${btns?`<div style="display:flex;gap:10px;flex-wrap:wrap">${btns}</div>`:""}</div>`}
function renderMaterials(){
  const M=materials.filter(m=>passFilters(m));
  app.innerHTML=banner()+pageHead("Materialet","Skripta, ligjërata, prezantime dhe foto të shënimeve – për t'i hapur këtu ose për t'i shkarkuar. Disa skedarë të ngarkuar bashkë mbeten një material.",`<button class="btn btn-primary" data-go2="upload">${I.upS} Ngarko material</button>`)
    +filtersHtml()+`<div class="section-head"><h2>${lvl()==="school"?(FL.grade?"Klasa "+esc(FL.grade):"Shkolla"):esc(FL.fac||"Të gjitha materialet")}</h2><span class="meta-row">${plural(M.length,"material","materiale")}</span></div>`
    +grid(M,matCard,emptyBox(query?`Asnjë material për “${esc(query)}”`:"Ende nuk ka materiale këtu","Ndaj skriptat, ligjëratat dhe detyrat me të tjerët.",`<button class="btn btn-primary" data-go2="upload">Ngarko material</button>`));
  bindCommon();bindFilters(renderMaterials);
}
function renderSets(){
  const S=sets.filter(s=>s.purpose!=="games"&&passFilters(s)&&(s.status==="ready"||s.mine));
  app.innerHTML=banner()+pageHead("Kartat & Kuizet","Ngarko materialin dhe AI krijon karta e kuiz që mbulojnë gjithë përmbajtjen. Ose shkruaji kartat vetë.",
      `<button class="btn btn-fun" data-create="cards">${I.spark} Krijo me AI</button><button class="btn btn-ghost" data-go2="manual">${I.pen} Shkruaji vetë</button>`)
    +(me?quotaHtml():"")+filtersHtml()+`<div class="section-head"><h2>Setet</h2><span class="meta-row">${plural(S.length,"set","sete")}</span></div>`
    +grid(S,setCard,emptyBox(query?`Asnjë set për “${esc(query)}”`:"Ende nuk ka sete këtu","Ngarko një ligjëratë dhe Sinapsa krijon kartat për ty.",`<button class="btn btn-primary" data-create="cards">${I.spark} Krijo me AI</button>`));
  bindCommon();bindFilters(renderSets);
}
function renderGames(){
  const G=sets.filter(s=>s.purpose==="games"&&passFilters(s)&&(s.status==="ready"||s.mine));
  const other=sets.filter(s=>s.purpose!=="games"&&s.status==="ready"&&passFilters(s)).slice(0,6);
  app.innerHTML=banner()+pageHead("Lojërat","Ngarko materialin – AI krijon pyetjet dhe ti zgjedh lojën. Ose luaji të gjitha një nga një.",`<button class="btn btn-fun" data-create="games">${I.spark} Krijo lojëra me AI</button>`)
    +`<div class="games-gallery">${MODES.map(m=>`<div class="gg m-${m.id}" style="--c:var(--c);--c-soft:var(--cs)"><span class="ic" style="background:var(--c)">${m.icon}</span><div><b>${m.name}</b><small>${m.desc}</small></div></div>`).join("")}</div>`
    +(me?quotaHtml():"")+filtersHtml()+`<div class="section-head"><h2>Setet e lojërave</h2><span class="meta-row">${plural(G.length,"set","sete")}</span></div>`
    +grid(G,setCard,emptyBox(query?`Asnjë set për “${esc(query)}”`:"Ende nuk ka lojëra këtu","Ngarko materialin dhe luaj brenda një minute.",`<button class="btn btn-primary" data-create="games">${I.spark} Krijo lojëra</button>`))
    +(other.length?`<section class="section" style="margin-top:30px"><div class="section-head"><h2>Luaj edhe me setet e kartave</h2><span class="meta-row">Çdo set ka të 8 lojërat</span></div><div class="grid">${other.map(setCard).join("")}</div></section>`:"");
  bindCommon();bindFilters(renderGames);
}
function renderSearch(){
  const S=sets.filter(s=>(s.status==="ready"||s.mine)&&passFilters(s,true)),M=materials.filter(m=>passFilters(m,true));
  app.innerHTML=banner()+pageHead(query?`Rezultatet për “${esc(query)}”`:"Kërko","Kërkohet në titull, lëndë, fakultet, universitet dhe emrin e autorit.")
    +`<section class="section"><div class="section-head"><h2>Setet</h2><span class="meta-row">${plural(S.length,"set","sete")}</span></div>${grid(S,setCard,emptyBox("Asnjë set","Provoni një fjalë më të shkurtër."))}</section>`
    +`<section class="section"><div class="section-head"><h2>Materialet</h2><span class="meta-row">${plural(M.length,"material","materiale")}</span></div>${grid(M,matCard,emptyBox("Asnjë material"))}</section>`;
  bindCommon();
}
function renderMine(){
  if(!me)return needLogin();
  const S=sets.filter(isMine),M=materials.filter(isMine);
  app.innerHTML=pageHead("Të miat","Setet, lojërat dhe materialet që keni krijuar.")
    +`<section class="section"><div class="section-head"><h2>Setet dhe lojërat e mia</h2><span class="meta-row">${plural(S.length,"set","sete")}</span></div>${grid(S,setCard,emptyBox("Ende nuk keni sete","",`<button class="btn btn-primary" data-create="cards">${I.spark} Krijo me AI</button>`))}</section>`
    +`<section class="section"><div class="section-head"><h2>Materialet e mia</h2><span class="meta-row">${plural(M.length,"material","materiale")}</span></div>${grid(M,matCard,emptyBox("Ende nuk keni materiale","",`<button class="btn btn-primary" data-go2="upload">Ngarko material</button>`))}</section>`;
  bindCommon();
}
function quotaHtml(){
  if(!me||!me.ai)return"";const a=me.ai;if(a.limit>=9999)return"";
  return `<div class="quota" style="margin-bottom:18px">${I.spark}<span>Sete me AI këtë muaj: <b>${a.used}</b> nga ${a.limit}</span><span class="qb"><i style="width:${Math.min(100,a.used/a.limit*100).toFixed(0)}%"></i></span>${me.plan!=="premium"?`<button class="link-btn" data-go2="premium">Më shumë me Premium</button>`:""}</div>`;
}

/* ---------- ngarkimi i materialit (disa skedarë = një material) ---------- */
let UP=null;
function levelFieldsHtml(d,px,instRequired){
  return `<div class="f full"><span>Për kë është?</span>${seg(px+"lv",[["uni","Universitet"],["school","Shkollë (klasa 1–12)"]],d.level)}</div>
    <label class="f">${d.level==="uni"?"Universiteti":"Shkolla"} ${instRequired&&d.level==="uni"?"":`<span class="opt">(opsionale)</span>`}<input class="t" id="${px}-inst" maxlength="120" placeholder="${d.level==="uni"?"p.sh. Universiteti i Prishtinës":"p.sh. SHFMU “Naim Frashëri”"}" value="${esc(d.institution)}"></label>
    ${d.level==="uni"?`<label class="f">Fakulteti<select class="t" id="${px}-fac"><option value="">– Zgjidhni fakultetin –</option>${facultyOptions(d.faculty)}</select></label>`
      :`<label class="f">Klasa<select class="t" id="${px}-grade"><option value="">– Zgjidhni klasën –</option>${gradeOptions(d.grade)}</select></label>`}
    <label class="f">Lënda <span class="opt">(opsionale)</span><input class="t" id="${px}-subj" maxlength="60" placeholder="${d.level==="uni"?"p.sh. Anatomia":"p.sh. Matematika"}" value="${esc(d.subject)}"></label>`;
}
function readLevelFields(d,px){const v=id=>{const e=$("#"+px+"-"+id);return e?e.value.trim():null};
  const i=v("inst");if(i!=null)d.institution=i;const f=v("fac");if(f!=null)d.faculty=f;const g=v("grade");if(g!=null)d.grade=g;const s=v("subj");if(s!=null)d.subject=s}
function checkLevel(d,instRequired){if(d.level==="uni"&&instRequired&&!d.institution)return"Shkruani universitetin – kolegët kërkojnë sipas tij.";if(d.level==="uni"&&!d.faculty)return"Zgjidhni fakultetin.";if(d.level==="school"&&!d.grade)return"Zgjidhni klasën.";return""}
function levelDefaults(){const k=me&&me.kind;return{level:k==="school"?"school":k==="teacher"?(me.faculty?"uni":"school"):"uni",institution:(me&&me.institution)||"",faculty:(me&&me.faculty)||"",grade:(me&&me.grade)||"",subject:""}}
function dropHtml(id,accept,label,small){return `<div class="drop" id="${id}" tabindex="0" role="button" aria-label="${esc(label)}">${I.up}<strong>${label}</strong><small>${small}</small></div><input type="file" id="${id}-in" hidden multiple accept="${accept}">`}
function bindDrop(id,onFiles,busy){const d=$("#"+id),fi=$("#"+id+"-in");if(!d)return;
  d.onclick=()=>{if(!busy())fi.click()};d.onkeydown=e=>{if((e.key==="Enter"||e.key===" ")&&!busy()){e.preventDefault();fi.click()}};
  d.ondragover=e=>{e.preventDefault();d.classList.add("over")};d.ondragleave=()=>d.classList.remove("over");
  d.ondrop=e=>{e.preventDefault();d.classList.remove("over");if(!busy())onFiles(e.dataTransfer.files)};fi.onchange=()=>{onFiles(fi.files);fi.value=""}}
function fileRows(list,busy,rmAttr){return list.map((f,i)=>`<div class="file-item">${typeBox(f.file.name,null,f.preview)}<div class="file-meta"><b>${esc(f.file.name)}</b><small>${esc(fmtSize(f.file.size))}${f.done?" · u ngarkua ✓":""}</small></div>${busy?"":`<button class="icon-btn del" ${rmAttr}="${i}" aria-label="Hiq ${esc(f.file.name)}">${I.trash}</button>`}</div>`).join("")}
function renderUpload(){
  if(!me)return needLogin();
  if(!UP)UP=Object.assign({title:"",uploader:me.name,description:"",files:[],busy:false},levelDefaults());
  const u=UP;
  app.innerHTML=`<button class="back" id="back">${I.back} Materialet</button>
  ${pageHead("Ngarko material","Zgjidh një ose disa skedarë – të gjithë bashkohen në <b>një material</b>. Këtu vetëm ndahen materialet; për karta dhe lojëra përdor sektorët e tyre.")}
  <section class="panel"><h2>1. Skedarët</h2><p class="hint">PDF, Word, PowerPoint, Excel, foto, tekst ose ZIP – deri në ${MAX_MB} MB secili, deri në 30 skedarë.</p>
    ${dropHtml("mdrop",MAT_EXT.map(e=>"."+e).join(","),"Prek për të zgjedhur skedarët ose tërhiqi këtu","PDF · DOCX · PPTX · XLSX · JPG/PNG · TXT · ZIP")}
    <div class="file-list" id="mlist">${fileRows(u.files,u.busy,"data-rmm")}</div></section>
  <section class="panel"><h2>2. Përshkruaje</h2><p class="hint">Universiteti, fakulteti dhe lënda ndihmojnë të tjerët ta gjejnë materialin.</p>
    <div class="fields">
      <label class="f full">Emri i materialit<input class="t" id="m-title" maxlength="140" placeholder="p.sh. Fiziologjia – ligjëratat 1–5" value="${esc(u.title)}"></label>
      ${levelFieldsHtml(u,"m",true)}
      <label class="f">Ngarkuar nga<input class="t" id="m-upl" maxlength="60" placeholder="p.sh. Drilon Berisha" value="${esc(u.uploader)}"></label>
      <label class="f full">Përshkrimi <span class="opt">(opsional)</span><input class="t" id="m-desc" maxlength="500" placeholder="p.sh. Për provimin e janarit, me skemat nga ushtrimet" value="${esc(u.description)}"></label>
    </div></section>
  <div class="err" id="m-err" role="alert"></div><div class="bar" id="mbar" hidden><i></i></div>
  <div class="save-bar"><button class="btn btn-ghost" id="m-cancel">Anulo</button><button class="btn btn-primary btn-lg" id="m-save">Ngarko materialin</button></div>`;
  const keep=()=>{readLevelFields(u,"m");u.title=$("#m-title").value;u.uploader=$("#m-upl").value;u.description=$("#m-desc").value};
  $$("[data-mlv]").forEach(b=>b.onclick=()=>{keep();u.level=b.dataset.mlv;renderUpload()});
  const showList=()=>{$("#mlist").innerHTML=fileRows(u.files,u.busy,"data-rmm");$$("[data-rmm]").forEach(b=>b.onclick=()=>{u.files.splice(+b.dataset.rmm,1);showList()})};showList();
  bindDrop("mdrop",fl=>{for(const f of fl){const e=extOf(f.name);
      if(!MAT_EXT.includes(e)){toast(`“${f.name}” nuk lejohet.`);continue}
      if(f.size>MAX_MB*1048576){toast(`“${f.name}” është më i madh se ${MAX_MB} MB.`);continue}
      if(u.files.length>=30){toast("Deri në 30 skedarë për një material.");break}
      u.files.push({file:f,preview:/^image\//.test(f.type)?URL.createObjectURL(f):""})}
    if(!u.title.trim()&&u.files.length){u.title=u.files[0].file.name.replace(/\.[^.]+$/,"").replace(/[_]+/g," ");$("#m-title").value=u.title}
    showList()},()=>u.busy);
  $("#back").onclick=$("#m-cancel").onclick=()=>{if(u.busy)return;UP=null;go("materials")};
  $("#m-save").onclick=async()=>{
    keep();const err=$("#m-err");err.textContent="";
    if(!u.files.length){err.textContent="Zgjidhni të paktën një skedar.";return}
    if(!u.title.trim()){err.textContent="Shkruani emrin e materialit.";$("#m-title").focus();return}
    const bad=checkLevel(u,true);if(bad){err.textContent=bad;return}
    const btn=$("#m-save"),bar=$("#mbar");u.busy=true;btn.disabled=true;bar.hidden=false;showList();
    try{
      const out=await uploadAll(u.files,(pct)=>{bar.firstElementChild.style.width=(pct*100).toFixed(0)+"%";btn.textContent=`Duke ngarkuar ${Math.round(pct*100)}%`},showList);
      const rec=await api("POST","/api/materials",{title:u.title.trim(),uploader:u.uploader.trim(),description:u.description.trim(),files:out,level:u.level,institution:u.institution,faculty:u.faculty,grade:u.grade,subject:u.subject});
      upsert(materials,rec);UP=null;bump("uploads");toast("Materiali u ngarkua – faleminderit që ndihmon të tjerët!");go("material",{id:rec.id});
    }catch(e){u.busy=false;btn.disabled=false;btn.textContent="Provo përsëri";bar.hidden=true;err.textContent=e.message;showList()}
  };
}
/* Ngarkon skedarët një nga një dhe kthen listën {asset,name,type,size} */
async function uploadAll(list,onPct,onEach){
  const total=list.reduce((a,f)=>a+f.file.size,0)||1;let done=0;const out=[];
  for(const f of list){
    if(!f.asset){const r=await uploadFile(f.file,p=>onPct((done+p*f.file.size)/total));f.asset=r.id;f.done=true;if(onEach)onEach()}
    done+=f.file.size;onPct(done/total);out.push({asset:f.asset,name:f.file.name,type:f.file.type,size:f.file.size});
  }
  return out;
}
function upsert(arr,rec){const i=arr.findIndex(s=>s.id===rec.id);if(i>=0)arr[i]=rec;else arr.unshift(rec)}

/* ---------- materiali ---------- */
const loaded={};
function loadScript(src){return loaded[src]||(loaded[src]=new Promise((res,rej)=>{const s=document.createElement("script");s.src=src;s.onload=res;s.onerror=()=>{delete loaded[src];rej(new Error("load"))};document.head.appendChild(s)}))}
function renderMaterial(){
  if(!me)return needLogin("Hyni për ta hapur materialin.");
  const m=materials.find(x=>x.id===view.id);
  if(!m){app.innerHTML=dbState==="loading"?loadingBox():emptyBox("Ky material është fshirë ose nuk ekziston","",`<button class="btn btn-primary" data-go2="materials">Te materialet</button>`);bindCommon();return}
  const files=m.files||[];let cur=Math.min(+(view.file||0),files.length-1);if(cur<0)cur=0;
  app.innerHTML=`<button class="back" id="back">${I.back} Materialet</button>
  <div class="page-head" style="align-items:flex-start">
    <div style="min-width:0;flex:1"><div class="meta-row" style="margin-bottom:10px">${levelPill(m)}${m.subject?`<span class="pill">${esc(m.subject)}</span>`:""}${m.institution?`<span class="pill uni">${esc(m.institution)}</span>`:""}<span class="pill">${plural(files.length,"skedar","skedarë")}</span></div>
      <h1 class="set-title">${esc(m.title)}</h1>${m.description?`<p class="set-desc">${esc(m.description)}</p>`:""}
      <div class="set-meta"><div class="author" style="border:0;padding:0;margin:0">${avHtml({name:m.uploader,avatar:m.authorAvatar},40)}<div><div class="by">Ngarkuar nga · ${esc(ago(m.createdAt))}</div><div class="nm">${esc(m.uploader||"Anonim")}</div></div></div></div></div>
    <div class="detail-actions">${canManage(m)?`<button class="btn btn-danger" id="mdel">${I.trash} Fshi</button>`:`<button class="btn btn-ghost" id="report">Raporto</button>`}</div>
  </div>
  <div id="confirm-slot"></div>
  <div class="file-list" style="margin-top:18px">${files.map((f,i)=>`<div class="file-item">${typeBox(f.name,f.asset)}<div class="file-meta"><b>${esc(f.name)}</b><small>${esc(kindOf(f.name)[1])} · ${esc(fmtSize(f.size))}</small></div>
    <button class="btn btn-ghost btn-sm" data-vf="${i}">Shiko</button><a class="btn btn-primary btn-sm" href="${esc(dlUrl(f.asset,f.name))}" download="${esc(f.name)}">${I.down} Shkarko</a></div>`).join("")}</div>
  <section class="viewer" id="viewer"><div class="viewer-head">${files.length>1?`<div class="vtabs">${files.map((f,i)=>`<button data-vf="${i}" aria-pressed="${i===cur}" title="${esc(f.name)}">${i+1}. ${esc(f.name)}</button>`).join("")}</div>`:`<b>Parapamja</b>`}<span class="meta-row" id="vhint"></span></div><div class="viewer-body" id="vbody"><div class="msg">Duke hapur skedarin…</div></div></section>`;
  $("#back").onclick=()=>go("materials");
  const del=$("#mdel");if(del)del.onclick=()=>confirmDelete(m.title,async()=>{await api("DELETE","/api/materials/"+encodeURIComponent(m.id),null,ownerHeader(m.id));materials=materials.filter(x=>x.id!==m.id);toast("Materiali u fshi");go("materials")});
  const rp=$("#report");if(rp)rp.onclick=()=>reportBox("material",m.id);
  $$("[data-vf]").forEach(b=>b.onclick=()=>{view.file=+b.dataset.vf;$$(".vtabs [data-vf]").forEach(x=>x.setAttribute("aria-pressed",String(+x.dataset.vf===view.file)));showPreview(m,files[view.file]);$("#viewer").scrollIntoView({behavior:reduceMotion()?"auto":"smooth",block:"start"})});
  if(files.length)showPreview(m,files[cur]);
}
async function showPreview(m,f){
  const box=$("#vbody"),hint=$("#vhint");if(!box)return;hint.textContent="";const url=fileUrl(f),[k]=kindOf(f.name),e=extOf(f.name);
  const cant=t=>{box.innerHTML=`<div class="msg"><b>${t}</b>Shkarkojeni skedarin për ta hapur në kompjuter ose telefon.<br><br><a class="btn btn-primary" href="${esc(dlUrl(f.asset,f.name))}" download="${esc(f.name)}">${I.down} Shkarko</a></div>`};
  const still=()=>view.name==="material"&&view.id===m.id;
  try{
    if(k==="pdf"){box.innerHTML=`<iframe src="${esc(url)}" title="${esc(f.name)}"></iframe>`;hint.innerHTML=`<a href="${esc(url)}" target="_blank" rel="noopener">${I.ext} Hape në skedë të re</a>`;return}
    if(k==="foto"){box.innerHTML=`<div class="img-wrap"><img src="${esc(url)}" alt="${esc(f.name)}" style="cursor:zoom-in" id="vimg"></div>`;$("#vimg").onclick=()=>lightbox(url);return}
    if(e==="txt"){const t=await (await fetch(url)).text();if(!still())return;box.innerHTML=`<pre></pre>`;box.firstElementChild.textContent=t.slice(0,500000);return}
    if(e==="docx"){await loadScript("/vendor/jszip.min.js");await loadScript("/vendor/docx-preview.min.js");
      const blob=await (await fetch(url)).blob();if(!still())return;box.innerHTML=`<div class="docx-wrap"></div>`;
      await window.docx.renderAsync(blob,box.firstElementChild,null,{inWrapper:true,ignoreLastRenderedPageBreak:true});hint.textContent="Paraqitja mund të ndryshojë pak nga origjinali.";return}
    if(["xlsx","xls","ods","csv"].includes(e)){await loadScript("/vendor/xlsx.full.min.js");
      const buf=await (await fetch(url)).arrayBuffer();if(!still())return;const wb=window.XLSX.read(buf,{type:"array"});
      box.innerHTML=`${wb.SheetNames.length>1?`<div class="vtabs" style="padding:10px 14px">${wb.SheetNames.map(n=>`<button data-sheet="${esc(n)}">${esc(n)}</button>`).join("")}</div>`:""}<div class="sheet-wrap"></div>`;
      const show=n=>{box.querySelector(".sheet-wrap").innerHTML=window.XLSX.utils.sheet_to_html(wb.Sheets[n],{header:"",footer:""});$$("[data-sheet]",box).forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.sheet===n)))};
      $$("[data-sheet]",box).forEach(b=>b.onclick=()=>show(b.dataset.sheet));show(wb.SheetNames[0]);return}
    if(e==="doc")return cant("Skedarët e vjetër Word (.doc) nuk mund të shfaqen këtu.");
    if(k==="ppt")return cant("Prezantimet PowerPoint nuk mund të shfaqen këtu.");
    if(k==="zip")return cant("Arkivat ZIP nuk mund të hapen këtu.");
    return cant("Ky lloj skedari nuk mund të shfaqet këtu.");
  }catch(err){cant("Parapamja nuk u hap.")}
}
function lightbox(src){const lb=document.createElement("div");lb.className="lightbox";lb.innerHTML=`<img src="${esc(src)}" alt="">`;lb.onclick=()=>lb.remove();document.body.appendChild(lb)}

/* ---------- fshirja dhe raportimi ---------- */
function confirmDelete(title,run){
  const slot=$("#confirm-slot");if(!slot)return;
  slot.innerHTML=`<div class="confirm"><b>Ta fshini “${esc(title)}” për të gjithë?</b> Ky veprim nuk kthehet mbrapsht.<span style="flex:1"></span><button class="btn btn-ghost" id="no">Jo, mbaje</button><button class="btn btn-primary" style="background:var(--danger)" id="yes">Po, fshije</button></div>`;
  $("#no").onclick=()=>slot.innerHTML="";
  $("#yes").onclick=async()=>{try{await run()}catch(e){toast(e.status===403?e.message:"Fshirja dështoi. Provoni përsëri.")}};
}
function reportBox(type,id){
  const slot=$("#confirm-slot");
  slot.innerHTML=`<form class="report-box" id="rform"><label class="sr" for="r-reason">Arsyeja</label><input class="t" id="r-reason" maxlength="300" placeholder="Pse po e raportoni? p.sh. përmbajtje e gabuar, spam, e drejtë autori"><button class="btn btn-primary" type="submit">Dërgo raportin</button><button class="btn btn-ghost" type="button" id="r-cancel">Anulo</button></form>`;
  $("#r-reason").focus();$("#r-cancel").onclick=()=>slot.innerHTML="";
  $("#rform").onsubmit=async e=>{e.preventDefault();try{await api("POST","/api/reports",{type,id,reason:$("#r-reason").value.trim()});slot.innerHTML="";toast("Faleminderit! Admini do ta shqyrtojë.")}catch(err){toast(err.message)}};
}

/* ---------- rreth nesh, grupet, premium ---------- */
function renderAbout(){
  app.innerHTML=`<div class="welcome"><div><span class="eyebrow">Rreth nesh</span><h1>Ashtu si sinapsat lidhin neuronet, ne lidhim ata që mësojnë.</h1>
    <p>Sinapsa lindi nga studentë që donin një mënyrë më të lehtë për t'u përgatitur për provime. Sot është vendi ku studentët, nxënësit dhe mësuesit ndajnë materiale dhe i kthejnë ato në lojëra – në gjuhën shqipe.</p></div>
    <span class="smark" style="width:110px;height:126px;color:var(--brand)" aria-hidden="true"></span></div>
  <section class="section"><div class="section-head"><h2>Çfarë bën secili sektor</h2></div>
    <div class="who-grid">
      <div class="panel"><h2 style="color:var(--sky-ink)">Materialet</h2><p>Vendi ku ndihmojmë njëri-tjetrin. Ngarko skripta, ligjërata, prezantime ose foto të shënimeve, me universitetin, fakultetin dhe lëndën. Disa skedarë të ngarkuar bashkë mbeten një material.</p></div>
      <div class="panel"><h2 style="color:var(--violet-ink)">Kartat & Kuizet</h2><p>Ngarko materialin dhe AI krijon karta për çdo gjë të rëndësishme – aq sa duhen për ta mbuluar të gjithin – plus kuiz me shpjegime. Mund t'i shkruash edhe vetë.</p></div>
      <div class="panel"><h2 style="color:var(--pink-ink)">Lojërat</h2><p>8 lojëra nga i njëjti material: Karta, Kuiz, Sprint 60s, E vërtetë apo e gabuar, Përputh, Plotëso, Memory dhe Balona. Për nxënësit e vegjël lojërat janë më të gëzuara.</p></div>
    </div></section>
  <section class="panel"><h2>Për universitetin dhe për shkollën</h2><p class="hint" style="margin:0">Përmbajtja e fakulteteve dhe ajo e shkollave (klasa 1–12) mbahen të ndara. Mësuesit mund të ngarkojnë mësimin dhe të marrin kuize gati për klasën. Së shpejti vijnë grupet e studimit, klasat me kod dhe sfidat live.</p></section>
  <section class="panel"><h2>Na ndiqni</h2><p class="hint">Lajmet, këshillat për mësim dhe veçoritë e reja i ndajmë në rrjetet sociale.</p>
    <div style="display:flex;gap:10px;flex-wrap:wrap">${SOCIALS.map(s=>`<a class="btn btn-ghost" href="${s.url}" target="_blank" rel="noopener">${s.icon} ${s.name} <span class="opt">${esc(s.handle)}</span></a>`).join("")}</div></section>
  <section class="panel"><h2>Keni gjetur diçka të gabuar?</h2><p class="hint" style="margin:0">Te çdo set ose material shtypni <b>Raporto</b>. Vetëm ai që e ka krijuar dhe adminët mund ta ndryshojnë ose fshijnë.</p></section>`;
}
function renderGroups(){
  app.innerHTML=`<div class="welcome" style="background:linear-gradient(120deg,var(--mint-soft),#E7F5FF 60%,var(--violet-soft))"><div><span class="eyebrow">Së shpejti</span><h1>Grupet e studimit</h1><p>Mësoni bashkë me kolegët ose me klasën. Po e ndërtojmë tani – do të jetë gati në fazën e ardhshme.</p></div><span class="ic" style="width:96px;height:96px;border-radius:30px;background:var(--mint);color:#fff;display:grid;place-items:center">${I.users.replace(/22/g,"48")}</span></div>
  <div class="sectors">
    <div class="sector c-mint soon"><span class="ic">${I.users}</span><h3>Klasa me kod</h3><p>Mësuesi krijon klasën, nxënësit hyjnë me një kod 6-shifror.</p><span class="soon-b">Së shpejti</span></div>
    <div class="sector c-pink soon"><span class="ic">${I.bolt}</span><h3>Sfida live</h3><p>Si Kahoot: pyetjet në ekran, të gjithë përgjigjen nga telefoni, renditja live.</p><span class="soon-b">Së shpejti</span></div>
    <div class="sector c-violet soon"><span class="ic">${I.cards}</span><h3>Sete të përbashkëta</h3><p>Grupi ndan kartat, kuizet dhe lojërat – çdo gjë që keni krijuar.</p><span class="soon-b">Së shpejti</span></div>
    <div class="sector c-sun soon"><span class="ic">${I.trophy}</span><h3>Renditja e grupit</h3><p>Kush mëson më shumë këtë javë? XP dhe medalje brenda grupit.</p><span class="soon-b">Së shpejti</span></div>
  </div>
  <p style="margin-top:22px;color:var(--muted)">Deri atëherë: krijoni një set me AI dhe ndajeni lidhjen me shokët – secili luan me llogarinë e vet.</p>`;
}
function renderPremium(){
  const pr=me&&me.plan==="premium";
  app.innerHTML=`${pageHead("Planet e Sinapsës","Lojërat, kartat dhe materialet janë falas për të gjithë. Krijimi me AI kushton, ndaj plani falas ka një kufi mujor.")}
  <div class="plans">
    <div class="plan"><h3>Falas</h3><div class="price">0 € <small>/ përgjithmonë</small></div>
      <ul><li>${LIMITS.free} sete me AI në muaj</li><li>Të 8 lojërat, pa kufi</li><li>Materiale pa kufi për të ngarkuar e shkarkuar</li><li>Karta të shkruara vetë pa kufi</li><li>Arritje, nivele dhe renditje</li></ul>
      ${me&&!pr?`<button class="btn btn-ghost" disabled>Plani yt aktual</button>`:""}</div>
    <div class="plan pro"><h3>${I.crown} Premium</h3><div class="price">3,99 € <small>/ muaj</small></div>
      <ul><li><b>${LIMITS.premium}</b> sete me AI në muaj</li><li>Gjithçka nga plani Falas</li><li>Distinktivi Premium në profil</li><li>Përparësi për veçoritë e reja (grupet, sfidat live)</li></ul>
      ${pr?`<button class="btn btn-primary" disabled>Ke Premium ✓</button>`:`<button class="btn btn-fun" id="go-pro">${I.crownS} Më njofto kur të hapen pagesat</button>`}
      <small style="color:var(--muted)">Pagesat online hapen së shpejti. Deri atëherë, për Premium na shkruani në Instagram.</small></div>
  </div>
  ${me?`<div class="panel" style="margin-top:22px;max-width:860px"><h2>Përdorimi yt këtë muaj</h2>${quotaHtml()||`<p class="hint" style="margin:0">Pa kufi.</p>`}</div>`:""}`;
  const b=$("#go-pro");if(b)b.onclick=()=>{lsSet("sin_pro_wait",1);toast("Faleminderit! Do të të njoftojmë sapo të hapen pagesat.")};
  bindCommon();
}

/* ---------- krijimi me AI (shumë skedarë = një set) ---------- */
let AC=null;
function renderAiCreate(){
  if(!me)return needLogin();
  const purpose=view.purpose==="games"?"games":"cards";
  if(!AC||AC.purpose!==purpose)AC=Object.assign({purpose,title:"",language:"sq",files:[],busy:false},levelDefaults());
  const a=AC,q=me.ai||{used:0,limit:LIMITS.free,left:LIMITS.free},out=q.left<=0;
  const g=purpose==="games";
  app.innerHTML=`<button class="back" id="back">${I.back} ${g?"Lojërat":"Kartat & Kuizet"}</button>
  ${pageHead(g?"Krijo lojëra me AI":"Krijo karta & kuiz me AI",g?"Ngarko materialin – AI krijon pyetjet për të 8 lojërat. Pastaj zgjidh lojën që do, ose luaji të gjitha.":"Ngarko materialin – AI krijon karta për çdo gjë të rëndësishme (aq sa duhen për ta mbuluar të gjithin) dhe një kuiz me shpjegime.")}
  ${!aiOn?`<div class="notice">Krijimi me AI nuk është aktivizuar ende në këtë server. Ndërkohë mund t'i <button class="link-btn" data-go2="manual">shkruani kartat vetë</button>.</div>`:""}
  ${quotaHtml()}
  ${out?`<div class="panel" style="background:var(--sun-soft);border-color:transparent"><h2>Ke përdorur të ${q.limit} setet e këtij muaji</h2><p class="hint">Kufiri rinis më 1 të muajit. Me Premium merr ${LIMITS.premium} sete në muaj.</p><button class="btn btn-fun" data-go2="premium">${I.crownS} Shiko Premium</button></div>`:""}
  <section class="panel"><h2>1. Materiali</h2><p class="hint">Mund të zgjedhësh disa skedarë njëherësh (p.sh. 5 foto të shënimeve) – <b>të gjithë bëhen një set i vetëm</b>. PDF, foto, Word (.docx), PowerPoint (.pptx) ose tekst – deri në ${AI_MAX_MB} MB gjithsej.</p>
    ${dropHtml("adrop",AI_EXT.map(e=>"."+e).join(","),"Prek për të zgjedhur skedarët ose tërhiqi këtu","PDF · JPG/PNG · DOCX · PPTX · TXT")}
    <div class="file-list" id="alist"></div><div class="meta-row" id="atotal" style="margin-top:8px"></div></section>
  <section class="panel"><h2>2. Për kë është?</h2><p class="hint">${g?"Për klasat 1–9 lojërat bëhen më të thjeshta dhe më të gëzuara.":"Për nxënësit e shkollës AI shkruan më thjesht."}</p>
    <div class="fields">
      ${levelFieldsHtml(a,"c",false)}
      <label class="f">Titulli <span class="opt">(opsional – përndryshe e zgjedh AI)</span><input class="t" id="c-title" maxlength="120" placeholder="p.sh. Sistemi kardiovaskular" value="${esc(a.title)}"></label>
      <label class="f">Gjuha e kartave<select class="t" id="c-lang"><option value="sq" ${a.language==="sq"?"selected":""}>Shqip (standarde)</option><option value="doc" ${a.language==="doc"?"selected":""}>Gjuha e dokumentit</option></select></label>
    </div></section>
  <div class="err" id="c-err" role="alert"></div><div class="bar" id="cbar" hidden><i></i></div>
  <div class="save-bar"><button class="btn btn-ghost" data-go2="manual">${I.pen} Shkruaji vetë</button><button class="btn btn-fun btn-lg" id="c-go" ${out||!aiOn?"disabled":""}>${I.spark} ${g?"Krijo lojërat":"Krijo kartat"}</button></div>`;
  const keep=()=>{readLevelFields(a,"c");a.title=$("#c-title").value;a.language=$("#c-lang").value};
  $$("[data-clv]").forEach(b=>b.onclick=()=>{keep();a.level=b.dataset.clv;renderAiCreate()});
  const total=()=>a.files.reduce((x,f)=>x+f.file.size,0);
  const showList=()=>{$("#alist").innerHTML=fileRows(a.files,a.busy,"data-rma");$$("[data-rma]").forEach(b=>b.onclick=()=>{a.files.splice(+b.dataset.rma,1);showList()});
    $("#atotal").textContent=a.files.length?`${plural(a.files.length,"skedar","skedarë")} · ${fmtSize(total())} nga ${AI_MAX_MB} MB · do të bëhen një set`:""};
  showList();
  bindDrop("adrop",fl=>{for(const f of fl){const e=extOf(f.name);
      if(!AI_EXT.includes(e)){toast(`“${f.name}” nuk lexohet nga AI. Përdorni PDF, foto, Word (.docx), PowerPoint (.pptx) ose tekst.`);continue}
      if(total()+f.size>AI_MAX_MB*1048576){toast(`Kufiri është ${AI_MAX_MB} MB gjithsej. Ndajeni materialin në dy sete.`);break}
      if(a.files.length>=20){toast("Deri në 20 skedarë për një set.");break}
      a.files.push({file:f,preview:/^image\//.test(f.type)?URL.createObjectURL(f):""})}
    showList()},()=>a.busy);
  $("#back").onclick=()=>{if(a.busy)return;AC=null;go(g?"games":"sets")};
  bindCommon();
  $("#c-go").onclick=async()=>{
    keep();const err=$("#c-err");err.textContent="";
    if(!a.files.length){err.textContent="Zgjidhni të paktën një skedar.";return}
    const bad=checkLevel(a,false);if(bad){err.textContent=bad;return}
    const btn=$("#c-go"),bar=$("#cbar");a.busy=true;btn.disabled=true;bar.hidden=false;showList();
    try{
      const files=await uploadAll(a.files,p=>{bar.firstElementChild.style.width=(p*100).toFixed(0)+"%";btn.textContent=`Duke ngarkuar ${Math.round(p*100)}%`},showList);
      btn.textContent="Duke nisur AI…";
      const rec=await api("POST","/api/ai/sets",{files,title:a.title.trim(),level:a.level,faculty:a.faculty,grade:a.grade,subject:a.subject,institution:a.institution,purpose:a.purpose,language:a.language});
      upsert(sets,rec);if(me.ai){me.ai.used++;me.ai.left=Math.max(0,me.ai.left-1)}AC=null;go("set",{id:rec.id});
    }catch(e){a.busy=false;btn.disabled=false;btn.innerHTML=`${I.spark} Provo përsëri`;bar.hidden=true;showList();
      err.innerHTML=esc(e.message)+(e.status===402?` <button class="link-btn" data-go2="premium">Shiko Premium</button>`:"");bindCommon()}
  };
}

/* ---------- karta të shkruara vetë ---------- */
let draft=null;
function renderManual(){
  if(!me)return needLogin();
  const edit=view.name==="edit";
  if(!draft||draft._for!==(view.id||"new")){
    if(edit){if(dbState==="loading"){app.innerHTML=loadingBox();return}
      const s=sets.find(x=>x.id===view.id);if(!s)return go("sets");
      if(!canManage(s)){toast("Vetëm krijuesi i setit mund ta ndryshojë.");return go("set",{id:s.id})}
      draft=JSON.parse(JSON.stringify({title:s.title,author:s.author,level:s.level||"uni",faculty:s.faculty||"",grade:s.grade||"",institution:s.institution||"",subject:s.subject||"",description:s.description||"",cards:s.cards||[],files:s.files||[]}));}
    else draft=Object.assign({title:"",author:me.name,description:"",cards:[{term:"",def:""},{term:"",def:""},{term:"",def:""}],files:[]},levelDefaults());
    draft._for=view.id||"new";
  }
  const d=draft;
  app.innerHTML=`<button class="back" id="back">${I.back} Kthehu</button>
  ${pageHead(edit?"Ndrysho setin":"Shkruaj kartat vetë","Para është termi ose pyetja, prapa është përgjigjja. Lojërat krijohen vetë nga kartat.")}
  <section class="panel"><h2>Të dhënat e setit</h2>
    <div class="fields">
      <label class="f full">Titulli<input class="t" id="f-title" maxlength="120" placeholder="p.sh. Nervat kraniale – emrat dhe funksionet" value="${esc(d.title)}"></label>
      ${levelFieldsHtml(d,"f",false)}
      <label class="f">Emri juaj<input class="t" id="f-author" maxlength="60" placeholder="p.sh. Drilon Berisha" value="${esc(d.author)}"></label>
      <label class="f full">Përshkrimi <span class="opt">(opsional)</span><input class="t" id="f-desc" maxlength="500" placeholder="Për cilin provim ose mësim është?" value="${esc(d.description)}"></label>
    </div></section>
  <section class="panel"><h2>Kartat <span class="opt" id="ccount"></span></h2><p class="hint">Mund t'i shtoni një foto çdo karte.</p>
    <div id="cards"></div>
    <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap"><button class="btn btn-ghost" id="add-card">+ Shto kartë</button></div>
    <details class="bulk"><summary>Ngjit shumë karta njëherësh</summary>
      <p class="hint" style="margin-top:8px">Një kartë për rresht, me vizë ndërmjet parës dhe prapës. Shembull:<br><code>Valvula mitrale - Ndërmjet atriumit të majtë dhe ventrikulit të majtë</code></p>
      <textarea class="t" id="bulk" rows="5" placeholder="Para - Prapa"></textarea><button class="btn btn-ghost" id="bulk-add" style="margin-top:10px">Shto këto karta</button></details></section>
  <div id="form-err" class="err" role="alert"></div>
  <div class="save-bar"><button class="btn btn-ghost" id="cancel">Anulo</button><button class="btn btn-primary btn-lg" id="save">${edit?"Ruaj ndryshimet":"Krijo setin"}</button></div>`;
  const keep=()=>{readLevelFields(d,"f");d.title=$("#f-title").value;d.author=$("#f-author").value;d.description=$("#f-desc").value};
  $$("[data-flv]").forEach(b=>b.onclick=()=>{keep();d.level=b.dataset.flv;renderManual()});
  renderCardRows();
  $("#add-card").onclick=()=>{d.cards.push({term:"",def:""});renderCardRows();const ts=$$("[data-term]");ts[ts.length-1].focus()};
  $("#bulk-add").onclick=()=>{const lines=$("#bulk").value.split(/\n/).map(l=>l.trim()).filter(Boolean);let n=0;
    d.cards=d.cards.filter(c=>c.term||c.def||c.img||c._pending);
    for(const l of lines){const m=l.split(/\s+[-–—:]\s+|\t/);if(m.length>=2){d.cards.push({term:m[0].trim(),def:m.slice(1).join(" - ").trim()});n++}}
    if(!d.cards.length)d.cards.push({term:"",def:""});$("#bulk").value="";renderCardRows();
    toast(n?`U shtuan ${plural(n,"kartë","karta")}`:"Nuk u gjet asnjë kartë. Vendosni vizë ndërmjet parës dhe prapës.")};
  $("#back").onclick=$("#cancel").onclick=()=>{const id=view.id;draft=null;id?go("set",{id}):go("sets")};
  $("#save").onclick=async()=>{
    keep();const err=$("#form-err");err.textContent="";
    const cards=d.cards.filter(c=>(c.term||"").trim()||(c.def||"").trim()||c.img||c._pending);
    if(!d.title.trim()){err.textContent="Jepini setit një titull.";$("#f-title").focus();return}
    const bad=checkLevel(d,false);if(bad){err.textContent=bad;return}
    if(!cards.length){err.textContent="Shtoni të paktën një kartë.";return}
    const btn=$("#save");btn.disabled=true;btn.textContent="Duke ruajtur…";
    try{
      const outCards=[];
      for(const c of cards){const o={term:(c.term||"").trim(),def:(c.def||"").trim()};
        if(c._pending){btn.textContent="Duke ngarkuar fotot…";const r=await uploadFile(c._pending);o.img={asset:r.id,name:c._pending.name,type:c._pending.type}}else if(c.img)o.img=c.img;outCards.push(o)}
      const body={title:d.title.trim(),author:d.author.trim(),level:d.level,faculty:d.faculty,grade:d.grade,institution:d.institution,subject:d.subject,description:d.description.trim(),cards:outCards,files:d.files};
      const rec=edit?await api("PUT","/api/sets/"+encodeURIComponent(view.id),body,ownerHeader(view.id)):await api("POST","/api/sets",body);
      upsert(sets,rec);draft=null;toast(edit?"Ndryshimet u ruajtën":"Seti u krijua");go("set",{id:rec.id});
    }catch(e){btn.disabled=false;btn.textContent=edit?"Ruaj ndryshimet":"Krijo setin";err.textContent=e.message}
  };
}
function renderCardRows(){
  const d=draft,box=$("#cards");if(!box)return;
  $("#ccount").textContent=`(${d.cards.length})`;
  box.innerHTML=d.cards.map((c,i)=>`<div class="card-row"><div class="card-num">${i+1}</div>
    <label class="card-side">Para<textarea class="t" rows="2" data-term="${i}" placeholder="p.sh. Nervi trigeminal">${esc(c.term)}</textarea></label>
    <label class="card-side">Prapa<textarea class="t" rows="2" data-def="${i}" placeholder="p.sh. N. V – ndjeshmëria e fytyrës, muskujt e përtypjes">${esc(c.def)}</textarea>
      ${c.img||c._pending?`<span class="card-img"><img src="${esc(c._preview||fileUrl(c.img))}" alt="">Foto e shtuar <button class="btn btn-ghost btn-sm" data-rmimg="${i}">Hiqe</button></span>`:""}</label>
    <div class="card-tools"><button class="icon-btn" data-addimg="${i}" aria-label="Shto foto te karta ${i+1}" title="Shto foto">${I.img}</button><button class="icon-btn del" data-del="${i}" aria-label="Fshi kartën ${i+1}" title="Fshi kartën">${I.trash}</button></div></div>`).join("");
  $$("[data-term]",box).forEach(t=>t.oninput=()=>d.cards[t.dataset.term].term=t.value);
  $$("[data-def]",box).forEach(t=>t.oninput=()=>d.cards[t.dataset.def].def=t.value);
  $$("[data-del]",box).forEach(b=>b.onclick=()=>{d.cards.splice(+b.dataset.del,1);if(!d.cards.length)d.cards.push({term:"",def:""});renderCardRows()});
  $$("[data-rmimg]",box).forEach(b=>b.onclick=e=>{e.preventDefault();const c=d.cards[+b.dataset.rmimg];delete c.img;delete c._pending;delete c._preview;renderCardRows()});
  $$("[data-addimg]",box).forEach(b=>b.onclick=()=>{const inp=document.createElement("input");inp.type="file";inp.accept="image/png,image/jpeg,image/gif,image/webp";
    inp.onchange=()=>{const f=inp.files[0];if(!f)return;if(!/^image\//.test(f.type)){toast("Zgjidhni një foto.");return}
      const c=d.cards[+b.dataset.addimg];c._pending=f;c._preview=URL.createObjectURL(f);delete c.img;renderCardRows()};inp.click()});
}

/* ---------- faqja e setit ---------- */
let MAR=null;
const MAR_ORDER=["kuiz","vg","ploteso","perputh","memory","balona","sprint"];
const isKid=s=>s&&s.level==="school"&&+s.grade<=9;
let pollT=null;
function renderSet(){
  if(!me)return needLogin("Hyni ose regjistrohuni falas për të luajtur.");
  clearTimeout(pollT);
  const s=sets.find(x=>x.id===view.id);
  if(!s){app.innerHTML=dbState==="loading"?loadingBox():emptyBox("Ky set është fshirë ose nuk ekziston","",`<button class="btn btn-primary" data-go2="sets">Te kartat</button>`);bindCommon();return}
  const ready=s.status==="ready",cards=s.cards||[],files=s.files||[];
  if(ready&&!view.mode)view.mode=s.purpose==="games"?"kuiz":"karta";
  const mode=view.mode;
  app.innerHTML=`<button class="back" id="back">${I.back} ${s.purpose==="games"?"Lojërat":"Kartat & Kuizet"}</button>
  <div class="page-head" style="align-items:flex-start;margin-bottom:0">
    <div style="min-width:0;flex:1">
      <div class="meta-row" style="margin-bottom:10px">${levelPill(s)}${s.subject?`<span class="pill">${esc(s.subject)}</span>`:""}${s.institution?`<span class="pill uni">${esc(s.institution)}</span>`:""}${ready?`<span class="pill">${I.cardsS} ${plural(cards.length,"kartë","karta")}</span>${(s.quiz||[]).length?`<span class="pill">${s.quiz.length} pyetje</span>`:""}`:""}${s.ai?`<span class="pill ai">${I.sparkS.replace(/16/g,"12")} Krijuar me AI</span>`:""}</div>
      <h1 class="set-title">${esc(s.title)}</h1>${s.description?`<p class="set-desc">${esc(s.description)}</p>`:""}
      <div class="set-meta"><div class="author" style="border:0;padding:0;margin:0">${avHtml({name:s.author,avatar:s.authorAvatar},40)}<div><div class="by">Krijuar nga · ${esc(ago(s.createdAt))}</div><div class="nm">${esc(s.author)}</div></div></div></div>
    </div>
    <div class="detail-actions">${canManage(s)?`${ready?`<button class="btn btn-ghost" id="edit">${I.pen} Ndrysho</button>`:""}<button class="btn btn-danger" id="del">${I.trash} Fshi</button>`:`<button class="btn btn-ghost" id="report">Raporto</button>`}</div>
  </div>
  <div id="confirm-slot"></div>
  ${ready?`<div id="player">${playerStrip()}</div>
    <div class="marathon"><span>${I.trophyS} <b>Maratona:</b> luaj të gjitha lojërat një nga një dhe fito +50 XP shtesë.</span>${MAR&&MAR.id===s.id?`<span class="pill">Loja ${MAR.i+1} nga ${MAR.list.length}</span><button class="btn btn-ghost btn-sm" id="mar-stop">Ndalo</button>`:`<button class="btn btn-fun btn-sm" id="mar-go">Luaj të gjitha</button>`}</div>
    <div class="hub" role="tablist" aria-label="Zgjidh lojën">${MODES.map(md=>`<button role="tab" class="mode m-${md.id}" data-mode="${md.id}" aria-selected="${mode===md.id}"><span class="blob">${md.icon}</span><b>${md.name}</b><small>${md.desc}</small><span class="best">${esc(bestLabel(md.id,s))}</span></button>`).join("")}</div>
    <section class="stage m-${mode}${isKid(s)?" kid":""}" id="study" aria-live="polite"></section>
    <section class="section" style="margin-top:34px"><details class="all-cards"><summary><h2 style="display:inline">Të gjitha kartat (${cards.length})</h2></summary><div class="terms" style="margin-top:12px">${cards.map(c=>`<div class="term"><b>${esc(c.term)}</b><div><p>${esc(c.def)}</p>${c.img?`<img src="${esc(fileUrl(c.img))}" alt="" data-zoom="${esc(fileUrl(c.img))}" style="cursor:zoom-in">`:""}</div></div>`).join("")}</div></details></section>`
  :s.status==="pending"?genHtml(s)
  :`<div class="panel" style="margin-top:22px;background:var(--danger-soft);border-color:transparent"><h2>Seti nuk u krijua</h2><p class="hint">${esc(s.error||"AI nuk arriti ta lexojë materialin.")} Ky set nuk llogaritet në kufirin tuaj mujor.</p>
      ${canManage(s)?`<div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn btn-primary" id="retry">Provo përsëri</button><button class="btn btn-ghost" data-create="${s.purpose==="games"?"games":"cards"}">Ngarko material tjetër</button></div>`:""}</div>`}
  ${files.length?`<section class="section"><div class="section-head"><h2>Materiali burimor</h2></div><div class="file-list">${files.map(f=>`<a class="file-item" href="${esc(kindOf(f.name)[0]==="pdf"||kindOf(f.name)[0]==="foto"?fileUrl(f):dlUrl(f.asset,f.name))}" target="_blank" rel="noopener">${typeBox(f.name,f.asset)}<div class="file-meta"><b>${esc(f.name)}</b><small>${esc(kindOf(f.name)[1])} · ${esc(fmtSize(f.size))}</small></div></a>`).join("")}</div></section>`:""}`;
  $("#back").onclick=()=>{MAR=null;go(s.purpose==="games"?"games":"sets")};
  const ed=$("#edit");if(ed)ed.onclick=()=>{draft=null;go("edit",{id:s.id})};
  const dl=$("#del");if(dl)dl.onclick=()=>confirmDelete(s.title,async()=>{await api("DELETE","/api/sets/"+encodeURIComponent(s.id),null,ownerHeader(s.id));sets=sets.filter(x=>x.id!==s.id);MAR=null;toast("Seti u fshi");go(s.purpose==="games"?"games":"sets")});
  const rp=$("#report");if(rp)rp.onclick=()=>reportBox("set",s.id);
  const rt=$("#retry");if(rt)rt.onclick=async()=>{rt.disabled=true;try{const r=await api("POST","/api/sets/"+encodeURIComponent(s.id)+"/retry",null,ownerHeader(s.id));upsert(sets,r);renderSet()}catch(e){rt.disabled=false;toast(e.message)}};
  $$("[data-zoom]",app).forEach(el=>el.onclick=()=>lightbox(el.dataset.zoom));
  bindCommon();
  if(!ready){if(s.status==="pending")renderSetPoll();return}
  $$("[data-mode]").forEach(b=>b.onclick=()=>{const m=b.dataset.mode;if(MAR&&MAR.id===s.id&&m!==MAR.list[MAR.i]){MAR=null;setMode(m);return renderSet()}switchMode(s,m)});
  const pl=$("#player");if(pl)pl.onclick=e=>{if(e.target.closest("[data-ach]"))go("achievements")};
  const mg=$("#mar-go");if(mg)mg.onclick=()=>marStart(s);
  const ms=$("#mar-stop");if(ms)ms.onclick=()=>{MAR=null;renderSet()};
  renderMode(s);
}
function renderSetPoll(){const s=sets.find(x=>x.id===view.id);if(!s||s.status!=="pending")return;clearTimeout(pollT);
  pollT=setTimeout(async()=>{if(view.name!=="set"||view.id!==s.id)return;await refresh();const n=sets.find(x=>x.id===s.id);if(view.name!=="set"||view.id!==s.id)return;
    if(n&&n.status!=="pending"){if(n.status==="ready")celebrateReady(n);renderSet()}else{updateGen(n||s);renderSetPoll()}},4000)}
function celebrateReady(s){beep(true,true);confetti();toast(`Gati! ${plural((s.cards||[]).length,"kartë","karta")}${(s.quiz||[]).length?` dhe ${s.quiz.length} pyetje`:""}.`)}
const GEN_STEPS=[[0,"Po lexojmë skedarët"],[10,"Po gjejmë gjërat më të rëndësishme"],[25,"Po krijojmë kartat"],[60,"Po krijojmë kuizin dhe lojërat"],[110,"Kontrolli i fundit"]];
function genHtml(s){
  return `<div class="gen" id="gen">${sm()}<h2>Sinapsa po krijon ${s.purpose==="games"?"lojërat":"kartat"}…</h2><p>Zakonisht zgjat 1–3 minuta për materiale të gjata. Mund të shfletosh faqe të tjera – do të jetë këtu kur të mbarojë.</p>
    <ul class="gen-steps" id="gen-steps">${genSteps(s)}</ul></div>`;
}
function genSteps(s){const el=(Date.now()-(s.createdAt||Date.now()))/1000;let cur=0;GEN_STEPS.forEach(([t],i)=>{if(el>=t)cur=i});
  return GEN_STEPS.map(([,l],i)=>`<li class="${i<cur?"done":i===cur?"on":""}"><span class="dot">${i<cur?"✓":""}</span>${l}</li>`).join("")}
function updateGen(s){const g=$("#gen-steps");if(g)g.innerHTML=genSteps(s)}
function switchMode(s,m){stopTimers();setMode(m);$$("[data-mode]").forEach(x=>x.setAttribute("aria-selected",String(x.dataset.mode===m)));renderMode(s);
  const st=$("#study");if(st&&st.getBoundingClientRect().top<0)st.scrollIntoView({behavior:reduceMotion()?"auto":"smooth",block:"start"})}
function renderMode(s){
  stopTimers();
  const m=view.mode||"karta",box=$("#study");if(!box)return;box.className=`stage m-${m}${isKid(s)?" kid":""}`;
  ({karta:renderStudy,kuiz:renderQuiz,sprint:renderSprint,vg:renderTF,perputh:renderMatch,ploteso:renderFill,memory:renderMemory,balona:renderBalloons}[m]||renderStudy)(s);
}
function refreshHub(s){const pl=$("#player");if(pl)pl.innerHTML=playerStrip();$$(".mode").forEach(b=>{const el=$(".best",b);if(el)el.textContent=bestLabel(b.dataset.mode,s)})}
/* Maratona: të gjitha lojërat një nga një */
function marStart(s){MAR={id:s.id,i:0,list:MAR_ORDER.filter(m=>modeOk(m,s))};if(!MAR.list.length){MAR=null;return toast("Ky set ka shumë pak karta për lojërat.")}resetGame(MAR.list[0]);renderSet();switchMode(s,MAR.list[0]);autoStart()}
function autoStart(){setTimeout(()=>{const b=$("#g-start");if(b)b.click()},30)}
function marBtn(s){if(!MAR||MAR.id!==s.id)return"";const last=MAR.i>=MAR.list.length-1;
  return `<button class="btn-play" id="mar-next">${last?`${I.trophyS} Përfundo maratonën`:`Loja tjetër: ${esc(modeName(MAR.list[MAR.i+1]))} (${MAR.i+2}/${MAR.list.length}) ${I.arrow}`}</button>`}
function bindMar(s){const b=$("#mar-next");if(!b)return;b.focus({preventScroll:true});b.onclick=()=>{
  if(MAR.i>=MAR.list.length-1){MAR=null;const r=finishGame({mode:"maraton",setId:s.id,xp:50,marathon:true});renderSet();
    const box=$("#study");if(box)box.innerHTML=`<div class="result"><h2>Maratona përfundoi! 🏆</h2><p style="color:var(--muted)">I luajte të gjitha lojërat me këtë set. +50 XP shtesë.</p>${newAchHtml(r.fresh)}<div class="res-acts" style="margin-top:16px"><button class="btn-play" id="mar-again">Edhe një maratonë</button></div></div>`;
    const a=$("#mar-again");if(a)a.onclick=()=>marStart(s);return}
  MAR.i++;resetGame(MAR.list[MAR.i]);renderSet();switchMode(s,MAR.list[MAR.i]);autoStart()}}
function resActs(s,html){return `<div class="res-acts">${marBtn(s)}${MAR&&MAR.id===s.id?html.replace(/btn-play/g,"btn btn-ghost"):html}</div>`}

/* ===== KARTAT ===== */
let study=null;
function startStudy(s,shuf){const order=s.cards.map((_,i)=>i);study={id:s.id,order:shuf?shuffle(order):order,pos:0,flipped:false,know:0,learn:0,learnIdx:[],done:false}}
function renderStudy(s){
  const box=$("#study");if(!box)return;const cards=s.cards||[];
  if(!cards.length){box.innerHTML=emptyBox("Ky set nuk ka ende karta");return}
  if(!study||study.id!==s.id||study.order.some(i=>i>=cards.length))startStudy(s,false);
  const st=study;
  if(st.done){
    box.innerHTML=`<div class="result"><h2>Raundi përfundoi!</h2><p style="color:var(--muted)">Ja si shkove.</p>
      <div class="rstats"><div><b style="color:var(--mint-ink)">${st.know}</b><small>I di</small></div><div><b style="color:var(--orange-ink)">${st.learn}</b><small>Po i mësoj ende</small></div></div>${newAchHtml(st.fresh)}
      ${resActs(s,`${st.learnIdx.length?`<button class="btn-play" id="again-learn">Praktiko ${plural(st.learnIdx.length,"kartën","kartat")} që po mëson</button>`:""}<button class="btn btn-ghost" id="again">Fillo nga e para</button><button class="btn btn-ghost" id="to-quiz">Provo Kuizin</button>`)}</div>`;
    $("#again").onclick=()=>{startStudy(s,false);renderStudy(s)};$("#to-quiz").onclick=()=>switchMode(s,"kuiz");
    const al=$("#again-learn");if(al)al.onclick=()=>{study={id:s.id,order:st.learnIdx.slice(),pos:0,flipped:false,know:0,learn:0,learnIdx:[],done:false};renderStudy(s)};
    bindMar(s);return;
  }
  const c=cards[st.order[st.pos]]||{},imgSrc=c.img?fileUrl(c.img):"";
  box.innerHTML=`<div class="flip ${st.flipped?"flipped":""}" id="flip" role="button" tabindex="0" aria-label="Kartë. ${st.flipped?"Po shfaqet ana e prapme":"Po shfaqet ana e parme"}. Shtyp për ta kthyer.">
      <div class="flip-in"><div class="face"><span class="lbl">Para</span><div class="txt">${esc(c.term||"—")}</div><span class="tap">Prek kartën për të parë përgjigjen</span></div>
        <div class="face back-f"><span class="lbl">Prapa</span>${imgSrc?`<img src="${esc(imgSrc)}" alt="">`:""}<div class="txt">${esc(c.def||"—")}</div></div></div></div>
    <div class="progress" aria-hidden="true"><i style="width:${(st.pos/st.order.length*100).toFixed(1)}%"></i></div>
    <div class="controls"><button class="btn btn-ghost" id="shuf">${I.shuffle} Përziej</button>
      <div class="nav-arrows"><button class="round" id="prev" aria-label="Karta e mëparshme" ${st.pos===0?"disabled":""}>${I.prev}</button><span class="counter" aria-live="polite">${st.pos+1} / ${st.order.length}</span><button class="round" id="nxt" aria-label="Karta tjetër">${I.next}</button></div>
      <span style="width:110px" aria-hidden="true"></span></div>
    <div class="judge"><button class="btn btn-learn" id="learn">Po e mësoj ende</button><button class="btn btn-know" id="know">E di ✓</button></div>
    <div class="kbd">Tastiera: Hapësira për ta kthyer · ← → për të lëvizur</div>`;
  const flip=()=>{st.flipped=!st.flipped;$("#flip").classList.toggle("flipped",st.flipped)};
  $("#flip").onclick=flip;$("#flip").onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();flip()}};
  const advance=()=>{st.flipped=false;if(st.pos<st.order.length-1)st.pos++;else{st.done=true;st.fresh=finishGame({mode:"karta",setId:s.id,xp:st.know*3+st.learn,right:st.know}).fresh;refreshHub(s)}renderStudy(s)};
  $("#nxt").onclick=advance;$("#prev").onclick=()=>{if(st.pos>0){st.pos--;st.flipped=false;renderStudy(s)}};
  $("#know").onclick=()=>{st.know++;advance()};$("#learn").onclick=()=>{st.learn++;st.learnIdx.push(st.order[st.pos]);advance()};
  $("#shuf").onclick=()=>{startStudy(s,true);renderStudy(s);toast("Kartat u përzien")};
}
document.addEventListener("keydown",e=>{
  if(view.name!=="set")return;if(/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))return;
  const m=view.mode;
  if(m==="kuiz"||m==="sprint"){if(/^[1-4]$/.test(e.key)){const b=$(`[data-opt="${+e.key-1}"]`);if(b&&!b.disabled)b.click()}else if(e.key==="Enter"){const b=$("#qnext")||$("#g-start");if(b){e.preventDefault();b.click()}}return}
  if(m==="vg"){if(e.key==="ArrowLeft"||e.key.toLowerCase()==="v"){const b=$("#tf-yes");if(b&&!b.disabled)b.click()}else if(e.key==="ArrowRight"||e.key.toLowerCase()==="g"){const b=$("#tf-no");if(b&&!b.disabled)b.click()}else if(e.key==="Enter"){const b=$("#g-start");if(b){e.preventDefault();b.click()}}return}
  if(m==="ploteso"){if(/^[1-4]$/.test(e.key)){const b=$(`[data-chip="${+e.key-1}"]`);if(b&&!b.disabled)b.click()}else if(e.key==="Enter"){const b=$("#qnext")||$("#g-start");if(b){e.preventDefault();b.click()}}return}
  if(m!=="karta"||!study||study.done)return;
  if(e.key===" "){e.preventDefault();const f=$("#flip");if(f)f.click()}
  else if(e.key==="ArrowRight"){const b=$("#nxt");if(b)b.click()}
  else if(e.key==="ArrowLeft"){const b=$("#prev");if(b&&!b.disabled)b.click()}
});

/* ---------- LOJËRAT: motori i përparimit ---------- */
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const dk=d=>{d=d||new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")};
const daysBetween=(a,b)=>Math.round((new Date(b+"T12:00:00")-new Date(a+"T12:00:00"))/86400000);
let actx=null;
function beep(ok,big){if(lsGet("sin_mute",false))return;try{actx=actx||new (window.AudioContext||window.webkitAudioContext)();
  const notes=big?[523,659,784,1047]:ok?[660,880]:[220,165];notes.forEach((f,i)=>{const o=actx.createOscillator(),g=actx.createGain();o.type=ok||big?"triangle":"sawtooth";o.frequency.value=f;
    const t=actx.currentTime+i*(big?.11:.09);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(ok||big?.18:.07,t+.02);g.gain.exponentialRampToValueAtTime(.0001,t+.18);o.connect(g).connect(actx.destination);o.start(t);o.stop(t+.2)})}catch(e){}}
function popXp(el,txt){try{if(!el)return;const r=el.getBoundingClientRect();const p=document.createElement("div");p.className="pop";p.textContent=txt;p.style.left=r.left+"px";p.style.top=(r.top-6)+"px";document.body.appendChild(p);setTimeout(()=>p.remove(),950)}catch(e){}}
const muteBtn=()=>`<button class="mute" id="mute" aria-label="${lsGet("sin_mute",false)?"Ndize zërin":"Fike zërin"}">${lsGet("sin_mute",false)?I.mute:I.sound}</button>`;
function bindMute(rerender){const b=$("#mute");if(b)b.onclick=()=>{lsSet("sin_mute",!lsGet("sin_mute",false));rerender()}}
function confetti(){
  if(reduceMotion())return;const c=document.createElement("canvas");c.id="confetti";c.width=innerWidth;c.height=innerHeight;document.body.appendChild(c);
  const ctx=c.getContext("2d"),cols=["#1800AD","#7A5CFF","#FF4FA0","#FFC93C","#16C79A","#2FA8FF","#FF8A3D"];
  const ps=Array.from({length:160},()=>({x:innerWidth/2+(Math.random()-.5)*240,y:innerHeight*.35,vx:(Math.random()-.5)*15,vy:-Math.random()*13-4,r:Math.random()*6+4,c:cols[Math.floor(Math.random()*cols.length)],a:Math.random()*6,s:Math.random()*.3-.15}));
  let t=0;(function f(){t++;ctx.clearRect(0,0,c.width,c.height);ps.forEach(q=>{q.vy+=.35;q.x+=q.vx;q.y+=q.vy;q.vx*=.99;q.a+=q.s;ctx.save();ctx.translate(q.x,q.y);ctx.rotate(q.a);ctx.fillStyle=q.c;ctx.fillRect(-q.r/2,-q.r/4,q.r,q.r/2);ctx.restore()});if(t<120)requestAnimationFrame(f);else c.remove()})();
}

const MODES=[
  {id:"karta",name:"Karta",desc:"Kthe kartat dhe mëso me ritmin tënd",icon:I.cards},
  {id:"kuiz",name:"Kuiz",desc:"4 përgjigje, jetë, pikë dhe seri",icon:I.game},
  {id:"sprint",name:"Sprint 60s",desc:"Sa më shumë të sakta në një minutë",icon:I.timer},
  {id:"vg",name:"E vërtetë apo e gabuar",desc:"Vendos shpejt: a përputhen?",icon:I.check},
  {id:"perputh",name:"Përputh",desc:"Bashko çiftet kundër kohës",icon:I.bolt},
  {id:"ploteso",name:"Plotëso",desc:"Gjej fjalën që mungon në fjali",icon:I.fill},
  {id:"memory",name:"Memory",desc:"Gjej çiftet nën kartat e kthyera",icon:I.brain},
  {id:"balona",name:"Balona",desc:"Plas balonën me përgjigjen e saktë",icon:I.balloon},
];
const modeName=id=>(MODES.find(m=>m.id===id)||{}).name||id;
function modeOk(m,s){const c=(s.cards||[]).filter(x=>x.term&&x.def).length;
  if(m==="karta")return (s.cards||[]).length>0;if(m==="kuiz"||m==="sprint")return buildQuestions(s).length>0;if(m==="vg")return c>=3;
  if(m==="perputh")return c>=2;if(m==="memory")return c>=3;if(m==="balona")return balloonQs(s).length>0;if(m==="ploteso")return buildFills(s).length>=3;return false}

/* Profili i lojtarit: ruhet në llogari (dhe një kopje në pajisje) */
const PROF0=()=>({xp:0,games:0,sets:{},modes:{},bestCombo:0,perfect:0,sprintBest:0,tfBest:0,matchBest:null,memBest:null,night:0,early:0,right:0,popped:0,fillsRight:0,marathons:0,uploads:0,bestStreak:0,
  streak:{last:"",n:0,shields:0},unlocked:{},today:{key:"",games:0,xp:0,right:0,modes:{},claimed:{}},best:{}});
let P=null,profT=null;
const profKey=()=>"sin_prof_"+(me?me.id:"anon");
function loadProf(){
  const local=lsGet(profKey(),null),server=me&&me.game;let base=(server&&(!local||(server.xp||0)>=(local.xp||0)))?server:local;
  if(!base){const old=lsGet("sin_prof",null);if(old){base=old;try{localStorage.removeItem("sin_prof")}catch(e){}}}
  const p=Object.assign(PROF0(),base||{});
  ["sets","modes","unlocked","best"].forEach(k=>{if(!p[k]||typeof p[k]!=="object")p[k]={}});
  p.streak=Object.assign({last:"",n:0,shields:0},p.streak||{});p.today=Object.assign({key:"",games:0,xp:0,right:0,modes:{},claimed:{}},p.today||{});
  if(typeof p.unlocked[Object.keys(p.unlocked)[0]]==="number"&&p.unlocked[Object.keys(p.unlocked)[0]]>1e9)p.unlocked={}; // arritjet e vjetra
  P=p;return p;
}
function prof(){return P||loadProf()}
function saveProf(){
  const p=prof();
  for(const k of Object.keys(p.best)){const e=Object.entries(p.best[k]);if(e.length>200)p.best[k]=Object.fromEntries(e.slice(-200))}
  if(Object.keys(p.sets).length>1500)p.sets=Object.fromEntries(Object.entries(p.sets).slice(-1500));
  lsSet(profKey(),p);
  if(me){clearTimeout(profT);profT=setTimeout(()=>api("PUT","/api/me/game",{game:p}).then(()=>{LB=null}).catch(()=>{}),700)}
}
function bump(k){const p=prof();p[k]=(p[k]||0)+1;const fresh=checkAch(p);saveProf();fresh.forEach((f,i)=>setTimeout(()=>achToast(f),400+i*2600))}
function getBest(mode,id){return (prof().best[mode]||{})[id]}
function setBest(mode,id,v,lower){const p=prof();p.best[mode]=p.best[mode]||{};const old=p.best[mode][id];const rec=old==null||(lower?v<old:v>old);if(rec)p.best[mode][id]=v;return{rec,old}}
function dayStreak(){const s=prof().streak;if(!s.last)return 0;const d=daysBetween(s.last,dk());if(d<=1)return s.n;if(d===2&&s.shields>0)return s.n;return 0}
function markPlayed(p){const s=p.streak,t=dk();if(s.last===t)return false;const d=s.last?daysBetween(s.last,t):99;let used=false;
  if(d===1)s.n++;else if(d===2&&s.shields>0){s.shields--;s.n++;used=true}else s.n=1;
  s.last=t;if(s.n%7===0)s.shields=Math.min(2,s.shields+1);p.bestStreak=Math.max(p.bestStreak||0,s.n);return used}
const need=n=>50*n*(n-1);
function levelInfo(xp){let n=1;while(xp>=need(n+1))n++;const a=need(n),b=need(n+1);
  const title=n>=20?"Legjendë":n>=15?"Mjeshtër":n>=10?"Ekspert":n>=6?"Njohës":n>=3?"Studiues":"Fillestar";return{n,title,pct:Math.round((xp-a)/(b-a)*100),toNext:b-xp}}

/* Arritjet me nivele: bronz → argjend → ar → diamant */
const TIERS=[["Bronz","#E7A86B"],["Argjend","#C9D1DE"],["Ar","#FFC93C"],["Diamant","#8FE3FF"]];
const ACH=[
  {id:"games",name:"Lojtar",d:n=>`Luaj ${n} lojëra`,color:"var(--violet)",icon:I.game,v:p=>p.games,t:[1,10,50,200]},
  {id:"xp",name:"Mbledhës XP",d:n=>`Mblidh ${n} XP`,color:"var(--brand)",icon:I.starL,v:p=>p.xp,t:[500,2000,10000,40000]},
  {id:"right",name:"Truri",d:n=>`${n} përgjigje të sakta`,color:"var(--mint)",icon:I.brain,v:p=>p.right,t:[50,250,1000,5000]},
  {id:"combo",name:"Në zjarr",d:n=>`${n} të sakta rresht`,color:"var(--coral)",icon:I.flameL,v:p=>p.bestCombo,t:[5,10,20,40]},
  {id:"streak",name:"Këmbëngulës",d:n=>`Mëso ${n} ditë rresht`,color:"var(--orange)",icon:I.flameL,v:p=>p.bestStreak||0,t:[3,7,30,100]},
  {id:"perfect",name:"Pa asnjë gabim",d:n=>n===1?"Një kuiz me 100%":`${n} kuize me 100%`,color:"var(--mint)",icon:I.check,v:p=>p.perfect,t:[1,5,20,50]},
  {id:"sprint",name:"Sprinter",d:n=>`${n} të sakta në Sprint 60s`,color:"var(--orange)",icon:I.timer,v:p=>p.sprintBest,t:[8,15,25,35]},
  {id:"match",name:"Rrufe",d:n=>`Përputh nën ${n} sekonda`,color:"var(--sky)",icon:I.bolt,low:true,v:p=>p.matchBest==null?null:p.matchBest/1000,t:[40,25,18,12]},
  {id:"memory",name:"Kujtesë e fortë",d:n=>`Memory me ${n} lëvizje ose më pak`,color:"#F2A900",icon:I.brain,low:true,v:p=>p.memBest,t:[20,15,12,9]},
  {id:"balona",name:"Gjuajtës balonash",d:n=>`Plas ${n} balona të sakta`,color:"var(--pink)",icon:I.balloon,v:p=>p.popped,t:[10,50,200,1000]},
  {id:"fill",name:"Fjalëmjeshtër",d:n=>`Plotëso saktë ${n} fjali`,color:"var(--coral)",icon:I.fill,v:p=>p.fillsRight,t:[10,50,200,1000]},
  {id:"sets",name:"Eksplorues",d:n=>`Luaj me ${n} sete të ndryshme`,color:"var(--sky)",icon:I.compass,v:p=>Object.keys(p.sets).length,t:[3,10,30,100]},
  {id:"modes",name:"I gjithanshëm",d:n=>`Provo ${n} lojëra të ndryshme`,color:"var(--violet)",icon:I.target,v:p=>Object.keys(p.modes).filter(m=>m!=="maraton").length,t:[3,5,8]},
  {id:"marathon",name:"Maratonist",d:n=>`Përfundo ${n===1?"një maratonë":n+" maratona"}`,color:"var(--pink)",icon:I.trophy,v:p=>p.marathons,t:[1,5,20,50]},
  {id:"helper",name:"Ndihmës",d:n=>`Ngarko ${n===1?"një material":n+" materiale"}`,color:"var(--sky)",icon:I.folder,v:p=>p.uploads,t:[1,5,20,50]},
  {id:"night",name:"Bufi i natës",d:n=>n===1?"Mëso pas orës 22:00":`${n} herë pas orës 22:00`,color:"var(--brand)",icon:I.moon,v:p=>p.night,t:[1,10,50]},
  {id:"early",name:"Zogu i mëngjesit",d:n=>n===1?"Mëso para orës 8:00":`${n} herë para orës 8:00`,color:"var(--sun)",icon:I.sun,v:p=>p.early,t:[1,10,50]},
];
function achTier(a,p){const v=a.v(p);if(v==null)return 0;let n=0;a.t.forEach(x=>{if(a.low?v<=x:v>=x)n++});return n}
function achCount(){const p=prof();return{got:ACH.reduce((s,a)=>s+achTier(a,p),0),all:ACH.reduce((s,a)=>s+a.t.length,0)}}
function medal(a,tier,small){const t=tier?TIERS[Math.min(tier,TIERS.length)-1]:null;
  return `<span class="medal${small?" sm":""}" style="background:${a.color};--tier:${t?t[1]:"#E2DDF7"}" title="${esc(a.name)}${t?" · "+t[0]:""}">${a.icon}${t&&!small?`<span class="tier">${tier}</span>`:""}</span>`}
function checkAch(p){const fresh=[];for(const a of ACH){const t=achTier(a,p),was=p.unlocked[a.id]||0;if(t>was){p.unlocked[a.id]=t;fresh.push({a,tier:t})}}return fresh}
function achToast(f){const t=document.createElement("div");t.className="ach-toast";t.setAttribute("role","status");
  t.innerHTML=`${medal(f.a,f.tier)}<div><small>Medalje e re · ${TIERS[f.tier-1][0]}</small><b>${esc(f.a.name)}</b></div>`;document.body.appendChild(t);beep(true,true);setTimeout(()=>t.remove(),2500)}
const newAchHtml=fresh=>(fresh||[]).length?`<div class="new-ach">${fresh.map(f=>`<span>${medal(f.a,f.tier,true)} ${esc(f.a.name)} · ${TIERS[f.tier-1][0]}</span>`).join("")}</div>`:"";

/* Detyrat e ditës */
const QUEST_XP=25;
const QUESTS={
  g2:{t:"Luaj 2 lojëra",n:2,v:d=>d.games,c:"var(--violet)",icon:I.game},g4:{t:"Luaj 4 lojëra",n:4,v:d=>d.games,c:"var(--violet)",icon:I.game},
  x100:{t:"Fito 100 XP",n:100,v:d=>d.xp,c:"#F2A900",icon:I.starL},x200:{t:"Fito 200 XP",n:200,v:d=>d.xp,c:"#F2A900",icon:I.starL},
  r15:{t:"15 përgjigje të sakta",n:15,v:d=>d.right,c:"var(--mint)",icon:I.check},r30:{t:"30 përgjigje të sakta",n:30,v:d=>d.right,c:"var(--mint)",icon:I.check},
  m3:{t:"Provo 3 lojëra të ndryshme",n:3,v:d=>Object.keys(d.modes).length,c:"var(--sky)",icon:I.target},
  mb:{t:"Luaj Memory ose Balona",n:1,v:d=>(d.modes.memory?1:0)+(d.modes.balona?1:0),c:"var(--pink)",icon:I.balloon},
};
function todayQuests(){const key=dk(),h=s=>{let x=7;for(const c of s)x=(x*31+c.charCodeAt(0))%9973;return x};
  return [["g2","g4"],["x100","x200"],["r15","r30","m3","mb"]].map((g,i)=>g[h(key+i)%g.length])}
function todayData(p){if(p.today.key!==dk())p.today={key:dk(),games:0,xp:0,right:0,modes:{},claimed:{}};return p.today}
function questsHtml(){const p=prof(),d=todayData(p);
  return `<div class="quests">${todayQuests().map(id=>{const q=QUESTS[id],v=Math.min(q.n,q.v(d)),done=!!d.claimed[id];
    return `<div class="quest${done?" done":""}"><span class="qi" style="background:${done?"var(--mint)":q.c}">${done?I.check:q.icon}</span><div style="flex:1;min-width:0"><b>${q.t}</b><small>${done?`Kryer · +${QUEST_XP} XP`:`${v} / ${q.n}`}</small><div class="qbar"><i style="width:${(v/q.n*100).toFixed(0)}%;background:${done?"var(--mint)":q.c}"></i></div></div></div>`}).join("")}</div>`}
function bindQuests(){}

/* Thirret në fund të çdo loje: XP, rekorde, detyra, medalje, nivel */
function finishGame(r){
  const p=prof(),before=levelInfo(p.xp).n,d=todayData(p);
  const xp=Math.max(0,Math.round(r.xp||0));p.xp+=xp;
  if(r.marathon)p.marathons=(p.marathons||0)+1;else{p.games++;p.modes[r.mode]=1;d.modes[r.mode]=1;d.games++}
  if(r.setId)p.sets[r.setId]=1;
  p.right+=r.right||0;d.right+=r.right||0;d.xp+=xp;
  if(r.combo)p.bestCombo=Math.max(p.bestCombo,r.combo);
  if(r.perfect)p.perfect++;
  if(r.sprint!=null)p.sprintBest=Math.max(p.sprintBest,r.sprint);
  if(r.tf!=null)p.tfBest=Math.max(p.tfBest,r.tf);
  if(r.matchMs!=null)p.matchBest=p.matchBest==null?r.matchMs:Math.min(p.matchBest,r.matchMs);
  if(r.memMoves!=null)p.memBest=p.memBest==null?r.memMoves:Math.min(p.memBest,r.memMoves);
  if(r.popped)p.popped+=r.popped;if(r.fills)p.fillsRight+=r.fills;
  const h=new Date().getHours();if(h>=22)p.night++;if(h>=4&&h<8)p.early++;
  const shieldUsed=markPlayed(p);
  const doneQ=[];for(const id of todayQuests()){const q=QUESTS[id];if(!d.claimed[id]&&q.v(d)>=q.n){d.claimed[id]=1;p.xp+=QUEST_XP;d.xp+=QUEST_XP;doneQ.push(q)}}
  const fresh=checkAch(p);saveProf();
  const lvl=levelInfo(p.xp),up=lvl.n>before;
  if(fresh.length||doneQ.length)confetti();
  let delay=500;
  doneQ.forEach(q=>{setTimeout(()=>toast(`Detyra e ditës u krye: ${q.t} · +${QUEST_XP} XP`),delay);delay+=2400});
  fresh.forEach(f=>{setTimeout(()=>achToast(f),delay);delay+=2600});
  if(shieldUsed)setTimeout(()=>toast("Mburoja e serisë të shpëtoi ditët rresht!"),delay);
  if(up)setTimeout(()=>levelUp(lvl),300);
  return{fresh,lvl,up};
}
function levelUp(L){const o=document.createElement("div");o.className="levelup";o.setAttribute("role","dialog");o.setAttribute("aria-label","Nivel i ri");
  o.innerHTML=`<div class="box"><span class="lvl">${L.n}</span><span class="eyebrow">Nivel i ri!</span><h2 style="font-size:28px">Tani je ${esc(L.title)}</h2><p style="color:var(--muted);margin:10px 0 18px">Vazhdo kështu – edhe ${L.toNext} XP për nivelin ${L.n+1}.</p><button class="btn btn-fun btn-lg" id="lu-ok">Vazhdo</button></div>`;
  document.body.appendChild(o);confetti();beep(true,true);const close=()=>o.remove();$("#lu-ok",o).onclick=close;o.onclick=e=>{if(e.target===o)close()};$("#lu-ok",o).focus()}
function playerStrip(){
  const p=prof(),L=levelInfo(p.xp),ds=dayStreak(),c=achCount(),d=todayData(p),qd=todayQuests().filter(id=>d.claimed[id]).length;
  return `<div class="player"><span class="lvl" title="Niveli">${L.n}</span><div class="who"><b>${L.title}</b><small>${p.xp} XP · edhe ${L.toNext} për nivelin ${L.n+1}</small><div class="lvl-bar"><i style="width:${L.pct}%"></i></div></div>
    <div class="chips2"><span class="pchip fire" title="Ditë rresht">${I.flame} ${ds}</span>${p.streak.shields?`<span class="pchip shield" title="Mburoja: ruajnë serinë nëse humbet një ditë">${I.shield} ${p.streak.shields}</span>`:""}<button class="pchip achc" data-ach title="Detyrat e ditës">${I.check.replace(/22/g,"16")} ${qd}/3 detyra</button><button class="pchip achc" data-ach>${I.trophyS} ${c.got}/${c.all}</button></div></div>`;
}
function bestLabel(m,s){
  if(m==="karta")return plural((s.cards||[]).length,"kartë","karta");
  const b=getBest(m,s.id);if(b==null)return modeOk(m,s)?"Pa rekord ende":"Duhen më shumë karta";
  if(m==="kuiz")return `Rekordi: ${b} XP`;if(m==="perputh")return `Rekordi: ${fmtTime(b)}`;if(m==="memory")return `Rekordi: ${b} lëvizje`;
  return `Rekordi: ${b} të sakta`;
}
function setupScreen(md,title,desc,opts,extra){
  return `<div class="setup"><div class="big-blob">${md.icon}</div><h2>${title}</h2><p>${desc}</p>${opts?`<div class="opt-rows">${opts}</div>`:"<div style='height:18px'></div>"}
    <button class="btn-play" id="g-start">${I.game.replace(/22/g,"20")} Fillo lojën</button>${extra||""}</div>`;
}
let T1=null,RAF=null;
function stopTimers(){if(T1){clearInterval(T1);T1=null}if(RAF){cancelAnimationFrame(RAF);RAF=null}}
function resetGame(m){if(m==="kuiz")G=null;if(m==="sprint")SP=null;if(m==="vg")TF=null;if(m==="perputh")M=null;if(m==="ploteso")FI=null;if(m==="memory")MEM=null;if(m==="balona")BAL=null}
const LET=["A","B","C","D"];
const PRAISE=["Saktë!","Shkëlqyeshëm!","Bravo!","Ashtu është!","Super!"],PRAISE_KID=["Bravo, yll! ⭐","Shumë mirë! 🎉","Super! 🌟","Je kampion! 🏆","Ua! 🎈"];
const kidNow=()=>{const s=sets.find(x=>x.id===view.id);return isKid(s)};
const pickPraise=()=>{const a=kidNow()?PRAISE_KID:PRAISE;return a[Math.floor(Math.random()*a.length)]};
const heartsHtml=(n,max)=>Array.from({length:max},(_,i)=>`<span style="color:${i<n?"var(--coral)":"var(--line)"};fill:currentColor">${I.heart}</span>`).join("");
const xpChip=v=>`<span class="xp" id="xp">${I.starS} ${v}</span>`;
function fmtTime(ms){return (ms/1000).toFixed(1).replace(".",",")+" s"}

/* Pyetjet: nga AI, ose të krijuara nga kartat */
function cardQs(s){const c=(s.cards||[]).filter(x=>x.term&&x.def);if(c.length<4)return[];
  return shuffle(c).map(card=>{const others=shuffle(c.filter(x=>x.term!==card.term)).slice(0,3).map(x=>x.term);if(others.length<3)return null;
    const options=shuffle([card.term,...others]);return{q:card.def,hint:"Cili term përputhet?",options,answer:options.indexOf(card.term),explanation:`${card.term}: ${card.def}`}}).filter(Boolean)}
function buildQuestions(s){
  if(s.quiz&&s.quiz.length)return shuffle(s.quiz).map(q=>{const order=shuffle([0,1,2,3]);return{q:q.q,hint:"Zgjidh përgjigjen e saktë",options:order.map(i=>q.options[i]),answer:order.indexOf(q.answer),explanation:q.explanation||""}});
  return cardQs(s);
}

/* ===== KUIZ ===== */
let G=null;
function quizOpts(){return Object.assign({count:10,lives:3},lsGet("sin_qopt",{}))}
function newGame(s,onlyWrong){
  const o=quizOpts();let qs=buildQuestions(s);
  if(onlyWrong&&G&&G.id===s.id&&G.missed&&G.missed.length){const miss=new Set(G.missed);qs=qs.filter(q=>miss.has(q.q))}else if(o.count)qs=qs.slice(0,o.count);
  G={id:s.id,qs,queue:qs.map((_,i)=>i),pos:0,lives:o.lives,hearts:o.lives||Infinity,xp:0,streak:0,best:0,firstRight:0,right:0,cleared:0,requeued:new Set(),missed:[],picked:null,state:"ask",finished:false};
}
function renderQuiz(s,restart){
  const box=$("#study");if(!box)return;const md=MODES[1];
  if(restart)newGame(s);if(!G||G.id!==s.id)G={id:s.id,state:"setup"};
  const total0=buildQuestions(s).length;
  if(!total0){box.innerHTML=emptyBox("Ky set ka shumë pak karta për kuiz","Kuizi krijohet kur seti ka të paktën 4 karta.");return}
  if(G.state==="setup"){const o=quizOpts(),b=getBest("kuiz",s.id);
    box.innerHTML=setupScreen(md,"Kuiz","Zgjidh përgjigjen e saktë. Pyetjet e gabuara kthehen më vonë në raund.",
      `<div class="opt-row"><span>Pyetje</span>${seg("qc",[[10,"10"],[20,"20"],[0,`Të gjitha (${total0})`]],o.count)}</div><div class="opt-row"><span>Jetë</span>${seg("ql",[[3,"3"],[5,"5"],[0,"Pa kufi"]],o.lives)}</div>`,
      b!=null?`<div class="pb">Rekordi yt: ${b} XP</div>`:"");
    $$("[data-qc]",box).forEach(x=>x.onclick=()=>{lsSet("sin_qopt",Object.assign(quizOpts(),{count:+x.dataset.qc}));renderQuiz(s)});
    $$("[data-ql]",box).forEach(x=>x.onclick=()=>{lsSet("sin_qopt",Object.assign(quizOpts(),{lives:+x.dataset.ql}));renderQuiz(s)});
    $("#g-start").onclick=()=>{newGame(s);renderQuiz(s)};return}
  if(G.state==="over"||G.state==="done")return quizResult(s);
  const q=G.qs[G.queue[G.pos]],total=G.qs.length,answered=G.state!=="ask";
  box.innerHTML=`<div class="gtop"><div class="hearts">${G.lives?heartsHtml(G.hearts,G.lives):`<span class="streak" style="background:var(--mint-soft);color:var(--mint-ink)">∞</span>`}</div>
      <div class="gbar" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${G.cleared}" aria-label="Përparimi"><i style="width:${(G.cleared/total*100).toFixed(1)}%"></i></div>
      ${G.streak>1?`<span class="streak">${I.flame}${G.streak}</span>`:""}${xpChip(G.xp)}${muteBtn()}</div>
    <div class="qcard" id="qcard"><span class="qhint">Pyetja ${Math.min(G.cleared+1,total)} nga ${total}</span><div class="qtext">${esc(q.q)}</div>
      <div class="opts">${q.options.map((o,i)=>{let cls="";if(answered){if(i===q.answer)cls="right";else if(i===G.picked)cls="wrong";else cls="dim"}
        return `<button class="qopt ${cls}" data-opt="${i}" ${answered?"disabled":""}><span class="k k${i}">${LET[i]}</span><span class="t">${esc(o)}</span></button>`}).join("")}</div>
      ${answered?`<div class="fbk ${G.state==="right"?"ok":"no"}"><div class="msg"><b>${G.state==="right"?pickPraise():"Jo tamam."}</b><span>${esc(G.state==="right"?(q.explanation||""):("Përgjigjja e saktë: "+q.options[q.answer]+(q.explanation?" – "+q.explanation:"")))}</span></div><button class="btn btn-cont" id="qnext">${G.hearts<=0?"Shiko rezultatin":"Vazhdo"}</button></div>`:""}
    </div><div class="kbd">Tastiera: 1–4 për të zgjedhur · Enter për të vazhduar</div>`;
  bindMute(()=>renderQuiz(s));
  $$("[data-opt]",box).forEach(b=>b.onclick=()=>{
    if(G.state!=="ask")return;G.picked=+b.dataset.opt;const idx=G.queue[G.pos];
    if(G.picked===q.answer){G.state="right";G.streak++;G.right++;G.best=Math.max(G.best,G.streak);const gain=10+Math.min(G.streak-1,5)*2;G.xp+=gain;G.cleared++;if(!G.requeued.has(idx))G.firstRight++;beep(true);renderQuiz(s);popXp($("#xp"),"+"+gain)}
    else{G.state="wrong";G.streak=0;if(G.lives)G.hearts--;if(!G.missed.includes(q.q))G.missed.push(q.q);if(!G.requeued.has(idx)&&G.hearts>0){G.requeued.add(idx);G.queue.push(idx)}beep(false);renderQuiz(s);const c=$("#qcard");if(c)c.classList.add("shake")}
  });
  const nx=$("#qnext");if(nx){nx.focus({preventScroll:true});const fb=$(".fbk");if(fb)fb.scrollIntoView({block:"nearest",behavior:reduceMotion()?"auto":"smooth"});
    nx.onclick=()=>{if(G.hearts<=0){G.state="over";return renderQuiz(s)}G.pos++;G.picked=null;if(G.pos>=G.queue.length){G.state="done";return renderQuiz(s)}G.state="ask";renderQuiz(s)}}
}
function quizResult(s){
  const box=$("#study"),total=G.qs.length,acc=Math.round(G.firstRight/total*100),won=G.state==="done",stars=won?(acc>=90?3:acc>=70?2:1):0;
  if(!G.finished){G.finished=true;G.record=setBest("kuiz",s.id,G.xp).rec&&G.xp>0;G.fresh=finishGame({mode:"kuiz",setId:s.id,xp:G.xp,combo:G.best,right:G.right,perfect:won&&acc===100}).fresh;refreshHub(s)}
  const ds=dayStreak();
  box.innerHTML=`<div class="result"><h2>${won?(stars===3?"E përsosur!":"Raundi përfundoi!"):"Mbaruan jetët!"}</h2>
    <p style="color:var(--muted);margin:6px 0 0">${won?"I kalove të gjitha pyetjet.":"Mos u dorëzo – provo sërish, pyetjet e gabuara kthehen."}</p>
    <div class="stars" aria-label="${stars} yje nga 3">${[0,1,2].map(i=>`<span style="fill:${i<stars?"var(--sun)":"var(--line)"}">${I.star}</span>`).join("")}</div>
    ${newAchHtml(G.fresh)}${ds?`<span class="day-streak">${I.flame} ${plural(ds,"ditë","ditë")} rresht</span>`:""}
    <div class="rstats"><div><b>${G.xp}</b><small>XP${G.record?" · rekord!":""}</small></div><div><b>${acc}%</b><small>saktë herën e parë</small></div><div><b>${G.best}</b><small>seria më e gjatë</small></div></div>
    ${resActs(s,`${G.missed.length?`<button class="btn-play" id="q-miss">Praktiko ${plural(G.missed.length,"gabimin","gabimet")}</button>`:""}<button class="${G.missed.length?"btn btn-ghost":"btn-play"}" id="q-again">Luaj sërish</button><button class="btn btn-ghost" id="q-set">Cilësimet</button>`)}</div>`;
  $("#q-again").onclick=()=>renderQuiz(s,true);$("#q-set").onclick=()=>{G.state="setup";renderQuiz(s)};
  const qm=$("#q-miss");if(qm)qm.onclick=()=>{newGame(s,true);renderQuiz(s)};bindMar(s);
}

/* ===== SPRINT 60 SEKONDA ===== */
let SP=null;const SPRINT_MS=60000;
function renderSprint(s){
  const box=$("#study");if(!box)return;const md=MODES[2];
  if(!buildQuestions(s).length){box.innerHTML=emptyBox("Ky set ka shumë pak karta për Sprint","Duhen të paktën 4 karta.");return}
  if(!SP||SP.id!==s.id)SP={id:s.id,state:"setup"};
  if(SP.state==="setup"){const b=getBest("sprint",s.id);
    box.innerHTML=setupScreen(md,"Sprint 60 sekonda","Përgjigju sa më shumë pyetjeve në një minutë. Çdo gabim të merr 3 sekonda. Seritë japin pikë shtesë.","",b!=null?`<div class="pb">Rekordi yt: ${b} të sakta</div>`:"");
    $("#g-start").onclick=()=>{SP={id:s.id,state:"play",qs:buildQuestions(s),i:0,score:0,wrong:0,combo:0,best:0,xp:0,end:Date.now()+SPRINT_MS,lock:false};renderSprint(s)};return}
  if(SP.state==="done")return sprintResult(s);
  if(SP.i>=SP.qs.length){SP.qs=buildQuestions(s);SP.i=0}
  const q=SP.qs[SP.i];
  box.innerHTML=`<div class="gtop"><div class="ring" id="ring"><b id="secs">60</b></div><div style="flex:1"><div class="score-big">${SP.score}</div><small style="color:var(--muted);font-weight:700">të sakta</small></div>
      ${SP.combo>1?`<span class="streak">${I.flame}${SP.combo}</span>`:""}${xpChip(SP.xp)}${muteBtn()}</div>
    <div class="qcard" id="qcard"><span class="qhint">Shpejt!</span><div class="qtext">${esc(q.q)}</div>
      <div class="opts">${q.options.map((o,i)=>`<button class="qopt" data-opt="${i}"><span class="k k${i}">${LET[i]}</span><span class="t">${esc(o)}</span></button>`).join("")}</div></div><div class="kbd">Tastiera: 1–4</div>`;
  bindMute(()=>renderSprint(s));
  const tick=()=>{const left=Math.max(0,SP.end-Date.now()),r=$("#ring"),sec=$("#secs");if(r){r.style.setProperty("--p",(left/SPRINT_MS*100).toFixed(1));r.classList.toggle("low",left<10000)}if(sec)sec.textContent=Math.ceil(left/1000);
    if(left<=0){stopTimers();SP.state="done";renderSprint(s)}};
  stopTimers();tick();T1=setInterval(()=>{if(view.name!=="set"||view.mode!=="sprint"){stopTimers();return}tick()},100);
  $$("[data-opt]",box).forEach(b=>b.onclick=()=>{
    if(SP.lock||SP.state!=="play")return;SP.lock=true;const pick=+b.dataset.opt,ok=pick===q.answer;
    $$("[data-opt]",box).forEach(x=>{const i=+x.dataset.opt;x.disabled=true;x.classList.add(i===q.answer?"right":i===pick?"wrong":"dim")});
    if(ok){SP.score++;SP.combo++;SP.best=Math.max(SP.best,SP.combo);const g=8+Math.min(SP.combo-1,6)*2;SP.xp+=g;beep(true);popXp($("#xp"),"+"+g)}
    else{SP.combo=0;SP.wrong++;SP.end-=3000;beep(false);const c=$("#qcard");if(c)c.classList.add("shake")}
    setTimeout(()=>{if(SP.state!=="play")return;SP.i++;SP.lock=false;renderSprint(s)},ok?380:900);
  });
}
function sprintResult(s){
  const box=$("#study");
  if(!SP.finished){SP.finished=true;SP.record=setBest("sprint",s.id,SP.score).rec&&SP.score>0;SP.fresh=finishGame({mode:"sprint",setId:s.id,xp:SP.xp,combo:SP.best,sprint:SP.score,right:SP.score}).fresh;refreshHub(s)}
  box.innerHTML=`<div class="result"><h2>${SP.record?"Rekord i ri!":"Koha mbaroi!"}</h2><p style="color:var(--muted);margin:6px 0 0">Ja sa arrite në 60 sekonda.</p>${newAchHtml(SP.fresh)}
    <div class="rstats"><div><b>${SP.score}</b><small>të sakta</small></div><div><b>${SP.wrong}</b><small>gabime</small></div><div><b>${SP.best}</b><small>seria më e gjatë</small></div><div><b>${SP.xp}</b><small>XP</small></div></div>
    ${resActs(s,`<button class="btn-play" id="sp-again">Luaj sërish</button>`)}</div>`;
  $("#sp-again").onclick=()=>{SP={id:s.id,state:"setup"};renderSprint(s);$("#g-start").click()};bindMar(s);
}

/* ===== E VËRTETË APO E GABUAR ===== */
let TF=null;
function buildTF(s){const c=(s.cards||[]).filter(x=>x.term&&x.def);if(c.length<3)return[];
  return shuffle(c).concat(shuffle(c)).slice(0,15).map(card=>{const truth=Math.random()<.5;if(truth)return{term:card.term,def:card.def,truth,real:card.def};
    const other=shuffle(c.filter(x=>x.term!==card.term&&x.def!==card.def))[0];return other?{term:card.term,def:other.def,truth:false,real:card.def}:{term:card.term,def:card.def,truth:true,real:card.def}})}
function renderTF(s){
  const box=$("#study");if(!box)return;const md=MODES[3];
  if(!buildTF(s).length){box.innerHTML=emptyBox("Ky set ka shumë pak karta për këtë lojë","Duhen të paktën 3 karta.");return}
  if(!TF||TF.id!==s.id)TF={id:s.id,state:"setup"};
  if(TF.state==="setup"){const b=getBest("vg",s.id);
    box.innerHTML=setupScreen(md,"E vërtetë apo e gabuar","A i përket ky përkufizim këtij termi? Vendos shpejt. Ke 3 jetë dhe 15 pohime.","",b!=null?`<div class="pb">Rekordi yt: ${b} të sakta</div>`:"");
    $("#g-start").onclick=()=>{TF={id:s.id,state:"play",items:buildTF(s),i:0,score:0,hearts:3,combo:0,best:0,xp:0,lock:false,last:null};renderTF(s)};return}
  if(TF.state==="done")return tfResult(s);
  const it=TF.items[TF.i];
  box.innerHTML=`<div class="gtop"><div class="hearts">${heartsHtml(TF.hearts,3)}</div><div class="gbar"><i style="width:${(TF.i/TF.items.length*100).toFixed(1)}%"></i></div>${TF.combo>1?`<span class="streak">${I.flame}${TF.combo}</span>`:""}${xpChip(TF.xp)}${muteBtn()}</div>
    <div class="qcard tf-card" id="qcard"><span class="qhint">Pohimi ${TF.i+1} nga ${TF.items.length}</span><div class="term">${esc(it.term)}</div><div class="eq" aria-hidden="true">=</div><div class="def">${esc(it.def)}</div>
      ${TF.last?`<div class="fbk ${TF.last.ok?"ok":"no"}" style="text-align:left"><div class="msg"><b>${TF.last.ok?pickPraise():"Gabim!"}</b><span>${TF.last.ok?"":esc("Përkufizimi i saktë i “"+TF.last.term+"”: "+TF.last.real)}</span></div></div>`:""}
      <div class="tf-btns"><button class="tf-yes" id="tf-yes" ${TF.lock?"disabled":""}>${I.check} E vërtetë</button><button class="tf-no" id="tf-no" ${TF.lock?"disabled":""}>${I.x} E gabuar</button></div></div>
    <div class="kbd">Tastiera: ← ose V = e vërtetë · → ose G = e gabuar</div>`;
  bindMute(()=>renderTF(s));
  const answer=yes=>{if(TF.lock)return;const ok=yes===it.truth;TF.lock=true;let g=0;
    if(ok){TF.score++;TF.combo++;TF.best=Math.max(TF.best,TF.combo);g=6+Math.min(TF.combo-1,5)*2;TF.xp+=g;beep(true)}else{TF.hearts--;TF.combo=0;beep(false)}
    TF.last={ok,term:it.term,real:it.real};renderTF(s);const c=$("#qcard");if(c)c.classList.add(ok?"flash-ok":"flash-no");if(ok)popXp($("#xp"),"+"+g);
    setTimeout(()=>{if(TF.state!=="play")return;TF.lock=false;TF.i++;if(TF.hearts<=0||TF.i>=TF.items.length)TF.state="done";if(ok)TF.last=null;renderTF(s)},ok?450:1600)};
  $("#tf-yes").onclick=()=>answer(true);$("#tf-no").onclick=()=>answer(false);
}
function tfResult(s){
  const box=$("#study");
  if(!TF.finished){TF.finished=true;TF.record=setBest("vg",s.id,TF.score).rec&&TF.score>0;TF.fresh=finishGame({mode:"vg",setId:s.id,xp:TF.xp,combo:TF.best,tf:TF.score,right:TF.score}).fresh;refreshHub(s)}
  box.innerHTML=`<div class="result"><h2>${TF.hearts>0?"Bravo, detektiv!":"Mbaruan jetët!"}</h2><p style="color:var(--muted);margin:6px 0 0">${TF.score} nga ${TF.items.length} pohime i gjete saktë.</p>${newAchHtml(TF.fresh)}
    <div class="rstats"><div><b>${TF.score}</b><small>të sakta${TF.record?" · rekord!":""}</small></div><div><b>${TF.best}</b><small>seria më e gjatë</small></div><div><b>${TF.xp}</b><small>XP</small></div></div>
    ${resActs(s,`<button class="btn-play" id="tf-again">Luaj sërish</button>`)}</div>`;
  $("#tf-again").onclick=()=>{TF={id:s.id,state:"setup"};renderTF(s);$("#g-start").click()};bindMar(s);
}

/* ===== PËRPUTH ===== */
let M=null;
function newMatch(s){
  const c=shuffle((s.cards||[]).filter(x=>x.term&&x.def)).slice(0,6),cut=t=>t.length>110?t.slice(0,107)+"…":t;
  const tiles=shuffle(c.flatMap((card,i)=>[{pair:i,kind:"term",text:cut(card.term)},{pair:i,kind:"def",text:cut(card.def)}])).map((t,k)=>Object.assign(t,{k}));
  M={id:s.id,tiles,sel:null,gone:new Set(),start:0,penalty:0,end:0,pairs:c.length};
}
function renderMatch(s,restart){
  const box=$("#study");if(!box)return;stopTimers();
  if(restart||!M||M.id!==s.id)newMatch(s);
  if(M.pairs<2){box.innerHTML=emptyBox("Ky set ka shumë pak karta për këtë lojë");return}
  if(M.end){const t=M.end-M.start+M.penalty;
    if(!M.finished){M.finished=true;const r=setBest("perputh",s.id,t,true);M.prev=r.old;M.record=r.rec;M.fresh=finishGame({mode:"perputh",setId:s.id,xp:M.pairs*8+Math.max(0,40-Math.round(t/1000)),matchMs:t,right:M.pairs}).fresh;refreshHub(s)}
    box.innerHTML=`<div class="result"><h2>${M.record?"Rekord i ri!":"Bravo!"}</h2><p style="color:var(--muted);margin:6px 0 0">I përpute të ${M.pairs} çiftet.</p>${newAchHtml(M.fresh)}
      <div class="rstats"><div><b>${fmtTime(t)}</b><small>koha jote</small></div><div><b>${fmtTime(Math.min(t,M.prev||t))}</b><small>rekordi yt</small></div></div>
      ${resActs(s,`<button class="btn-play" id="m-again">Luaj sërish</button>`)}</div>`;
    $("#m-again").onclick=()=>renderMatch(s,true);bindMar(s);return}
  box.innerHTML=`<div class="setup" style="padding:18px 16px 20px;text-align:left"><div class="match-top"><div><b style="font-family:var(--display);font-size:19px">Përputh termat me përkufizimet</b><div style="color:var(--muted);font-size:14px">Çdo gabim shton 1 sekondë. Koha nis me prekjen e parë.</div></div><span class="clock" id="clock">0,0 s</span></div>
    <div class="match-grid">${M.tiles.map(t=>`<button class="mt ${t.kind}${M.gone.has(t.k)?" gone":""}" data-k="${t.k}">${esc(t.text)}</button>`).join("")}</div></div><button id="g-start" hidden></button>`;
  const clock=$("#clock"),tick=()=>{if(clock&&M.start)clock.textContent=fmtTime(Date.now()-M.start+M.penalty)};
  const startT=()=>{T1=setInterval(()=>{if(view.name!=="set"||view.mode!=="perputh"){stopTimers();return}tick()},100)};
  if(M.start){startT();tick()}
  $$("[data-k]",box).forEach(b=>b.onclick=()=>{
    const t=M.tiles[+b.dataset.k];if(M.gone.has(t.k))return;
    if(!M.start){M.start=Date.now();startT()}
    if(M.sel===null){M.sel=t.k;b.classList.add("sel");return}
    if(M.sel===t.k){M.sel=null;b.classList.remove("sel");return}
    const a=M.tiles[M.sel],ea=$(`[data-k="${a.k}"]`,box);M.sel=null;
    if(a.pair===t.pair&&a.kind!==t.kind){beep(true);[ea,b].forEach(x=>{x.classList.remove("sel");x.classList.add("ok")});M.gone.add(a.k);M.gone.add(t.k);
      setTimeout(()=>{[ea,b].forEach(x=>x.classList.add("gone"));if(M.gone.size===M.tiles.length){M.end=Date.now();stopTimers();setTimeout(()=>renderMatch(s),350)}},250)}
    else{beep(false);M.penalty+=1000;[ea,b].forEach(x=>{x.classList.remove("sel");x.classList.add("bad")});setTimeout(()=>[ea,b].forEach(x=>x.classList.remove("bad")),450)}
  });
}

/* ===== PLOTËSO ===== */
let FI=null;
function buildFills(s){
  let f=(s.fills||[]).filter(x=>x&&x.s&&x.a&&x.s.includes("____"));
  if(f.length<6){const c=(s.cards||[]).filter(x=>x.term&&x.def&&x.term.length<=40&&x.def.length<=220);f=f.concat(c.map(x=>({s:"____ – "+x.def,a:x.term})))}
  return f;
}
const norm=t=>String(t||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g," ").trim();
function lev(a,b){const m=a.length,n=b.length;if(Math.abs(m-n)>2)return 9;let p=Array.from({length:n+1},(_,j)=>j);for(let i=1;i<=m;i++){const c=[i];for(let j=1;j<=n;j++)c[j]=Math.min(p[j]+1,c[j-1]+1,p[j-1]+(a[i-1]===b[j-1]?0:1));p=c}return p[n]}
function closeEnough(typed,ans){const a=norm(typed),b=norm(ans);if(!a)return false;if(a===b)return true;const tol=b.length>=10?2:b.length>=5?1:0;return lev(a,b)<=tol}
function renderFill(s){
  const box=$("#study");if(!box)return;const md=MODES[5],kid=isKid(s);
  const all=buildFills(s);
  if(all.length<3){box.innerHTML=emptyBox("Ky set ka shumë pak fjali për këtë lojë","Duhen të paktën 3 karta me terma të shkurtër.");return}
  if(!FI||FI.id!==s.id)FI={id:s.id,state:"setup"};
  if(FI.state==="setup"){const b=getBest("ploteso",s.id);
    box.innerHTML=setupScreen(md,"Plotëso fjalinë",kid?"Zgjidh fjalën që mungon. Çdo përgjigje e saktë të jep një yll!":"Shkruaj fjalën që mungon – ose zgjidh nga opsionet. Shkrimi i saktë jep më shumë XP.","",b!=null?`<div class="pb">Rekordi yt: ${b} të sakta</div>`:"");
    $("#g-start").onclick=()=>{const items=shuffle(all).slice(0,kid?8:10),pool=[...new Set(all.map(x=>x.a))];
      FI={id:s.id,state:"ask",items:items.map(it=>{const others=shuffle(pool.filter(a=>norm(a)!==norm(it.a))).slice(0,3);return Object.assign({},it,{opts:shuffle([it.a,...others])})}),i:0,hearts:3,score:0,xp:0,combo:0,best:0,typed:"",last:null};renderFill(s)};return}
  if(FI.state==="done")return fillResult(s);
  const it=FI.items[FI.i],ans=FI.state!=="ask";
  const parts=it.s.split("____");
  const gap=`<span class="gap${ans?(FI.last.ok?" ok":" no"):""}">${ans?esc(it.a):"&nbsp;?&nbsp;"}</span>`;
  box.innerHTML=`<div class="gtop"><div class="hearts">${heartsHtml(FI.hearts,3)}</div><div class="gbar"><i style="width:${(FI.i/FI.items.length*100).toFixed(1)}%"></i></div>${FI.combo>1?`<span class="streak">${I.flame}${FI.combo}</span>`:""}${xpChip(FI.xp)}${muteBtn()}</div>
    <div class="qcard" id="qcard"><span class="qhint">Fjalia ${FI.i+1} nga ${FI.items.length}</span>
      <div class="fill-s">${esc(parts[0])}${gap}${esc(parts.slice(1).join("____"))}</div>
      ${ans?`<div class="fbk ${FI.last.ok?"ok":"no"}"><div class="msg"><b>${FI.last.ok?pickPraise():"Jo tamam."}</b><span>${FI.last.ok?(FI.last.typed?"E shkrove vetë – XP shtesë!":""):"Përgjigjja e saktë: "+esc(it.a)}</span></div><button class="btn btn-cont" id="qnext">${FI.hearts<=0?"Shiko rezultatin":"Vazhdo"}</button></div>`
      :`${kid?"":`<form class="fill-form" id="fform"><label class="sr" for="fin">Fjala që mungon</label><input class="t" id="fin" autocomplete="off" placeholder="Shkruaj fjalën që mungon…"><button class="btn btn-cont" type="submit">Kontrollo</button></form>`}
      <div class="fill-chips">${it.opts.map((o,i)=>`<button data-chip="${i}">${kid?"":`<span style="color:var(--muted);margin-right:6px">${i+1}</span>`}${esc(o)}</button>`).join("")}</div>`}
    </div>${kid?"":`<div class="kbd">Shkruaj dhe shtyp Enter, ose zgjidh me 1–4</div>`}`;
  bindMute(()=>renderFill(s));
  const answer=(ok,typed)=>{FI.state="ans";FI.last={ok,typed};
    if(ok){FI.score++;FI.combo++;FI.best=Math.max(FI.best,FI.combo);const g=(typed?15:10)+Math.min(FI.combo-1,5)*2;FI.xp+=g;beep(true);renderFill(s);popXp($("#xp"),"+"+g)}
    else{FI.hearts--;FI.combo=0;beep(false);renderFill(s);const c=$("#qcard");if(c)c.classList.add("shake")}};
  const ff=$("#fform");if(ff){const inp=$("#fin");if(!("ontouchstart" in window))inp.focus({preventScroll:true});ff.onsubmit=e=>{e.preventDefault();if(!inp.value.trim())return;answer(closeEnough(inp.value,it.a),true)}}
  $$("[data-chip]",box).forEach(b=>b.onclick=()=>{if(FI.state!=="ask")return;answer(norm(it.opts[+b.dataset.chip])===norm(it.a),false)});
  const nx=$("#qnext");if(nx){nx.focus({preventScroll:true});nx.onclick=()=>{if(FI.hearts<=0){FI.state="done";return renderFill(s)}FI.i++;if(FI.i>=FI.items.length){FI.state="done";return renderFill(s)}FI.state="ask";renderFill(s)}}
}
function fillResult(s){
  const box=$("#study");
  if(!FI.finished){FI.finished=true;FI.record=setBest("ploteso",s.id,FI.score).rec&&FI.score>0;FI.fresh=finishGame({mode:"ploteso",setId:s.id,xp:FI.xp,combo:FI.best,right:FI.score,fills:FI.score}).fresh;refreshHub(s)}
  box.innerHTML=`<div class="result"><h2>${FI.hearts>0?"Fjalitë u plotësuan!":"Mbaruan jetët!"}</h2><p style="color:var(--muted);margin:6px 0 0">${FI.score} nga ${FI.items.length} saktë.</p>${newAchHtml(FI.fresh)}
    <div class="rstats"><div><b>${FI.score}</b><small>të sakta${FI.record?" · rekord!":""}</small></div><div><b>${FI.best}</b><small>seria më e gjatë</small></div><div><b>${FI.xp}</b><small>XP</small></div></div>
    ${resActs(s,`<button class="btn-play" id="fi-again">Luaj sërish</button>`)}</div>`;
  $("#fi-again").onclick=()=>{FI={id:s.id,state:"setup"};renderFill(s);$("#g-start").click()};bindMar(s);
}

/* ===== MEMORY ===== */
let MEM=null;
function renderMemory(s){
  const box=$("#study");if(!box)return;const md=MODES[6],kid=isKid(s);
  const c=(s.cards||[]).filter(x=>x.term&&x.def);
  if(c.length<3){box.innerHTML=emptyBox("Ky set ka shumë pak karta për Memory","Duhen të paktën 3 karta.");return}
  if(!MEM||MEM.id!==s.id)MEM={id:s.id,state:"setup"};
  if(MEM.state==="setup"){const b=getBest("memory",s.id);
    box.innerHTML=setupScreen(md,"Memory","Kthe dy karta: nëse termi dhe përkufizimi i tij përputhen, mbeten të hapura. Gjej të gjitha çiftet me sa më pak lëvizje.","",b!=null?`<div class="pb">Rekordi yt: ${b} lëvizje</div>`:"");
    $("#g-start").onclick=()=>{const cut=t=>t.length>90?t.slice(0,87)+"…":t,pick=shuffle(c).slice(0,kid?4:6);
      MEM={id:s.id,state:"play",pairs:pick.length,tiles:shuffle(pick.flatMap((x,i)=>[{pair:i,kind:"term",text:cut(x.term)},{pair:i,kind:"def",text:cut(x.def)}])).map((t,k)=>Object.assign(t,{k})),open:[],done:new Set(),moves:0,start:Date.now(),lock:false};renderMemory(s)};return}
  if(MEM.state==="done")return memResult(s);
  box.innerHTML=`<div class="gtop"><span style="font-weight:800">Lëvizje: <span id="mv" style="font-family:var(--display)">${MEM.moves}</span></span><div class="gbar"><i id="mbar" style="width:${(MEM.done.size/MEM.tiles.length*100).toFixed(0)}%"></i></div>${muteBtn()}</div>
    <div class="match-grid">${MEM.tiles.map(t=>`<button class="mem${MEM.done.has(t.k)?" done":""}${MEM.open.includes(t.k)?" open":""}" data-m="${t.k}" aria-label="${MEM.done.has(t.k)||MEM.open.includes(t.k)?esc(t.text):"Kartë e mbyllur"}"><span class="in"><span class="fr">${sm()}</span><span class="bk ${t.kind==="term"?"term":""}">${esc(t.text)}</span></span></button>`).join("")}</div>`;
  bindMute(()=>renderMemory(s));
  $$("[data-m]",box).forEach(b=>b.onclick=()=>{
    const k=+b.dataset.m,t=MEM.tiles[k];if(MEM.lock||MEM.done.has(k)||MEM.open.includes(k))return;
    MEM.open.push(k);b.classList.add("open");b.setAttribute("aria-label",t.text);
    if(MEM.open.length<2)return;
    MEM.moves++;$("#mv").textContent=MEM.moves;const [a,c2]=MEM.open.map(i=>MEM.tiles[i]),ea=$(`[data-m="${a.k}"]`,box);
    if(a.pair===c2.pair&&a.kind!==c2.kind){MEM.done.add(a.k);MEM.done.add(c2.k);MEM.open=[];beep(true);[ea,b].forEach(x=>x.classList.add("done"));$("#mbar").style.width=(MEM.done.size/MEM.tiles.length*100).toFixed(0)+"%";
      if(MEM.done.size===MEM.tiles.length){MEM.state="done";setTimeout(()=>renderMemory(s),700)}}
    else{MEM.lock=true;beep(false);setTimeout(()=>{[ea,b].forEach(x=>x.classList.add("bad"))},350);setTimeout(()=>{[ea,b].forEach(x=>{x.classList.remove("open","bad");x.setAttribute("aria-label","Kartë e mbyllur")});MEM.open=[];MEM.lock=false},1100)}
  });
}
function memResult(s){
  const box=$("#study"),secs=Math.round((Date.now()-MEM.start)/1000);
  if(!MEM.finished){MEM.finished=true;const r=setBest("memory",s.id,MEM.moves,true);MEM.record=r.rec;MEM.prev=r.old;
    MEM.fresh=finishGame({mode:"memory",setId:s.id,xp:MEM.pairs*10+Math.max(0,MEM.pairs*3-MEM.moves)*3,memMoves:MEM.pairs>=6?MEM.moves:null,right:MEM.pairs}).fresh;refreshHub(s)}
  box.innerHTML=`<div class="result"><h2>${MEM.record?"Rekord i ri!":"Kujtesë e fortë!"}</h2><p style="color:var(--muted);margin:6px 0 0">I gjete të ${MEM.pairs} çiftet.</p>${newAchHtml(MEM.fresh)}
    <div class="rstats"><div><b>${MEM.moves}</b><small>lëvizje</small></div><div><b>${secs} s</b><small>koha</small></div><div><b>${Math.min(MEM.moves,MEM.prev||MEM.moves)}</b><small>rekordi yt</small></div></div>
    ${resActs(s,`<button class="btn-play" id="me-again">Luaj sërish</button>`)}</div>`;
  $("#me-again").onclick=()=>{MEM={id:s.id,state:"setup"};renderMemory(s);$("#g-start").click()};bindMar(s);
}

/* ===== BALONAT ===== */
let BAL=null;
function balloonQs(s){
  const c=(s.cards||[]).filter(x=>x.term&&x.def&&x.term.length<=48);
  if(c.length>=4)return cardQs({cards:c});
  return (s.quiz||[]).filter(q=>q.options.every(o=>String(o).length<=60)).map(q=>{const o=shuffle([0,1,2,3]);return{q:q.q,options:o.map(i=>q.options[i]),answer:o.indexOf(q.answer),explanation:q.explanation||""}});
}
const BCOL=["#7A5CFF","#FF4FA0","#2FA8FF","#16C79A","#FF8A3D","#F2A900","#FF5A72"];
function renderBalloons(s){
  const box=$("#study");if(!box)return;const md=MODES[7],kid=isKid(s);
  const all=balloonQs(s);
  if(!all.length){box.innerHTML=emptyBox("Ky set nuk ka pyetje të shkurtra për Balonat","Provo Kuizin ose Përputh.");return}
  if(!BAL||BAL.id!==s.id)BAL={id:s.id,state:"setup"};
  if(BAL.state==="setup"){const b=getBest("balona",s.id);
    box.innerHTML=setupScreen(md,"Balonat",kid?"Lexo pyetjen dhe plas balonën me përgjigjen e saktë para se të fluturojë! 🎈":"Lexo pyetjen dhe plas balonën me përgjigjen e saktë para se të largohet. Balona e gabuar të merr një jetë.","",b!=null?`<div class="pb">Rekordi yt: ${b} të sakta</div>`:"");
    $("#g-start").onclick=()=>{BAL={id:s.id,state:"play",qs:shuffle(all).slice(0,kid?8:10),i:0,hearts:3,score:0,xp:0,combo:0,best:0,kid};balloonRound(s)};return}
  if(BAL.state==="done")return balResult(s);
  balloonRound(s);
}
function balloonRound(s){
  const box=$("#study");if(!box||!BAL)return;stopTimers();
  if(BAL.hearts<=0||BAL.i>=BAL.qs.length){BAL.state="done";return balResult(s)}
  const q=BAL.qs[BAL.i],lanes=shuffle([13,38,62,87]),kid=BAL.kid;
  box.innerHTML=`<div class="gtop"><div class="hearts">${heartsHtml(BAL.hearts,3)}</div><div class="gbar"><i style="width:${(BAL.i/BAL.qs.length*100).toFixed(1)}%"></i></div>${BAL.combo>1?`<span class="streak">${I.flame}${BAL.combo}</span>`:""}${xpChip(BAL.xp)}${muteBtn()}</div>
    <div class="sky" id="sky"><div class="cloud" style="left:8%;top:38%"></div><div class="cloud" style="left:64%;top:62%;transform:scale(.8)"></div><div class="cloud" style="left:30%;top:80%;transform:scale(.6)"></div>
      <div class="sky-q">${esc(q.q)}</div>
      ${q.options.map((o,i)=>`<button class="balloon" data-b="${i}" style="left:${lanes[i]}%"><span class="bb" style="background:${BCOL[(BAL.i+i)%BCOL.length]};border-top-color:${BCOL[(BAL.i+i)%BCOL.length]}">${esc(o)}</span><span class="str"></span></button>`).join("")}
    </div><div class="kbd">Prek balonën me përgjigjen e saktë</div>`;
  bindMute(()=>balloonRound(s));
  const sky=$("#sky"),H=sky.clientHeight,els=$$("[data-b]",box);
  const st=els.map((el,i)=>({el,i,y:30+Math.random()*70,v:(kid?34:44)+Math.random()*(kid?14:24),gone:false}));
  let last=performance.now(),over=false;
  const end=(ok,msg)=>{if(over)return;over=true;stopTimers();
    const q2=$(".sky-q",box);if(q2)q2.innerHTML=`<b style="color:${ok?"var(--mint-ink)":"var(--coral-ink)"}">${ok?pickPraise():msg}</b>${ok?"":` Përgjigjja: ${esc(q.options[q.answer])}`}`;
    setTimeout(()=>{if(view.name!=="set"||view.mode!=="balona"||!BAL)return;BAL.i++;balloonRound(s)},ok?700:1700)};
  const step=now=>{const dt=Math.min(.05,(now-last)/1000);last=now;
    for(const b of st){if(b.gone)continue;b.y+=b.v*dt;b.el.style.transform=`translate(-50%,${-b.y}px)`;
      if(b.y>H+40){b.gone=true;if(b.i===q.answer){BAL.hearts--;BAL.combo=0;beep(false);const hs=$(".hearts",box);if(hs)hs.innerHTML=heartsHtml(BAL.hearts,3);return end(false,"Iku!")}}}
    if(st.every(b=>b.gone||b.i!==q.answer&&b.y>H+40))return;
    RAF=requestAnimationFrame(step)};
  RAF=requestAnimationFrame(step);
  els.forEach(el=>el.onclick=()=>{if(over)return;const i=+el.dataset.b,b=st[i];if(b.gone)return;b.gone=true;el.classList.add("pop");
    if(i===q.answer){BAL.score++;BAL.combo++;BAL.best=Math.max(BAL.best,BAL.combo);const g=10+Math.min(BAL.combo-1,5)*2;BAL.xp+=g;beep(true);popXp(el,"+"+g);
      st.forEach(x=>{if(!x.gone&&x.i!==i){x.gone=true;x.el.style.opacity=".35"}});end(true)}
    else{BAL.hearts--;BAL.combo=0;beep(false);const hs=$(".hearts",box);if(hs)hs.innerHTML=heartsHtml(BAL.hearts,3);if(BAL.hearts<=0)end(false,"Mbaruan jetët!")}});
}
function balResult(s){
  const box=$("#study");stopTimers();
  if(!BAL.finished){BAL.finished=true;BAL.record=setBest("balona",s.id,BAL.score).rec&&BAL.score>0;BAL.fresh=finishGame({mode:"balona",setId:s.id,xp:BAL.xp,combo:BAL.best,right:BAL.score,popped:BAL.score}).fresh;refreshHub(s)}
  box.innerHTML=`<div class="result"><h2>${BAL.hearts>0?"Qielli u pastrua! 🎈":"Mbaruan jetët!"}</h2><p style="color:var(--muted);margin:6px 0 0">Plase ${plural(BAL.score,"balonë të saktë","balona të sakta")}.</p>${newAchHtml(BAL.fresh)}
    <div class="rstats"><div><b>${BAL.score}</b><small>të sakta${BAL.record?" · rekord!":""}</small></div><div><b>${BAL.best}</b><small>seria më e gjatë</small></div><div><b>${BAL.xp}</b><small>XP</small></div></div>
    ${resActs(s,`<button class="btn-play" id="ba-again">Luaj sërish</button>`)}</div>`;
  $("#ba-again").onclick=()=>{BAL={id:s.id,state:"setup"};renderBalloons(s);$("#g-start").click()};bindMar(s);
}

/* ===== ARRITJET DHE RENDITJA ===== */
function renderAchievements(){
  if(!me)return needLogin();
  const p=prof(),L=levelInfo(p.xp),ds=dayStreak(),c=achCount();
  app.innerHTML=`<div class="prof-head">${avHtml(me,96,true)}<div style="flex:1;min-width:220px"><div class="meta-row" style="font-weight:800">Niveli ${L.n} · ${esc(me.name)}</div><h1>${L.title}</h1>
      <div class="lvl-bar"><i style="width:${L.pct}%"></i></div><small style="color:var(--muted);font-weight:700">${p.xp} XP · edhe ${L.toNext} XP për nivelin ${L.n+1}</small></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><span class="pchip fire">${I.flame} ${plural(ds,"ditë","ditë")} rresht</span><span class="pchip shield" title="Mburojat ruajnë serinë kur humbet një ditë. Fitohet një çdo 7 ditë rresht.">${I.shield} ${p.streak.shields} mburoja</span><span class="pchip achc">${I.trophyS} ${c.got}/${c.all} medalje</span></div></div>
    <div class="section-head"><h2>Detyrat e ditës</h2><span class="meta-row">+${QUEST_XP} XP secila</span></div>${questsHtml()}
    <div class="home-cols"><div>
      <div class="tiles"><div class="tile"><div class="k">Lojëra</div><div class="v">${p.games}</div></div><div class="tile"><div class="k">Të sakta</div><div class="v">${p.right}</div></div><div class="tile"><div class="k">Seria më e gjatë</div><div class="v">${p.bestCombo}</div></div><div class="tile"><div class="k">Ditë rresht (rekord)</div><div class="v">${p.bestStreak||0}</div></div><div class="tile"><div class="k">Sete të luajtura</div><div class="v">${Object.keys(p.sets).length}</div></div></div>
      <section class="section"><div class="section-head"><h2>Medaljet</h2><span class="meta-row">Bronz → Argjend → Ar → Diamant</span></div>
        <div class="ach-grid">${ACH.map(a=>{const t=achTier(a,p),nx=a.t[t],v=a.v(p);
          const pct=nx==null?100:a.low?(v==null?0:Math.max(5,Math.min(95,(a.t[0]*1.6-v)/(a.t[0]*1.6-nx)*100))):Math.min(100,(v||0)/nx*100);
          return `<div class="ach${t?"":" locked"}">${medal(a,t)}<div style="flex:1;min-width:0"><b>${esc(a.name)}${t?` · <span style="color:var(--sun-ink)">${TIERS[t-1][0]}</span>`:""}</b><small>${esc(nx!=null?a.d(nx):a.d(a.t[a.t.length-1]))}</small>
            <div class="apb"><i style="width:${pct.toFixed(0)}%"></i></div><div class="anext">${nx==null?"Niveli maksimal ✓":a.low?(v==null?"Ende pa rezultat":`Rekordi: ${Math.round(v*10)/10}`):`${Math.min(v||0,nx)} / ${nx}`}</div></div></div>`}).join("")}</div></section></div>
      <aside><div class="section-head"><h2>Renditja e javës</h2><span class="meta-row">Rinis çdo të hënë</span></div><div id="lb-full">${lbHtml(LB,20)}</div><p style="color:var(--muted);font-size:13px;margin-top:10px">Emri shfaqet i shkurtuar (p.sh. “Drilon B.”).</p></aside></div>`;
  loadLeaderboard(true).then(d=>{const el=$("#lb-full");if(el&&view.name==="achievements")el.innerHTML=lbHtml(d,20)});
}

/* ===== PANELI I ADMINIT ===== */
let adminData=null;
function renderAdmin(){
  if(!me||!me.isAdmin){app.innerHTML=emptyBox("Kjo faqe është vetëm për adminët","",`<button class="btn btn-primary" data-go2="home">Te kreu</button>`);bindCommon();return}
  if(!adminData){app.innerHTML=loadingBox();loadAdmin();return}
  const d=adminData,st=d.stats,max=Math.max(4,...d.days.map(x=>x.visitors)),nice=Math.ceil(max/4)*4,fmtDay=k=>{const [,mo,da]=k.split("-");return `${+da}.${+mo}`};
  app.innerHTML=`${pageHead("Paneli i adminit",`Mirë se erdhe, ${esc(firstName(me.name))}. Vizitorët, llogaritë, AI dhe detyrat që presin.`,`<button class="btn btn-ghost" id="a-refresh">Rifresko</button>`)}
  <div class="tiles">
    <div class="tile hl"><div class="k"><span class="live-dot" aria-hidden="true"></span>Tani në faqe</div><div class="v">${st.online}</div><div class="s">në 5 minutat e fundit</div></div>
    <div class="tile"><div class="k">Vizitorë sot</div><div class="v">${st.today}</div><div class="s">${st.viewsToday} hapje</div></div>
    <div class="tile"><div class="k">7 / 30 ditë</div><div class="v">${st.week} / ${st.month}</div><div class="s">vizitorë të ndryshëm</div></div>
    <div class="tile"><div class="k">Llogari</div><div class="v">${st.users}</div><div class="s">${st.premium} Premium</div></div>
    <div class="tile"><div class="k">Përmbajtja</div><div class="v">${st.sets+st.materials}</div><div class="s">${plural(st.sets,"set","sete")} · ${plural(st.materials,"material","materiale")}</div></div>
    <div class="tile"><div class="k">Hapësira</div><div class="v">${esc(fmtSize(st.bytes)||"0 B")}</div><div class="s">${plural(st.files,"skedar","skedarë")}</div></div>
  </div>
  <section class="panel"><h2>Vizitorët në 30 ditët e fundit</h2><p class="hint">Persona të ndryshëm që hapën faqen çdo ditë. Kaloni mbi një shtyllë për detajet.</p>
    <div class="chart" role="img" aria-label="Vizitorët në ditë për 30 ditët e fundit">
      ${[1,.5].map(f=>`<div class="grid-l" style="bottom:calc(22px + ${f*100}% - ${f*22}px)"><span>${Math.round(nice*f)}</span></div>`).join("")}
      ${d.days.map((x,i)=>`<div class="col${i===d.days.length-1?" today":""}" tabindex="0"><span class="tip" style="${i<5?"left:0;transform:none":i>24?"left:auto;right:0;transform:none":""}">${fmtDay(x.day)}: ${plural(x.visitors,"vizitor","vizitorë")} · ${x.views} hapje</span><div class="bar2" style="height:${(x.visitors/nice*100).toFixed(1)}%"></div>${i%5===4||i===d.days.length-1?`<span class="lbl">${i===d.days.length-1?"Sot":fmtDay(x.day)}</span>`:""}</div>`).join("")}
    </div></section>
  <section class="panel"><h2>AI${d.aiFailed.length?`<span class="count-badge">${d.aiFailed.length}</span>`:""}</h2>
    ${!st.aiEnabled?`<p class="hint" style="margin:0">Nuk është aktivizuar. Shtoni <b>GEMINI_API_KEY</b> te Render → Environment.</p>`
    :`<p class="hint">Modeli: <b>${esc(st.aiModel)}</b> · Sot: <b>${st.ai}</b> nga ${st.aiLimit} sete${st.aiPending?` · <b>${st.aiPending}</b> në radhë`:""} · Kufiri mujor: ${st.freeAi} falas / ${st.premiumAi} Premium · Google: ${st.google?"aktiv":"jo aktiv"}</p>
      ${d.aiFailed.length?d.aiFailed.map(f=>`<div class="task"><div class="body"><b>${esc(f.title)}</b><small>Dështoi ${esc(ago(f.createdAt))} · ${esc(f.error||"")}</small></div><div class="acts"><button class="btn btn-ghost btn-sm" data-open-r="set:${esc(f.id)}">Shiko</button><button class="btn btn-primary btn-sm" data-retry="${esc(f.id)}">Provo sërish</button></div></div>`).join(""):`<p style="margin:0;color:var(--good);font-weight:700">Çdo gjë në rregull ✓</p>`}`}
  </section>
  <div class="admin-cols">
    <section class="panel"><h2>Raportimet${d.reports.length?`<span class="count-badge">${d.reports.length}</span>`:""}</h2><p class="hint">Përmbajtje e raportuar nga përdoruesit.</p>
      ${d.reports.length?d.reports.map(r=>`<div class="task"><div class="body"><b>${esc(r.itemTitle||"(nuk ekziston më)")}</b><small>${r.type==="set"?"Set":"Material"} · ${esc(ago(r.createdAt))}${r.reason?` · “${esc(r.reason)}”`:""}</small></div>
        <div class="acts">${r.itemTitle?`<button class="btn btn-ghost btn-sm" data-open-r="${esc(r.type)}:${esc(r.itemId)}">Shiko</button><button class="btn btn-danger btn-sm" data-del-r="${esc(r.type)}:${esc(r.itemId)}">Fshi përmbajtjen</button>`:""}<button class="btn btn-ghost btn-sm" data-dismiss="${esc(r.id)}">Hiq raportin</button></div></div>`).join(""):`<p style="margin:0;color:var(--good);font-weight:700">Asnjë raportim ✓</p>`}</section>
    <section class="panel"><h2>Përmbajtja më e re</h2><p class="hint">Si admin mund të fshini çdo gjë.</p>
      ${[...sets.map(s=>({t:"set",x:s})),...materials.map(m=>({t:"material",x:m}))].sort((a,b)=>(b.x.createdAt||0)-(a.x.createdAt||0)).slice(0,10).map(({t,x})=>`<div class="task"><div class="body"><b>${esc(x.title)}</b><small>${t==="set"?(x.purpose==="games"?"Lojëra":"Set"):"Material"} · ${esc(levelLabel(x))} · ${esc(t==="set"?x.author:(x.uploader||"Anonim"))} · ${esc(ago(x.createdAt))}</small></div>
        <div class="acts"><button class="btn btn-ghost btn-sm" data-open-r="${t}:${esc(x.id)}">Shiko</button><button class="btn btn-danger btn-sm" data-del-r="${t}:${esc(x.id)}">Fshi</button></div></div>`).join("")||`<p style="margin:0;color:var(--muted)">Ende nuk ka përmbajtje.</p>`}</section>
  </div>
  <section class="panel"><h2>Llogaritë (${d.users.length})</h2><p class="hint">Bëni dikë admin ose Premium (p.sh. pasi ka paguar), ose fshini llogarinë.</p>
    ${d.users.length?`<div class="table-wrap"><table class="users"><thead><tr><th>Emri</th><th>Email</th><th>Lloji</th><th>Shkolla / Universiteti</th><th>XP</th><th>Sete</th><th>Hyrja e fundit</th><th></th></tr></thead><tbody>
      ${d.users.map(u=>`<tr><td><b>${esc(u.name)}</b> ${u.isAdmin?'<span class="badge-plan admin">ADMIN</span>':u.plan==="premium"?'<span class="badge-plan premium">PREMIUM</span>':""}</td><td>${esc(u.email)}</td><td>${{uni:"Student",school:"Nxënës",teacher:"Mësues"}[u.kind]||"–"}</td><td>${esc(u.institution||"–")}</td><td class="num">${u.xp}</td><td class="num">${u.sets}</td><td>${esc(ago(u.lastLogin))}</td>
        <td>${u.id===me.id?'<span class="opt">Ju</span>':`<div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn btn-ghost btn-sm" data-plan="${esc(u.id)}" data-v="${u.plan==="premium"?"free":"premium"}">${u.plan==="premium"?"Hiq Premium":"Bëje Premium"}</button><button class="btn btn-ghost btn-sm" data-role="${esc(u.id)}" data-make="${u.isAdmin?0:1}">${u.isAdmin?"Hiq adminin":"Bëje admin"}</button><button class="btn btn-danger btn-sm" data-deluser="${esc(u.id)}" data-name="${esc(u.name)}">Fshi</button></div>`}</td></tr>`).join("")}
    </tbody></table></div>`:`<p style="margin:0;color:var(--muted)">Ende nuk është regjistruar askush.</p>`}</section>`;
  const re=()=>{adminData=null;renderAdmin()};
  $("#a-refresh").onclick=re;
  $$("[data-retry]").forEach(b=>b.onclick=async()=>{b.disabled=true;try{await api("POST","/api/sets/"+encodeURIComponent(b.dataset.retry)+"/retry");toast("U fut në radhë");await refresh(true);re()}catch(e){b.disabled=false;toast(e.message)}});
  $$("[data-open-r]").forEach(b=>b.onclick=()=>{const [t,id]=b.dataset.openR.split(":");go(t==="set"?"set":"material",{id})});
  $$("[data-del-r]").forEach(b=>b.onclick=async()=>{const [t,id]=b.dataset.delR.split(":");if(b.dataset.sure!=="1"){b.dataset.sure="1";b.textContent="Kliko sërish për ta fshirë";return}
    try{await api("DELETE",(t==="set"?"/api/sets/":"/api/materials/")+encodeURIComponent(id));toast("U fshi");await refresh(true);re()}catch(e){toast(e.message)}});
  $$("[data-dismiss]").forEach(b=>b.onclick=async()=>{try{await api("DELETE","/api/admin/reports/"+encodeURIComponent(b.dataset.dismiss));re()}catch(e){toast(e.message)}});
  $$("[data-role]").forEach(b=>b.onclick=async()=>{try{await api("POST","/api/admin/users/"+encodeURIComponent(b.dataset.role),{isAdmin:b.dataset.make==="1"});toast("U ruajt");re()}catch(e){toast(e.message)}});
  $$("[data-plan]").forEach(b=>b.onclick=async()=>{try{await api("POST","/api/admin/users/"+encodeURIComponent(b.dataset.plan),{plan:b.dataset.v});toast(b.dataset.v==="premium"?"Tani është Premium":"U kthye në Falas");re()}catch(e){toast(e.message)}});
  $$("[data-deluser]").forEach(b=>b.onclick=async()=>{if(b.dataset.sure!=="1"){b.dataset.sure="1";b.textContent="Kliko sërish";return}
    try{await api("DELETE","/api/admin/users/"+encodeURIComponent(b.dataset.deluser));toast(`Llogaria e ${b.dataset.name} u fshi`);re()}catch(e){toast(e.message)}});
}
async function loadAdmin(){try{adminData=await api("GET","/api/admin/overview");if(view.name==="admin")renderAdmin()}catch(e){if(view.name==="admin")app.innerHTML=emptyBox("Paneli nuk u hap",esc(e.message))}}

/* ---------- shpërndarja e faqeve ---------- */
function render(){
  stopTimers();clearTimeout(pollT);
  if(dbState==="loading"){renderNav();app.className="";app.innerHTML=`<div class="gen" style="background:none">${sm()}<p style="margin-top:14px">Duke hapur Sinapsën…</p></div>`;return}
  if(me&&!me.profileDone&&!["profile","about"].includes(view.name)){view={name:"profile",params:new URLSearchParams("ri=1")};try{history.replaceState(null,"","#/profili?ri=1")}catch(e){}}
  if(view.name==="root"&&me){view={name:"home",params:new URLSearchParams()};try{history.replaceState(null,"","#/kreu")}catch(e){}}
  if(view.name==="auth"&&me){view={name:"home",params:new URLSearchParams()};try{history.replaceState(null,"","#/kreu")}catch(e){}}
  if(!me&&!OPEN_VIEWS.includes(view.name)&&!["set","material"].includes(view.name)){view={name:"auth",tab:"login",params:new URLSearchParams()};try{history.replaceState(null,"","#/hyr")}catch(e){}}
  renderNav();app.className="";
  const n=view.name;
  const R={root:renderLanding,auth:renderLanding,home:renderHome,profile:renderProfile,materials:renderMaterials,upload:renderUpload,material:renderMaterial,
    sets:renderSets,games:renderGames,aicreate:renderAiCreate,manual:renderManual,edit:renderManual,set:renderSet,groups:renderGroups,about:renderAbout,
    achievements:renderAchievements,premium:renderPremium,admin:renderAdmin,mine:renderMine,search:renderSearch};
  (R[n]||renderLanding)();
}

/* ---------- ngarkimi i të dhënave ---------- */
let lastStamp="";
async function refresh(force){
  try{
    const r=await api("GET","/api/all");
    const prevMe=me?JSON.stringify(Object.assign({},me,{game:null,ai:null})):"",prevId=me&&me.id;
    me=r.me;aiOn=!!r.ai;googleOn=!!r.google;if(r.faculties&&r.faculties.length)FACULTIES=r.faculties;if(r.limits)LIMITS=r.limits;
    if((me&&me.id)!==prevId){P=null;LB=null}
    const meChanged=(me?JSON.stringify(Object.assign({},me,{game:null,ai:null})):"")!==prevMe;
    const stamp=JSON.stringify([r.sets.map(s=>[s.id,s.status,s.updatedAt||s.createdAt]),r.materials.map(m=>m.id)]);
    const first=dbState!=="ready";sets=r.sets;materials=r.materials;dbState="ready";
    if(force)lastStamp="";
    const v=view.name;
    if(first)render();
    else if(meChanged&&!["set","upload","aicreate","manual","edit","profile"].includes(v))render();
    else if(["home","materials","sets","games","search","mine"].includes(v)&&stamp!==lastStamp)render();
    else if(v==="set"&&!sets.some(x=>x.id===view.id))render();
    else if(v==="material"&&!materials.some(x=>x.id===view.id))render();
    else if(meChanged)renderNav();
    lastStamp=stamp;
  }catch(e){if(dbState!=="ready"){dbState="offline";sets=[];materials=[];render()}}
}

/* ---------- nisja ---------- */
view=parseHash();
renderFoot();render();refresh();
try{if(!sessionStorage.getItem("sin_counted")){sessionStorage.setItem("sin_counted","1");api("POST","/api/visit",{vid:visitorId()}).catch(()=>{})}}catch(e){api("POST","/api/visit",{vid:visitorId()}).catch(()=>{})}
setInterval(()=>{if(!document.hidden)refresh()},20000);
})();
