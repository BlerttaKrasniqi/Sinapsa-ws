// Sinapsa – serveri. Nuk kërkon instalime shtesë. Nisni me:  node server.js
// Pastaj hapni http://localhost:3000 në shfletues.
// Gjithçka ruhet te dosja data/ (data/db.json dhe data/uploads/).
//
// Variablat (Render → Environment):
//   ADMIN_EMAILS          email-et e adminëve, të ndara me presje
//   GEMINI_API_KEY        çelësi i AI-së (ose ANTHROPIC_API_KEY)
//   GOOGLE_CLIENT_ID      hyrja me Google (opsionale)
//   GOOGLE_CLIENT_SECRET  hyrja me Google (opsionale)
//   PUBLIC_URL            adresa e faqes, p.sh. https://sinapsa.al (për hyrjen me Google)
//   FREE_AI_PER_MONTH     sa sete me AI në muaj për llogaritë falas (parazgjedhur 5)
//   PREMIUM_AI_PER_MONTH  sa sete me AI në muaj për Premium (parazgjedhur 150)
//   AI_DAILY_LIMIT        kufiri i përgjithshëm ditor i AI-së (parazgjedhur 300)

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const ai = require("./ai");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const DB_FILE = path.join(DATA_DIR, "db.json");
const MAX_UPLOAD = 50 * 1024 * 1024;
const MAX_JSON = 4 * 1024 * 1024;
const SESSION_DAYS = 60;
const TZ = "Europe/Belgrade";
const AI_DAILY_LIMIT = +process.env.AI_DAILY_LIMIT || 300;
const FREE_AI = +process.env.FREE_AI_PER_MONTH || 5;
const PREMIUM_AI = +process.env.PREMIUM_AI_PER_MONTH || 150;
const ADMIN_EMAILS = String(process.env.ADMIN_EMAILS || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
const GOOGLE_ID = process.env.GOOGLE_CLIENT_ID || "", GOOGLE_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const MIN_AGE = 13; // fëmijët nën 13 vjeç vijnë në fazën 2, me pëlqimin e prindit

const FACULTIES = [
  "Mjekësi", "Stomatologji", "Farmaci", "Infermieri dhe Shkenca Shëndetësore", "Juridik", "Ekonomik",
  "Shkenca Politike", "Administratë Publike", "Filologjik", "Gjuhë të Huaja", "Filozofik", "Psikologji", "Sociologji",
  "Histori", "Gjeografi", "Edukim", "Matematikë", "Fizikë", "Kimi", "Biologji", "Shkenca Kompjuterike",
  "Inxhinieri Elektrike dhe Kompjuterike", "Inxhinieri Mekanike", "Ndërtimtari", "Arkitekturë",
  "Inxhinieri Kimike dhe Teknologjike", "Gjeoshkenca dhe Miniera", "Bujqësi dhe Veterinari", "Shkenca Ushqimore",
  "Shkenca Sportive", "Arte", "Muzikë", "Gazetari dhe Komunikim", "Turizëm", "Siguri dhe Studime Mbrojtëse", "Tjetër",
];
const TYPES = {
  pdf: "application/pdf", doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  odt: "application/vnd.oasis.opendocument.text", rtf: "application/rtf",
  ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odp: "application/vnd.oasis.opendocument.presentation", xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ods: "application/vnd.oasis.opendocument.spreadsheet",
  csv: "text/csv; charset=utf-8", txt: "text/plain; charset=utf-8",
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp",
  zip: "application/zip", rar: "application/vnd.rar", "7z": "application/x-7z-compressed",
};
const INLINE = new Set(["pdf", "png", "jpg", "jpeg", "gif", "webp", "txt"]);
const IMG = new Set(["png", "jpg", "jpeg", "gif", "webp"]);
const ASSET_RE = /^[A-Za-z0-9_-]+\.([a-z0-9]+)$/;
const STATIC_TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml", ".ico": "image/x-icon", ".png": "image/png", ".jpg": "image/jpeg", ".mp4": "video/mp4", ".webp": "image/webp",
};
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ---------- ruajtja ----------
const newId = () => crypto.randomBytes(9).toString("base64url");
const sha = s => crypto.createHash("sha256").update(String(s)).digest("hex");
function loadDb() {
  let d;
  try { d = JSON.parse(fs.readFileSync(DB_FILE, "utf8")); } catch { d = { sets: [], materials: [] }; }
  for (const k of ["sets", "materials", "users", "reports"]) d[k] = d[k] || [];
  d.sessions = d.sessions || {}; d.stats = d.stats || { days: {} }; d.stats.ai = d.stats.ai || {};
  // materialet e vjetra (një skedar) → listë skedarësh
  for (const m of d.materials) {
    if (!m.files && m.asset) m.files = [{ asset: m.asset, name: m.fileName || m.asset, size: m.size || 0, type: "" }];
    m.files = m.files || []; m.level = m.level || "uni";
    delete m.aiStatus; delete m.aiError; delete m.aiTries;
  }
  for (const s of d.sets) { s.level = s.level || "uni"; s.status = s.status || "ready"; s.purpose = s.purpose || (s.ai ? "cards" : "manual"); }
  const oldUploads = path.join(ROOT, "uploads");
  if (fs.existsSync(oldUploads)) for (const f of fs.readdirSync(oldUploads)) { try { fs.renameSync(path.join(oldUploads, f), path.join(UPLOAD_DIR, f)); } catch {} }
  return d;
}
let db = loadDb(), dirty = false;
function saveNow() { const tmp = DB_FILE + ".tmp"; fs.writeFileSync(tmp, JSON.stringify(db)); fs.renameSync(tmp, DB_FILE); dirty = false; }
const saveDb = saveNow;
saveNow();
setInterval(() => { if (dirty) saveNow(); }, 15000);
process.on("SIGTERM", () => { try { if (dirty) saveNow(); } finally { process.exit(0); } });
process.on("SIGINT", () => { try { if (dirty) saveNow(); } finally { process.exit(0); } });

// ---------- ndihmëse ----------
function send(res, status, obj, headers) {
  res.writeHead(status, Object.assign({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }, headers || {}));
  res.end(JSON.stringify(obj));
}
function redirect(res, to, headers) { res.writeHead(302, Object.assign({ Location: to, "Cache-Control": "no-store" }, headers || {})); res.end(); }
const fail = (status, message) => Object.assign(new Error(message), { status });
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on("data", c => { size += c.length; if (size > limit) { reject(fail(413, "Kërkesa është shumë e madhe.")); req.destroy(); return; } chunks.push(c); });
    req.on("end", () => resolve(Buffer.concat(chunks))); req.on("error", reject);
  });
}
async function readJson(req) {
  try { return JSON.parse((await readBody(req, MAX_JSON)).toString("utf8") || "{}"); }
  catch (e) { if (e.status) throw e; throw fail(400, "Kërkesë e pavlefshme."); }
}
function streamToFile(req, dest, limit) {
  return new Promise((resolve, reject) => {
    const tmp = dest + ".part"; const out = fs.createWriteStream(tmp); let size = 0, done = false;
    const abort = e => { if (done) return; done = true; out.destroy(); fs.unlink(tmp, () => {}); reject(e); };
    req.on("data", c => { size += c.length; if (size > limit) { abort(fail(413, "Skedari është shumë i madh. Kufiri është 50 MB.")); req.unpipe(out); req.resume(); } });
    req.on("error", abort); req.on("aborted", () => abort(fail(400, "Ngarkimi u ndërpre. Provoni përsëri.")));
    out.on("error", abort);
    out.on("finish", () => { if (done) return; done = true; if (!size) { fs.unlink(tmp, () => {}); return reject(fail(400, "Skedari është bosh.")); } fs.rename(tmp, dest, e => e ? reject(e) : resolve(size)); });
    req.pipe(out);
  });
}
const str = (v, max) => String(v == null ? "" : v).trim().slice(0, max);
const int = (v, lo, hi) => { const n = parseInt(v, 10); return Number.isFinite(n) && n >= lo && n <= hi ? n : null; };
const faculty = v => FACULTIES.includes(v) ? v : null;
const extOf = a => (ASSET_RE.exec(a || "") || [])[1];
const validAsset = a => { const e = extOf(a); return !!(e && TYPES[e]) && fs.existsSync(path.join(UPLOAD_DIR, a)); };
function cleanFile(f) {
  if (!f || typeof f !== "object") return null;
  const asset = str(f.asset, 80); if (!validAsset(asset)) return null;
  return { asset, name: str(f.name, 200) || asset, type: str(f.type, 60), size: fs.statSync(path.join(UPLOAD_DIR, asset)).size };
}
// Niveli: universitet (fakultet + vit) ose shkollë (klasa 1–12)
function cleanLevel(b) {
  const level = b.level === "school" ? "school" : "uni";
  if (level === "uni") { const fac = faculty(b.faculty); if (!fac) throw fail(400, "Ju lutemi zgjidhni fakultetin."); return { level, faculty: fac, grade: null }; }
  const grade = int(b.grade, 1, 12); if (!grade) throw fail(400, "Ju lutemi zgjidhni klasën."); return { level, faculty: null, grade };
}
function cleanSetBody(b, user) {
  const title = str(b.title, 120); if (!title) throw fail(400, "Ju lutemi jepini setit një titull.");
  const cards = (Array.isArray(b.cards) ? b.cards : []).slice(0, 1000).map(c => {
    const o = { term: str(c && c.term, 2000), def: str(c && c.def, 5000) };
    const img = cleanFile(c && c.img); if (img) o.img = img; return o;
  }).filter(c => c.term || c.def || c.img);
  if (!cards.length) throw fail(400, "Shtoni të paktën një kartë.");
  const files = (Array.isArray(b.files) ? b.files : []).map(cleanFile).filter(Boolean).slice(0, 50);
  return Object.assign({ title, author: str(b.author, 60) || user.name, subject: str(b.subject, 60), institution: str(b.institution, 120),
    description: str(b.description, 500), cards, files }, cleanLevel(b));
}
function assetsOf(item) {
  return [...(item.files || []).map(f => f.asset), ...(item.cards || []).map(c => c.img && c.img.asset), item.asset].filter(Boolean);
}
function usedAssets() {
  return new Set([...db.sets.flatMap(assetsOf), ...db.materials.flatMap(assetsOf), ...db.users.map(u => u.avatar && u.avatar.asset).filter(Boolean)]);
}
function removeUnusedAssets(ids) { const used = usedAssets(); for (const id of ids) if (!used.has(id)) fs.unlink(path.join(UPLOAD_DIR, id), () => {}); }
function contentDisposition(kind, name) {
  const ascii = name.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}
function serveFile(res, file, headers) {
  fs.stat(file, (e, st) => {
    if (e || !st.isFile()) { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }); return res.end("Nuk u gjet"); }
    res.writeHead(200, Object.assign({ "Content-Length": st.size }, headers)); fs.createReadStream(file).pipe(res);
  });
}
const byNewest = arr => [...arr].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
const dayKey = (t = Date.now()) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(t);
const monthKey = () => dayKey().slice(0, 7);
function weekKey(t = Date.now()) { const d = new Date(dayKey(t) + "T00:00:00Z"); const day = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - day); return d.toISOString().slice(0, 10); }
const publicUrl = req => (process.env.PUBLIC_URL || `${String(req.headers["x-forwarded-proto"] || "http").split(",")[0]}://${req.headers.host}`).replace(/\/+$/, "");

// ---------- llogaritë ----------
function hashPassword(pw, salt) { return crypto.scryptSync(pw, salt, 64).toString("hex"); }
function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || "").split(";")) { const i = part.indexOf("="); if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); }
  return out;
}
function currentUser(req) {
  const tok = parseCookies(req).sid; if (!tok) return null;
  const s = db.sessions[sha(tok)]; if (!s || s.exp < Date.now()) return null;
  return db.users.find(u => u.id === s.uid) || null;
}
const secureFlag = req => String(req.headers["x-forwarded-proto"] || "").includes("https") ? "; Secure" : "";
const cookie = (req, name, val, maxAge) => `${name}=${val ? encodeURIComponent(val) : ""}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secureFlag(req)}`;
function startSession(req, user) {
  const token = crypto.randomBytes(32).toString("base64url");
  db.sessions[sha(token)] = { uid: user.id, exp: Date.now() + SESSION_DAYS * 86400000 };
  user.lastLogin = Date.now();
  return cookie(req, "sid", token, SESSION_DAYS * 86400);
}
const isAdmin = u => !!(u && u.role === "admin");
const isPremium = u => !!(u && (u.plan === "premium" || isAdmin(u)));
function applyAdminEmail(u) { if (ADMIN_EMAILS.includes(u.email)) u.role = "admin"; }
const profileDone = u => !!(u.age && u.kind && u.institution && (u.kind === "teacher" || (u.kind === "uni" ? u.year : u.grade)));
function aiQuota(u) {
  const m = monthKey(); if (!u.aiUsage || u.aiUsage.month !== m) u.aiUsage = { month: m, n: 0 };
  const limit = isAdmin(u) ? 9999 : isPremium(u) ? PREMIUM_AI : FREE_AI;
  return { used: u.aiUsage.n, limit, left: Math.max(0, limit - u.aiUsage.n) };
}
function publicUser(u) {
  if (!u) return null;
  return { id: u.id, name: u.name, email: u.email, isAdmin: isAdmin(u), plan: isPremium(u) ? "premium" : "free",
    age: u.age || null, kind: u.kind || null, institution: u.institution || "", faculty: u.faculty || "", year: u.year || null, grade: u.grade || null,
    avatar: u.avatar || null, google: !!u.googleId, hasPassword: !!u.pass, profileDone: profileDone(u), ai: aiQuota(u), game: u.game || null };
}
// Emri publik: emri + inicial i mbiemrit
const shortName = n => { const p = String(n || "").trim().split(/\s+/); return p.length > 1 ? `${p[0]} ${p[p.length - 1][0]}.` : (p[0] || "Student"); };
function claimKeys(user, keys) {
  if (!keys || typeof keys !== "object") return;
  for (const [id, key] of Object.entries(keys).slice(0, 500)) {
    const item = db.sets.find(s => s.id === id) || db.materials.find(m => m.id === id);
    if (item && !item.ownerId && item.ownerKeyHash && item.ownerKeyHash === sha(key)) item.ownerId = user.id;
  }
}
const tries = new Map();
function limited(ip, max) { const now = Date.now(), t = (tries.get(ip) || []).filter(x => now - x < 15 * 60000); tries.set(ip, t); return t.length >= max; }
const clientIp = req => String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
function cleanProfile(b, u) {
  if (b.name !== undefined) { const n = str(b.name, 60); if (!n) throw fail(400, "Shkruani emrin tuaj."); u.name = n; }
  if (b.age !== undefined) {
    const a = int(b.age, 5, 99); if (!a) throw fail(400, "Shkruani moshën tuaj.");
    if (a < MIN_AGE) throw fail(400, `Llogaritë për fëmijët nën ${MIN_AGE} vjeç do të hapen së shpejti me pëlqimin e prindit.`);
    u.age = a;
  }
  if (b.kind !== undefined) { if (!["uni", "school", "teacher"].includes(b.kind)) throw fail(400, "Zgjidhni: student, nxënës apo mësues."); u.kind = b.kind; }
  if (b.institution !== undefined) { const i = str(b.institution, 120); if (!i) throw fail(400, u.kind === "uni" ? "Shkruani universitetin." : "Shkruani shkollën."); u.institution = i; }
  if (u.kind === "uni") {
    if (b.faculty !== undefined) u.faculty = faculty(b.faculty) || "";
    if (b.year !== undefined) { const y = int(b.year, 1, 8); if (!y) throw fail(400, "Zgjidhni vitin e studimeve."); u.year = y; }
    u.grade = null;
  } else if (u.kind === "school") {
    if (b.grade !== undefined) { const g = int(b.grade, 1, 12); if (!g) throw fail(400, "Zgjidhni klasën."); u.grade = g; }
    u.year = null; u.faculty = "";
  } else if (u.kind === "teacher") { u.year = null; u.grade = null; if (b.faculty !== undefined) u.faculty = faculty(b.faculty) || ""; }
  if (b.avatar !== undefined) {
    if (b.avatar && b.avatar.preset && /^[a-z0-9-]{1,20}$/.test(b.avatar.preset)) u.avatar = { preset: b.avatar.preset };
    else if (b.avatar && b.avatar.asset && validAsset(b.avatar.asset) && IMG.has(extOf(b.avatar.asset))) { const old = u.avatar && u.avatar.asset; u.avatar = { asset: b.avatar.asset }; if (old && old !== b.avatar.asset) setTimeout(() => removeUnusedAssets([old]), 100); }
    else if (b.avatar === null) u.avatar = null;
  }
}

// ---------- pronësia ----------
function canManage(req, user, item) {
  if (isAdmin(user)) return true;
  if (user && item.ownerId && item.ownerId === user.id) return true;
  const key = req.headers["x-owner-key"]; return !!(key && item.ownerKeyHash && item.ownerKeyHash === sha(key));
}
function publicItem(item, user) {
  const { ownerId, ownerKeyHash, aiTries, ...rest } = item;
  rest.mine = !!(user && ownerId && ownerId === user.id);
  const owner = ownerId && db.users.find(u => u.id === ownerId);
  if (owner) rest.authorAvatar = owner.avatar || null;
  return rest;
}
const needUser = user => { if (!user) throw fail(401, "Hyni ose regjistrohuni për ta përdorur këtë."); if (!profileDone(user)) throw fail(428, "Plotësoni profilin tuaj për të vazhduar."); };

// ---------- vizitorët ----------
const online = new Map();
function seen(req) { const v = str(req.headers["x-visitor"], 64); if (v) online.set(sha(v).slice(0, 16), Date.now()); }
function countVisit(vid) { const k = dayKey(); const day = db.stats.days[k] || (db.stats.days[k] = { views: 0, v: {} }); day.views++; if (vid) day.v[sha(vid).slice(0, 16)] = 1; dirty = true; }
function pruneStats() {
  const keep = new Set(Array.from({ length: 90 }, (_, i) => dayKey(Date.now() - i * 86400000)));
  for (const k of Object.keys(db.stats.days)) if (!keep.has(k)) delete db.stats.days[k];
  for (const [h, s] of Object.entries(db.sessions)) if (s.exp < Date.now()) delete db.sessions[h];
  const now = Date.now(); for (const [k, t] of online) if (now - t > 10 * 60000) online.delete(k);
}
function cleanOrphans() {
  const used = usedAssets();
  for (const f of fs.readdirSync(UPLOAD_DIR)) { if (used.has(f)) continue; const p = path.join(UPLOAD_DIR, f); try { if (Date.now() - fs.statSync(p).mtimeMs > 86400000) fs.unlinkSync(p); } catch {} }
}
setInterval(() => { pruneStats(); cleanOrphans(); dirty = true; }, 6 * 3600000);

// ---------- AI: krijimi i seteve në prapavijë ----------
const aiQueue = []; let aiWorking = false;
const sleep = ms => new Promise(r => setTimeout(r, ms));
function enqueueAi(id) { if (!aiQueue.includes(id)) aiQueue.push(id); pumpAi(); }
async function pumpAi() {
  if (aiWorking || !ai.enabled) return; aiWorking = true;
  try {
    while (aiQueue.length) {
      const id = aiQueue[0], set = db.sets.find(x => x.id === id);
      if (!set || set.status !== "pending") { aiQueue.shift(); continue; }
      const dk = dayKey(); if ((db.stats.ai[dk] || 0) >= AI_DAILY_LIMIT) break;
      try {
        const files = set.files.map(f => ({ file: path.join(UPLOAD_DIR, f.asset), ext: extOf(f.asset), name: f.name }));
        const out = await ai.generateSet(files, { level: set.level, grade: set.grade, language: set.language || "sq" });
        db.stats.ai[dk] = (db.stats.ai[dk] || 0) + 1;
        const still = db.sets.find(x => x.id === id);
        if (still && still.status === "pending") {
          Object.assign(still, { cards: out.cards, quiz: out.quiz, fills: out.fills, status: "ready", readyAt: Date.now() });
          if (!still.titleSet) still.title = out.title || still.title;
          if (!still.subject) still.subject = out.subject;
          if (!still.description) still.description = out.description;
          delete still.error; delete still.aiTries;
        }
        aiQueue.shift();
      } catch (e) {
        const again = (e.transient || e.name === "TimeoutError" || e.name === "TypeError") && (set.aiTries || 0) < 3;
        if (again) { set.aiTries = (set.aiTries || 0) + 1; aiQueue.shift(); aiQueue.push(id); saveDb(); await sleep(45000); continue; }
        set.status = "failed"; set.error = e.message || "Seti nuk u krijua dot.";
        const owner = db.users.find(u => u.id === set.ownerId); if (owner && owner.aiUsage && owner.aiUsage.n > 0) owner.aiUsage.n--; // nuk llogaritet
        console.error("AI:", set.title, e.message); aiQueue.shift();
      }
      saveDb();
    }
  } finally { aiWorking = false; }
}
function requeuePending() { for (const s of db.sets) if (s.status === "pending") enqueueAi(s.id); }
setTimeout(requeuePending, 3000); setInterval(requeuePending, 10 * 60000);

// ---------- Google ----------
async function googleCallback(req, res, url) {
  const st = parseCookies(req).gst, q = url.searchParams;
  const clear = cookie(req, "gst", "", 0);
  if (!q.get("code") || !st || q.get("state") !== st) return redirect(res, "/#/hyr?gabim=google", { "Set-Cookie": clear });
  const tr = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code: q.get("code"), client_id: GOOGLE_ID, client_secret: GOOGLE_SECRET, redirect_uri: publicUrl(req) + "/api/auth/google/callback", grant_type: "authorization_code" }),
    signal: AbortSignal.timeout(15000),
  });
  const tj = await tr.json().catch(() => ({}));
  if (!tr.ok || !tj.access_token) { console.error("Google token:", tr.status, tj.error, tj.error_description); return redirect(res, "/#/hyr?gabim=google", { "Set-Cookie": clear }); }
  const ur = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: "Bearer " + tj.access_token }, signal: AbortSignal.timeout(15000) });
  const g = await ur.json().catch(() => ({}));
  if (!g.sub || !g.email || g.email_verified === false) return redirect(res, "/#/hyr?gabim=google", { "Set-Cookie": clear });
  const email = String(g.email).toLowerCase();
  let u = db.users.find(x => x.googleId === g.sub) || db.users.find(x => x.email === email);
  if (!u) { u = { id: newId(), name: str(g.name, 60) || email.split("@")[0], email, role: "user", plan: "free", createdAt: Date.now() }; db.users.push(u); }
  u.googleId = g.sub; applyAdminEmail(u);
  const c = startSession(req, u); saveDb();
  return redirect(res, profileDone(u) ? "/#/kreu" : "/#/profili?ri=1", { "Set-Cookie": [clear, c] });
}

// ---------- paneli i adminit ----------
function adminOverview() {
  const days = [];
  for (let i = 29; i >= 0; i--) { const k = dayKey(Date.now() - i * 86400000), d = db.stats.days[k]; days.push({ day: k, visitors: d ? Object.keys(d.v).length : 0, views: d ? d.views : 0 }); }
  const uniq = n => { const s = new Set(); for (const d of days.slice(-n)) { const x = db.stats.days[d.day]; if (x) Object.keys(x.v).forEach(v => s.add(v)); } return s.size; };
  let bytes = 0, files = 0;
  for (const f of fs.readdirSync(UPLOAD_DIR)) { try { bytes += fs.statSync(path.join(UPLOAD_DIR, f)).size; files++; } catch {} }
  const now = Date.now();
  return {
    stats: { today: days[29].visitors, viewsToday: days[29].views, week: uniq(7), month: uniq(30), online: [...online.values()].filter(t => now - t < 5 * 60000).length,
      users: db.users.length, premium: db.users.filter(isPremium).length, ai: db.stats.ai[dayKey()] || 0, aiLimit: AI_DAILY_LIMIT, aiEnabled: ai.enabled, aiModel: ai.enabled ? ai.model : "",
      aiPending: db.sets.filter(x => x.status === "pending").length, sets: db.sets.length, materials: db.materials.length, bytes, files,
      google: !!(GOOGLE_ID && GOOGLE_SECRET), freeAi: FREE_AI, premiumAi: PREMIUM_AI },
    days,
    aiFailed: byNewest(db.sets.filter(x => x.status === "failed")).map(x => ({ id: x.id, title: x.title, error: x.error, createdAt: x.createdAt })),
    reports: byNewest(db.reports).map(r => { const item = r.type === "set" ? db.sets.find(s => s.id === r.itemId) : db.materials.find(m => m.id === r.itemId); return Object.assign({}, r, { itemTitle: item ? item.title : null }); }),
    users: byNewest(db.users).map(u => ({ id: u.id, name: u.name, email: u.email, isAdmin: isAdmin(u), plan: isPremium(u) ? "premium" : "free", kind: u.kind || "", institution: u.institution || "",
      createdAt: u.createdAt, lastLogin: u.lastLogin, sets: db.sets.filter(s => s.ownerId === u.id).length, materials: db.materials.filter(m => m.ownerId === u.id).length, xp: (u.game && u.game.xp) || 0 })),
  };
}

// ---------- rrugët ----------
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://x");
    const p = decodeURIComponent(url.pathname);
    const user = (p.startsWith("/api/") || p.startsWith("/uploads/")) ? currentUser(req) : null;

    if (p === "/api/all" && req.method === "GET") {
      seen(req);
      return send(res, 200, {
        sets: byNewest(db.sets).map(s => publicItem(s, user)), materials: byNewest(db.materials).map(m => publicItem(m, user)),
        me: publicUser(user), ai: ai.enabled, google: !!(GOOGLE_ID && GOOGLE_SECRET), faculties: FACULTIES, limits: { free: FREE_AI, premium: PREMIUM_AI },
      });
    }
    if (p === "/api/visit" && req.method === "POST") { const b = await readJson(req); countVisit(str(b.vid, 64)); seen(req); return send(res, 200, { ok: true }); }

    // --- llogaritë ---
    if (p === "/api/auth/signup" && req.method === "POST") {
      const ip = clientIp(req); if (limited(ip, 10)) throw fail(429, "Shumë përpjekje. Provoni pas 15 minutash.");
      tries.get(ip).push(Date.now());
      const b = await readJson(req);
      const email = str(b.email, 120).toLowerCase(), pw = String(b.password || "");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw fail(400, "Shkruani një email të vlefshëm.");
      if (pw.length < 8) throw fail(400, "Fjalëkalimi duhet të ketë të paktën 8 shkronja.");
      if (db.users.some(u => u.email === email)) throw fail(409, "Ky email është i regjistruar tashmë. Hyni në llogari.");
      const salt = crypto.randomBytes(16).toString("hex");
      const u = { id: newId(), email, salt, pass: hashPassword(pw, salt), role: "user", plan: "free", createdAt: Date.now() };
      cleanProfile(Object.assign({ name: b.name, age: b.age, kind: b.kind }, b), u);
      if (!profileDone(u)) throw fail(400, "Plotësoni të gjitha fushat.");
      applyAdminEmail(u); db.users.push(u); claimKeys(u, b.keys);
      const c = startSession(req, u); saveDb();
      return send(res, 201, { me: publicUser(u) }, { "Set-Cookie": c });
    }
    if (p === "/api/auth/login" && req.method === "POST") {
      const ip = clientIp(req); if (limited(ip, 10)) throw fail(429, "Shumë përpjekje. Provoni pas 15 minutash.");
      const b = await readJson(req);
      const email = str(b.email, 120).toLowerCase(), pw = String(b.password || "");
      const u = db.users.find(x => x.email === email);
      const ok = u && u.pass && crypto.timingSafeEqual(Buffer.from(hashPassword(pw, u.salt), "hex"), Buffer.from(u.pass, "hex"));
      if (!ok) { tries.get(ip).push(Date.now()); throw fail(401, u && !u.pass ? "Kjo llogari hyn me Google. Shtypni “Vazhdo me Google”." : "Email-i ose fjalëkalimi është gabim."); }
      applyAdminEmail(u); claimKeys(u, b.keys);
      const c = startSession(req, u); saveDb();
      return send(res, 200, { me: publicUser(u) }, { "Set-Cookie": c });
    }
    if (p === "/api/auth/logout" && req.method === "POST") {
      const tok = parseCookies(req).sid; if (tok) { delete db.sessions[sha(tok)]; dirty = true; }
      return send(res, 200, { ok: true }, { "Set-Cookie": cookie(req, "sid", "", 0) });
    }
    if (p === "/api/auth/google" && req.method === "GET") {
      if (!GOOGLE_ID || !GOOGLE_SECRET) return redirect(res, "/#/hyr?gabim=google-off");
      const state = crypto.randomBytes(16).toString("base64url");
      const q = new URLSearchParams({ client_id: GOOGLE_ID, redirect_uri: publicUrl(req) + "/api/auth/google/callback", response_type: "code", scope: "openid email profile", state, prompt: "select_account" });
      return redirect(res, "https://accounts.google.com/o/oauth2/v2/auth?" + q, { "Set-Cookie": cookie(req, "gst", state, 600) });
    }
    if (p === "/api/auth/google/callback" && req.method === "GET") return await googleCallback(req, res, url);

    // --- profili ---
    if (p === "/api/me" && req.method === "PUT") {
      if (!user) throw fail(401, "Hyni në llogari.");
      const b = await readJson(req);
      const copy = Object.assign({}, user); cleanProfile(b, copy);
      if (b.password) { if (String(b.password).length < 8) throw fail(400, "Fjalëkalimi duhet të ketë të paktën 8 shkronja."); copy.salt = crypto.randomBytes(16).toString("hex"); copy.pass = hashPassword(String(b.password), copy.salt); }
      Object.assign(user, copy); saveDb();
      return send(res, 200, { me: publicUser(user) });
    }
    if (p === "/api/me/game" && req.method === "PUT") {
      if (!user) throw fail(401, "Hyni në llogari.");
      const b = await readJson(req); const g = b.game;
      if (!g || typeof g !== "object" || JSON.stringify(g).length > 60000) throw fail(400, "Të dhëna të pavlefshme.");
      const prevXp = (user.game && user.game.xp) || 0, newXp = Math.max(0, +g.xp || 0);
      const delta = Math.min(Math.max(0, newXp - prevXp), 2000); // mbrojtje nga rritjet e pamundura
      const wk = weekKey(); if (!user.week || user.week.key !== wk) user.week = { key: wk, xp: 0 }; user.week.xp += delta;
      user.game = Object.assign({}, g, { xp: prevXp + delta }); dirty = true;
      return send(res, 200, { ok: true, weekXp: user.week.xp });
    }
    if (p === "/api/leaderboard" && req.method === "GET") {
      const wk = weekKey();
      const rows = db.users.filter(u => u.week && u.week.key === wk && u.week.xp > 0 && profileDone(u)).sort((a, b) => b.week.xp - a.week.xp).slice(0, 20)
        .map(u => ({ id: u.id, name: shortName(u.name), avatar: u.avatar || null, xp: u.week.xp, total: (u.game && u.game.xp) || 0, kind: u.kind, me: !!(user && u.id === user.id) }));
      const mine = user && user.week && user.week.key === wk ? user.week.xp : 0;
      return send(res, 200, { week: wk, rows, mine });
    }

    // --- setet ---
    if (p === "/api/sets" && req.method === "POST") {
      needUser(user);
      const set = Object.assign({ id: newId() }, cleanSetBody(await readJson(req), user), { purpose: "manual", status: "ready", createdAt: Date.now(), ownerId: user.id });
      db.sets.push(set); saveDb(); return send(res, 201, publicItem(set, user));
    }
    if (p === "/api/ai/sets" && req.method === "POST") {
      needUser(user);
      if (!ai.enabled) throw fail(503, "Krijimi me AI nuk është aktivizuar ende.");
      const b = await readJson(req);
      const files = (Array.isArray(b.files) ? b.files : []).slice(0, 20).map(cleanFile).filter(Boolean);
      if (!files.length) throw fail(400, "Ngarkoni të paktën një skedar.");
      const bad = files.find(f => !ai.AI_EXT.has(extOf(f.asset)));
      if (bad) throw fail(400, `“${bad.name}” nuk mund të lexohet nga AI. Përdorni PDF, foto, Word (.docx), PowerPoint (.pptx) ose tekst.`);
      if (files.reduce((a, f) => a + f.size, 0) > ai.MAX_AI_BYTES) throw fail(400, "Skedarët janë shumë të mëdhenj (deri në 40 MB gjithsej). Ndajeni materialin në dy pjesë.");
      const q = aiQuota(user);
      if (q.left <= 0) throw fail(402, isPremium(user) ? `Keni arritur kufirin prej ${q.limit} setesh këtë muaj.` : `Keni përdorur të ${q.limit} setet falas të këtij muaji. Kaloni në Premium për më shumë.`);
      const lvl = cleanLevel(b), title = str(b.title, 120);
      const set = Object.assign({ id: newId(), title: title || (files.length > 1 ? `${files[0].name.replace(/\.[^.]+$/, "")} dhe ${files.length - 1} të tjera` : files[0].name.replace(/\.[^.]+$/, "")), titleSet: !!title,
        author: user.name, subject: str(b.subject, 60), institution: str(b.institution, 120) || user.institution || "", description: "",
        cards: [], quiz: [], fills: [], files, purpose: b.purpose === "games" ? "games" : "cards", language: b.language === "doc" ? "doc" : "sq",
        ai: true, status: "pending", createdAt: Date.now(), ownerId: user.id }, lvl);
      user.aiUsage.n++; db.sets.push(set); saveDb(); enqueueAi(set.id);
      return send(res, 201, publicItem(set, user));
    }
    let m = p.match(/^\/api\/sets\/([A-Za-z0-9_-]+)(\/retry)?$/);
    if (m) {
      const i = db.sets.findIndex(s => s.id === m[1]);
      if (i < 0) return send(res, 404, { error: "Ky set nuk ekziston më." });
      const old = db.sets[i];
      if (req.method !== "GET" && !canManage(req, user, old)) throw fail(403, "Vetëm krijuesi i këtij seti ose admini mund ta ndryshojë ose fshijë.");
      if (m[2] && req.method === "POST") {
        if (old.status !== "failed") throw fail(400, "Ky set nuk ka dështuar.");
        old.status = "pending"; delete old.error; old.aiTries = 0; saveDb(); enqueueAi(old.id); return send(res, 200, publicItem(old, user));
      }
      if (req.method === "PUT") {
        const set = Object.assign({}, old, cleanSetBody(await readJson(req), user), { updatedAt: Date.now() });
        db.sets[i] = set; saveDb(); removeUnusedAssets(assetsOf(old)); return send(res, 200, publicItem(set, user));
      }
      if (req.method === "DELETE") {
        db.sets.splice(i, 1); db.reports = db.reports.filter(r => r.itemId !== old.id);
        saveDb(); removeUnusedAssets(assetsOf(old)); return send(res, 200, { ok: true });
      }
    }

    // --- materialet (vetëm ngarkim; disa skedarë = një material) ---
    if (p === "/api/materials" && req.method === "POST") {
      needUser(user);
      const b = await readJson(req);
      const title = str(b.title, 140); if (!title) throw fail(400, "Ju lutemi shkruani emrin e materialit.");
      const files = (Array.isArray(b.files) ? b.files : []).slice(0, 30).map(cleanFile).filter(Boolean);
      if (!files.length) throw fail(400, "Ngarkoni të paktën një skedar.");
      const used = usedAssets(); if (files.some(f => used.has(f.asset))) throw fail(400, "Një nga skedarët është përdorur tashmë.");
      const mat = Object.assign({ id: newId(), title, subject: str(b.subject, 60), institution: str(b.institution, 120), uploader: str(b.uploader, 60) || user.name,
        description: str(b.description, 500), files, createdAt: Date.now(), ownerId: user.id }, cleanLevel(b));
      db.materials.push(mat); saveDb(); return send(res, 201, publicItem(mat, user));
    }
    m = p.match(/^\/api\/materials\/([A-Za-z0-9_-]+)$/);
    if (m && req.method === "DELETE") {
      const i = db.materials.findIndex(x => x.id === m[1]);
      if (i < 0) return send(res, 404, { error: "Ky material nuk ekziston më." });
      const old = db.materials[i];
      if (!canManage(req, user, old)) throw fail(403, "Vetëm ai që e ngarkoi këtë material ose admini mund ta fshijë.");
      db.materials.splice(i, 1); db.reports = db.reports.filter(r => r.itemId !== old.id);
      saveDb(); removeUnusedAssets(assetsOf(old)); return send(res, 200, { ok: true });
    }

    // --- raportimet ---
    if (p === "/api/reports" && req.method === "POST") {
      needUser(user);
      const b = await readJson(req);
      const type = b.type === "set" ? "set" : b.type === "material" ? "material" : null, itemId = str(b.id, 40);
      const exists = type === "set" ? db.sets.some(s => s.id === itemId) : type === "material" ? db.materials.some(x => x.id === itemId) : false;
      if (!exists) throw fail(404, "Kjo përmbajtje nuk ekziston më.");
      if (db.reports.length >= 1000) throw fail(429, "Provoni më vonë.");
      db.reports.push({ id: newId(), type, itemId, reason: str(b.reason, 300), by: user.id, createdAt: Date.now() }); saveDb();
      return send(res, 201, { ok: true });
    }

    // --- admini ---
    if (p.startsWith("/api/admin/")) {
      if (!isAdmin(user)) throw fail(403, "Kjo faqe është vetëm për adminët.");
      if (p === "/api/admin/overview" && req.method === "GET") return send(res, 200, adminOverview());
      m = p.match(/^\/api\/admin\/reports\/([A-Za-z0-9_-]+)$/);
      if (m && req.method === "DELETE") { db.reports = db.reports.filter(r => r.id !== m[1]); saveDb(); return send(res, 200, { ok: true }); }
      m = p.match(/^\/api\/admin\/users\/([A-Za-z0-9_-]+)$/);
      if (m) {
        const u = db.users.find(x => x.id === m[1]); if (!u) throw fail(404, "Përdoruesi nuk ekziston.");
        if (u.id === user.id) throw fail(400, "Nuk mund ta ndryshoni llogarinë tuaj nga këtu.");
        if (req.method === "POST") {
          const b = await readJson(req);
          if (b.isAdmin !== undefined) u.role = b.isAdmin ? "admin" : "user";
          if (b.plan !== undefined) u.plan = b.plan === "premium" ? "premium" : "free";
          saveDb(); return send(res, 200, { ok: true });
        }
        if (req.method === "DELETE") {
          db.users = db.users.filter(x => x.id !== u.id);
          for (const [h, s] of Object.entries(db.sessions)) if (s.uid === u.id) delete db.sessions[h];
          saveDb(); return send(res, 200, { ok: true });
        }
      }
    }

    // --- skedarët ---
    if (p === "/api/upload" && req.method === "POST") {
      if (!user) throw fail(401, "Hyni ose regjistrohuni për të ngarkuar skedarë.");
      const name = str(url.searchParams.get("name"), 200);
      const ext = (name.toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1];
      if (!ext || !TYPES[ext]) return send(res, 415, { error: "Ky lloj skedari nuk lejohet. Përdorni PDF, Word, PowerPoint, Excel, foto, TXT ose ZIP." });
      const id = newId() + "." + ext;
      await streamToFile(req, path.join(UPLOAD_DIR, id), MAX_UPLOAD);
      return send(res, 201, { id });
    }
    if (p.startsWith("/uploads/") && req.method === "GET") {
      const id = p.slice(9); const ext = extOf(id);
      if (!ext || !TYPES[ext]) { res.writeHead(404); return res.end(); }
      const download = url.searchParams.get("download") === "1" || !INLINE.has(ext);
      const isAvatar = db.users.some(u => u.avatar && u.avatar.asset === id);
      if (!user && !isAvatar) { res.writeHead(401, { "Content-Type": "text/plain; charset=utf-8" }); return res.end("Hyni në Sinapsa për ta hapur këtë skedar."); }
      const name = str(url.searchParams.get("name"), 200) || id;
      return serveFile(res, path.join(UPLOAD_DIR, id), {
        "Content-Type": TYPES[ext], "Content-Disposition": contentDisposition(download ? "attachment" : "inline", name),
        "X-Content-Type-Options": "nosniff", "Cache-Control": "private, max-age=86400",
      });
    }

    // --- faqja ---
    if (req.method === "GET" && !p.startsWith("/api/")) {
      const rel = p === "/" ? "index.html" : p.replace(/^\/+/, "");
      const file = path.join(PUBLIC_DIR, rel);
      if (!file.startsWith(PUBLIC_DIR + path.sep)) { res.writeHead(403); return res.end(); }
      const ext = path.extname(file);
      return serveFile(res, file, { "Content-Type": STATIC_TYPES[ext] || "application/octet-stream", "Cache-Control": ext === ".html" || ext === ".js" || ext === ".css" ? "no-cache" : "public, max-age=86400" });
    }
    send(res, 404, { error: "Nuk u gjet." });
  } catch (e) {
    if (!e.status) console.error(e);
    if (!res.headersSent) send(res, e.status || 500, { error: e.status ? e.message : "Ndodhi një gabim në server. Provoni përsëri." });
  }
});

server.listen(PORT, () => {
  console.log(`\n  Sinapsa po punon!  Hapeni në shfletues:  http://localhost:${PORT}`);
  console.log(ai.enabled ? `  AI: ${ai.provider} (${ai.model})` : "  AI: jo aktive (vendosni GEMINI_API_KEY ose ANTHROPIC_API_KEY)");
  console.log(GOOGLE_ID && GOOGLE_SECRET ? "  Hyrja me Google: aktive" : "  Hyrja me Google: jo aktive (vendosni GOOGLE_CLIENT_ID dhe GOOGLE_CLIENT_SECRET)");
  console.log(ADMIN_EMAILS.length ? `  Adminët: ${ADMIN_EMAILS.join(", ")}\n` : `  Kujdes: ADMIN_EMAILS nuk është vendosur.\n`);
});
