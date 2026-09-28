// Sinapsa – serveri. Nuk kërkon instalime shtesë. Nisni me:  node server.js
// Pastaj hapni http://localhost:3000 në shfletues.
// Gjithçka ruhet te dosja data/ (data/db.json dhe data/uploads/).
//
// ADMINI: vendosni variablën ADMIN_EMAILS me email-in tuaj (p.sh. ADMIN_EMAILS=emri@gmail.com).
// Kur regjistroheni ose hyni me atë email, llogaria bëhet admin. Disa email-e ndahen me presje.

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const DB_FILE = path.join(DATA_DIR, "db.json");
const MAX_UPLOAD = 50 * 1024 * 1024; // 50 MB për skedar
const MAX_JSON = 2 * 1024 * 1024;
const SESSION_DAYS = 30;
const TZ = "Europe/Belgrade"; // e njëjta orë si Kosova dhe Shqipëria
const ADMIN_EMAILS = String(process.env.ADMIN_EMAILS || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);

const FACULTIES = [
  "Mjekësi", "Stomatologji", "Farmaci", "Infermieri dhe Shkenca Shëndetësore", "Juridik", "Ekonomik",
  "Shkenca Politike", "Administratë Publike", "Filologjik", "Gjuhë të Huaja", "Filozofik", "Psikologji", "Sociologji",
  "Histori", "Gjeografi", "Edukim", "Matematikë", "Fizikë", "Kimi", "Biologji", "Shkenca Kompjuterike",
  "Inxhinieri Elektrike dhe Kompjuterike", "Inxhinieri Mekanike", "Ndërtimtari", "Arkitekturë",
  "Inxhinieri Kimike dhe Teknologjike", "Gjeoshkenca dhe Miniera", "Bujqësi dhe Veterinari", "Shkenca Ushqimore",
  "Shkenca Sportive", "Arte", "Muzikë", "Gazetari dhe Komunikim", "Turizëm", "Siguri dhe Studime Mbrojtëse", "Tjetër",
];

const TYPES = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  odt: "application/vnd.oasis.opendocument.text",
  rtf: "application/rtf",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odp: "application/vnd.oasis.opendocument.presentation",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  csv: "text/csv; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp",
  zip: "application/zip", rar: "application/vnd.rar", "7z": "application/x-7z-compressed",
};
const INLINE = new Set(["pdf", "png", "jpg", "jpeg", "gif", "webp", "txt"]);
const ASSET_RE = /^[A-Za-z0-9_-]+\.([a-z0-9]+)$/;
const STATIC_TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css",
  ".svg": "image/svg+xml", ".ico": "image/x-icon", ".png": "image/png",
};

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ---------- ruajtja ----------
const newId = () => crypto.randomBytes(9).toString("base64url");
const sha = s => crypto.createHash("sha256").update(String(s)).digest("hex");

function exampleSets() {
  const now = Date.now();
  const mk = (title, faculty, subject, description, pairs, age) => ({
    id: newId(), title, author: "Shembuj nga Sinapsa", faculty, subject, description,
    createdAt: now - age, files: [], cards: pairs.map(([term, def]) => ({ term, def })),
  });
  return [
    mk("Nervat kraniale – emrat dhe funksionet kryesore", "Mjekësi", "Anatomia",
      "12 nervat kraniale sipas radhës, me funksionin kryesor.", [
        ["N. I – Olfaktor", "Nuhatja"], ["N. II – Optik", "Shikimi"],
        ["N. III – Okulomotor", "Shumica e lëvizjeve të syrit, ngushtimi i bebëzës, ngritja e qepallës"],
        ["N. IV – Troklear", "Muskuli i pjerrët i sipërm (syri lëviz poshtë dhe brenda)"],
        ["N. V – Trigeminal", "Ndjeshmëria e fytyrës; muskujt e përtypjes"],
        ["N. VI – Abducens", "Muskuli i drejtë anësor (syri lëviz nga jashtë)"],
        ["N. VII – Facial", "Muskujt e mimikës, shija (2/3 e përparme e gjuhës), gjëndrat lotore dhe të pështymës"],
        ["N. VIII – Vestibulokoklear", "Dëgjimi dhe ekuilibri"],
        ["N. IX – Glosofaringeal", "Shija (1/3 e pasme e gjuhës), gëlltitja, gjëndra parotide"],
        ["N. X – Vagus", "Inervimi parasimpatik i organeve të kraharorit dhe barkut; gëlltitja dhe të folurit"],
        ["N. XI – Aksesor", "Muskujt sternokleidomastoid dhe trapez"], ["N. XII – Hipoglos", "Lëvizjet e gjuhës"],
      ], 86400000),
  ];
}
function loadDb() {
  let d;
  try { d = JSON.parse(fs.readFileSync(DB_FILE, "utf8")); }
  catch { d = { sets: exampleSets(), materials: [] }; }
  d.sets = d.sets || []; d.materials = d.materials || []; d.users = d.users || [];
  d.sessions = d.sessions || {}; d.reports = d.reports || []; d.stats = d.stats || { days: {} };
  // uploads të versionit të vjetër (jashtë data/) zhvendosen brenda
  const oldUploads = path.join(ROOT, "uploads");
  if (fs.existsSync(oldUploads)) for (const f of fs.readdirSync(oldUploads)) {
    try { fs.renameSync(path.join(oldUploads, f), path.join(UPLOAD_DIR, f)); } catch {}
  }
  return d;
}
let db = loadDb();
let dirty = false;
function saveNow() {
  const tmp = DB_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, DB_FILE);
  dirty = false;
}
const saveDb = saveNow;
saveNow();
setInterval(() => { if (dirty) saveNow(); }, 20000); // statistikat ruhen çdo 20 sekonda
process.on("SIGTERM", () => { if (dirty) saveNow(); process.exit(0); });
process.on("SIGINT", () => { if (dirty) saveNow(); process.exit(0); });

// ---------- ndihmëse ----------
function send(res, status, obj, headers) {
  res.writeHead(status, Object.assign({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }, headers || {}));
  res.end(JSON.stringify(obj));
}
const fail = (status, message) => Object.assign(new Error(message), { status });
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on("data", c => {
      size += c.length;
      if (size > limit) { reject(fail(413, "Kërkesa është shumë e madhe.")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}
async function readJson(req) {
  try { return JSON.parse((await readBody(req, MAX_JSON)).toString("utf8") || "{}"); }
  catch (e) { if (e.status) throw e; throw fail(400, "Kërkesë e pavlefshme."); }
}
function streamToFile(req, dest, limit) {
  return new Promise((resolve, reject) => {
    const tmp = dest + ".part"; const out = fs.createWriteStream(tmp); let size = 0, done = false;
    const abort = err => { if (done) return; done = true; out.destroy(); fs.unlink(tmp, () => {}); reject(err); };
    req.on("data", c => { size += c.length; if (size > limit) { abort(fail(413, "Skedari është shumë i madh. Kufiri është 50 MB.")); req.unpipe(out); req.resume(); } });
    req.on("error", abort); req.on("aborted", () => abort(fail(400, "Ngarkimi u ndërpre. Provoni përsëri.")));
    out.on("error", abort);
    out.on("finish", () => {
      if (done) return; done = true;
      if (!size) { fs.unlink(tmp, () => {}); return reject(fail(400, "Skedari është bosh.")); }
      fs.rename(tmp, dest, e => e ? reject(e) : resolve(size));
    });
    req.pipe(out);
  });
}
const str = (v, max) => String(v == null ? "" : v).trim().slice(0, max);
const faculty = v => FACULTIES.includes(v) ? v : null;
const validAsset = a => { const m = ASSET_RE.exec(a || ""); return !!(m && TYPES[m[1]]) && fs.existsSync(path.join(UPLOAD_DIR, a)); };
function cleanFile(f) {
  if (!f || typeof f !== "object") return null;
  const asset = str(f.asset, 80);
  if (!validAsset(asset)) return null;
  return { asset, name: str(f.name, 200) || asset, type: str(f.type, 60), size: Number(f.size) || 0 };
}
function cleanSet(b) {
  const title = str(b.title, 120), author = str(b.author, 60), fac = faculty(b.faculty);
  if (!author) throw fail(400, "Ju lutemi shkruani emrin tuaj.");
  if (!fac) throw fail(400, "Ju lutemi zgjidhni fakultetin.");
  if (!title) throw fail(400, "Ju lutemi jepini setit një titull.");
  const cards = (Array.isArray(b.cards) ? b.cards : []).slice(0, 1000).map(c => {
    const o = { term: str(c && c.term, 2000), def: str(c && c.def, 5000) };
    const img = cleanFile(c && c.img); if (img) o.img = img;
    return o;
  }).filter(c => c.term || c.def || c.img);
  if (!cards.length) throw fail(400, "Shtoni të paktën një kartë.");
  const files = (Array.isArray(b.files) ? b.files : []).map(cleanFile).filter(Boolean).slice(0, 50);
  return { title, author, faculty: fac, subject: str(b.subject, 60), description: str(b.description, 500), cards, files };
}
function assetsOf(item) {
  if (item.asset) return [item.asset];
  return [...(item.files || []).map(f => f.asset), ...(item.cards || []).map(c => c.img && c.img.asset)].filter(Boolean);
}
function usedAssets() { return new Set([...db.sets.flatMap(assetsOf), ...db.materials.flatMap(assetsOf)]); }
function removeUnusedAssets(ids) {
  const used = usedAssets();
  for (const id of ids) if (!used.has(id)) fs.unlink(path.join(UPLOAD_DIR, id), () => {});
}
function contentDisposition(kind, name) {
  const ascii = name.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}
function serveFile(res, file, headers) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }); return res.end("Nuk u gjet"); }
    res.writeHead(200, Object.assign({ "Content-Length": st.size }, headers));
    fs.createReadStream(file).pipe(res);
  });
}
const byNewest = arr => [...arr].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
const dayKey = (t = Date.now()) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(t);

// ---------- llogaritë dhe seancat ----------
function hashPassword(pw, salt) { return crypto.scryptSync(pw, salt, 64).toString("hex"); }
function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || "").split(";")) {
    const i = part.indexOf("="); if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
function currentUser(req) {
  const tok = parseCookies(req).sid; if (!tok) return null;
  const s = db.sessions[sha(tok)];
  if (!s || s.exp < Date.now()) return null;
  return db.users.find(u => u.id === s.uid) || null;
}
function sessionCookie(req, token, maxAge) {
  const secure = String(req.headers["x-forwarded-proto"] || "").includes("https") ? "; Secure" : "";
  return `sid=${token ? encodeURIComponent(token) : ""}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}
function startSession(req, user) {
  const token = crypto.randomBytes(32).toString("base64url");
  db.sessions[sha(token)] = { uid: user.id, exp: Date.now() + SESSION_DAYS * 86400000 };
  return sessionCookie(req, token, SESSION_DAYS * 86400);
}
const publicUser = u => u ? { id: u.id, name: u.name, email: u.email, isAdmin: u.role === "admin" } : null;
const isAdmin = u => !!(u && u.role === "admin");
function applyAdminEmail(u) { if (ADMIN_EMAILS.includes(u.email)) u.role = "admin"; }
// Kur dikush hyn, setet/materialet që krijoi pa llogari në këtë pajisje i kalojnë llogarisë së tij
function claimKeys(user, keys) {
  if (!keys || typeof keys !== "object") return;
  for (const [id, key] of Object.entries(keys).slice(0, 500)) {
    const item = db.sets.find(s => s.id === id) || db.materials.find(m => m.id === id);
    if (item && !item.ownerId && item.ownerKeyHash && item.ownerKeyHash === sha(key)) item.ownerId = user.id;
  }
}
const loginTries = new Map(); // mbrojtje e thjeshtë nga provat e shumta
function tooManyTries(ip) {
  const now = Date.now(), t = (loginTries.get(ip) || []).filter(x => now - x < 15 * 60000);
  loginTries.set(ip, t); return t.length >= 10;
}
const clientIp = req => String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();

// ---------- pronësia ----------
function canManage(req, user, item) {
  if (isAdmin(user)) return true;
  if (user && item.ownerId && item.ownerId === user.id) return true;
  const key = req.headers["x-owner-key"];
  return !!(key && item.ownerKeyHash && item.ownerKeyHash === sha(key));
}
function publicItem(item, user) {
  const { ownerId, ownerKeyHash, ...rest } = item;
  rest.mine = !!(user && ownerId && ownerId === user.id);
  return rest;
}
function newOwnership(user) {
  const key = crypto.randomBytes(24).toString("base64url");
  return { key, fields: { ownerId: user ? user.id : null, ownerKeyHash: sha(key) } };
}

// ---------- vizitorët ----------
const online = new Map(); // vizitori -> koha e fundit
function seen(req) {
  const v = str(req.headers["x-visitor"], 64);
  if (v) online.set(sha(v).slice(0, 16), Date.now());
}
function countVisit(vid) {
  const k = dayKey(); const day = db.stats.days[k] || (db.stats.days[k] = { views: 0, v: {} });
  day.views++; if (vid) day.v[sha(vid).slice(0, 16)] = 1;
  dirty = true;
}
function pruneStats() {
  const keep = new Set(Array.from({ length: 90 }, (_, i) => dayKey(Date.now() - i * 86400000)));
  for (const k of Object.keys(db.stats.days)) if (!keep.has(k)) delete db.stats.days[k];
  for (const [h, s] of Object.entries(db.sessions)) if (s.exp < Date.now()) delete db.sessions[h];
  const now = Date.now(); for (const [k, t] of online) if (now - t > 10 * 60000) online.delete(k);
}
// Fshin skedarët e ngarkuar që nuk i përdor askush (p.sh. ngarkime të ndërprera), pas 1 dite
function cleanOrphans() {
  const used = usedAssets();
  for (const f of fs.readdirSync(UPLOAD_DIR)) {
    if (used.has(f)) continue;
    const p = path.join(UPLOAD_DIR, f);
    try { if (Date.now() - fs.statSync(p).mtimeMs > 86400000) fs.unlinkSync(p); } catch {}
  }
}
setInterval(() => { pruneStats(); cleanOrphans(); dirty = true; }, 6 * 3600000);

function adminOverview() {
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const k = dayKey(Date.now() - i * 86400000), d = db.stats.days[k];
    days.push({ day: k, visitors: d ? Object.keys(d.v).length : 0, views: d ? d.views : 0 });
  }
  const uniq = n => { const s = new Set(); for (const d of days.slice(-n)) { const x = db.stats.days[d.day]; if (x) Object.keys(x.v).forEach(v => s.add(v)); } return s.size; };
  let bytes = 0, files = 0;
  for (const f of fs.readdirSync(UPLOAD_DIR)) { try { bytes += fs.statSync(path.join(UPLOAD_DIR, f)).size; files++; } catch {} }
  const now = Date.now();
  return {
    stats: {
      today: days[days.length - 1].visitors, viewsToday: days[days.length - 1].views,
      week: uniq(7), month: uniq(30), online: [...online.values()].filter(t => now - t < 5 * 60000).length,
      users: db.users.length, sets: db.sets.length, materials: db.materials.length, bytes, files,
    },
    days,
    reports: byNewest(db.reports).map(r => {
      const item = r.type === "set" ? db.sets.find(s => s.id === r.itemId) : db.materials.find(m => m.id === r.itemId);
      return Object.assign({}, r, { itemTitle: item ? item.title : null });
    }),
    users: byNewest(db.users).map(u => ({ id: u.id, name: u.name, email: u.email, isAdmin: u.role === "admin", createdAt: u.createdAt, lastLogin: u.lastLogin,
      sets: db.sets.filter(s => s.ownerId === u.id).length, materials: db.materials.filter(m => m.ownerId === u.id).length })),
    adminEmailsSet: ADMIN_EMAILS.length > 0,
  };
}

// ---------- rrugët ----------
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://x");
    const p = decodeURIComponent(url.pathname);
    const user = p.startsWith("/api/") ? currentUser(req) : null;

    if (p === "/api/all" && req.method === "GET") {
      seen(req);
      return send(res, 200, {
        sets: byNewest(db.sets).map(s => publicItem(s, user)),
        materials: byNewest(db.materials).map(m => publicItem(m, user)),
        me: publicUser(user),
      });
    }
    if (p === "/api/visit" && req.method === "POST") {
      const b = await readJson(req); countVisit(str(b.vid, 64)); seen(req);
      return send(res, 200, { ok: true });
    }

    // --- llogaritë ---
    if (p === "/api/auth/signup" && req.method === "POST") {
      if (tooManyTries(clientIp(req))) throw fail(429, "Shumë përpjekje. Provoni pas 15 minutash.");
      loginTries.get(clientIp(req)).push(Date.now());
      const b = await readJson(req);
      const name = str(b.name, 60), email = str(b.email, 120).toLowerCase(), pw = String(b.password || "");
      if (!name) throw fail(400, "Shkruani emrin tuaj.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw fail(400, "Shkruani një email të vlefshëm.");
      if (pw.length < 8) throw fail(400, "Fjalëkalimi duhet të ketë të paktën 8 shkronja.");
      if (db.users.some(u => u.email === email)) throw fail(409, "Ky email është i regjistruar tashmë. Hyni në llogari.");
      const salt = crypto.randomBytes(16).toString("hex");
      const u = { id: newId(), name, email, salt, pass: hashPassword(pw, salt), role: "user", createdAt: Date.now(), lastLogin: Date.now() };
      applyAdminEmail(u); db.users.push(u); claimKeys(u, b.keys);
      const cookie = startSession(req, u); saveDb();
      return send(res, 201, { me: publicUser(u) }, { "Set-Cookie": cookie });
    }
    if (p === "/api/auth/login" && req.method === "POST") {
      const ip = clientIp(req);
      if (tooManyTries(ip)) throw fail(429, "Shumë përpjekje. Provoni pas 15 minutash.");
      const b = await readJson(req);
      const email = str(b.email, 120).toLowerCase(), pw = String(b.password || "");
      const u = db.users.find(x => x.email === email);
      const ok = u && crypto.timingSafeEqual(Buffer.from(hashPassword(pw, u.salt), "hex"), Buffer.from(u.pass, "hex"));
      if (!ok) { loginTries.get(ip).push(Date.now()); throw fail(401, "Email-i ose fjalëkalimi është gabim."); }
      u.lastLogin = Date.now(); applyAdminEmail(u); claimKeys(u, b.keys);
      const cookie = startSession(req, u); saveDb();
      return send(res, 200, { me: publicUser(u) }, { "Set-Cookie": cookie });
    }
    if (p === "/api/auth/logout" && req.method === "POST") {
      const tok = parseCookies(req).sid; if (tok) { delete db.sessions[sha(tok)]; dirty = true; }
      return send(res, 200, { ok: true }, { "Set-Cookie": sessionCookie(req, "", 0) });
    }

    // --- setet ---
    if (p === "/api/sets" && req.method === "POST") {
      const own = newOwnership(user);
      const set = Object.assign({ id: newId() }, cleanSet(await readJson(req)), { createdAt: Date.now() }, own.fields);
      db.sets.push(set); saveDb();
      return send(res, 201, Object.assign(publicItem(set, user), { ownerKey: own.key }));
    }
    let m = p.match(/^\/api\/sets\/([A-Za-z0-9_-]+)$/);
    if (m) {
      const i = db.sets.findIndex(s => s.id === m[1]);
      if (i < 0) return send(res, 404, { error: "Ky set nuk ekziston më." });
      const old = db.sets[i];
      if ((req.method === "PUT" || req.method === "DELETE") && !canManage(req, user, old))
        throw fail(403, "Vetëm krijuesi i këtij seti ose admini mund ta ndryshojë ose fshijë.");
      if (req.method === "PUT") {
        const set = Object.assign({ id: old.id }, cleanSet(await readJson(req)),
          { createdAt: old.createdAt, updatedAt: Date.now(), ownerId: old.ownerId || null, ownerKeyHash: old.ownerKeyHash || null });
        db.sets[i] = set; saveDb(); removeUnusedAssets(assetsOf(old));
        return send(res, 200, publicItem(set, user));
      }
      if (req.method === "DELETE") {
        db.sets.splice(i, 1); db.reports = db.reports.filter(r => r.itemId !== old.id);
        saveDb(); removeUnusedAssets(assetsOf(old));
        return send(res, 200, { ok: true });
      }
    }

    // --- materialet ---
    if (p === "/api/materials" && req.method === "POST") {
      const b = await readJson(req);
      const title = str(b.title, 140), fac = faculty(b.faculty), asset = str(b.asset, 80);
      if (!title) throw fail(400, "Ju lutemi shkruani emrin e skedarit.");
      if (!fac) throw fail(400, "Ju lutemi zgjidhni fakultetin.");
      if (!validAsset(asset)) throw fail(400, "Skedari nuk u gjet. Ngarkojeni përsëri.");
      if (usedAssets().has(asset)) throw fail(400, "Ky skedar është përdorur tashmë.");
      const own = newOwnership(user);
      const mat = Object.assign({
        id: newId(), title, faculty: fac, subject: str(b.subject, 60), uploader: str(b.uploader, 60),
        asset, fileName: str(b.fileName, 200) || asset, size: fs.statSync(path.join(UPLOAD_DIR, asset)).size, createdAt: Date.now(),
      }, own.fields);
      db.materials.push(mat); saveDb();
      return send(res, 201, Object.assign(publicItem(mat, user), { ownerKey: own.key }));
    }
    m = p.match(/^\/api\/materials\/([A-Za-z0-9_-]+)$/);
    if (m && req.method === "DELETE") {
      const i = db.materials.findIndex(x => x.id === m[1]);
      if (i < 0) return send(res, 404, { error: "Ky material nuk ekziston më." });
      const old = db.materials[i];
      if (!canManage(req, user, old)) throw fail(403, "Vetëm ai që e ngarkoi këtë material ose admini mund ta fshijë.");
      db.materials.splice(i, 1); db.reports = db.reports.filter(r => r.itemId !== old.id);
      saveDb(); removeUnusedAssets(assetsOf(old));
      return send(res, 200, { ok: true });
    }

    // --- raportimet ---
    if (p === "/api/reports" && req.method === "POST") {
      const b = await readJson(req);
      const type = b.type === "set" ? "set" : b.type === "material" ? "material" : null, itemId = str(b.id, 40);
      const exists = type === "set" ? db.sets.some(s => s.id === itemId) : type === "material" ? db.materials.some(x => x.id === itemId) : false;
      if (!exists) throw fail(404, "Kjo përmbajtje nuk ekziston më.");
      if (db.reports.length >= 1000) throw fail(429, "Provoni më vonë.");
      db.reports.push({ id: newId(), type, itemId, reason: str(b.reason, 300), createdAt: Date.now() }); saveDb();
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
        const u = db.users.find(x => x.id === m[1]);
        if (!u) throw fail(404, "Përdoruesi nuk ekziston.");
        if (u.id === user.id) throw fail(400, "Nuk mund ta ndryshoni llogarinë tuaj nga këtu.");
        if (req.method === "POST") {
          const b = await readJson(req); u.role = b.isAdmin ? "admin" : "user"; saveDb();
          return send(res, 200, { ok: true });
        }
        if (req.method === "DELETE") {
          db.users = db.users.filter(x => x.id !== u.id);
          for (const [h, s] of Object.entries(db.sessions)) if (s.uid === u.id) delete db.sessions[h];
          saveDb(); return send(res, 200, { ok: true });
        }
      }
    }

    // --- ngarkimi i skedarëve ---
    if (p === "/api/upload" && req.method === "POST") {
      const name = str(url.searchParams.get("name"), 200);
      const ext = (name.toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1];
      if (!ext || !TYPES[ext]) return send(res, 415, { error: "Ky lloj skedari nuk lejohet. Përdorni PDF, Word, PowerPoint, Excel, foto, TXT ose ZIP." });
      const id = newId() + "." + ext;
      await streamToFile(req, path.join(UPLOAD_DIR, id), MAX_UPLOAD);
      return send(res, 201, { id });
    }
    if (p.startsWith("/uploads/") && req.method === "GET") {
      const id = p.slice(9); const mm = ASSET_RE.exec(id);
      if (!mm || !TYPES[mm[1]]) { res.writeHead(404); return res.end(); }
      const ext = mm[1];
      const download = url.searchParams.get("download") === "1" || !INLINE.has(ext);
      const name = str(url.searchParams.get("name"), 200) || id;
      return serveFile(res, path.join(UPLOAD_DIR, id), {
        "Content-Type": TYPES[ext],
        "Content-Disposition": contentDisposition(download ? "attachment" : "inline", name),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "public, max-age=31536000, immutable",
      });
    }

    // --- faqja ---
    if (req.method === "GET" && !p.startsWith("/api/")) {
      const rel = p === "/" ? "index.html" : p.replace(/^\/+/, "");
      const file = path.join(PUBLIC_DIR, rel);
      if (!file.startsWith(PUBLIC_DIR + path.sep)) { res.writeHead(403); return res.end(); }
      return serveFile(res, file, { "Content-Type": STATIC_TYPES[path.extname(file)] || "application/octet-stream" });
    }
    send(res, 404, { error: "Nuk u gjet." });
  } catch (e) {
    if (!e.status) console.error(e);
    send(res, e.status || 500, { error: e.status ? e.message : "Ndodhi një gabim në server. Provoni përsëri." });
  }
});

server.listen(PORT, () => {
  console.log(`\n  Sinapsa po punon!  Hapeni në shfletues:  http://localhost:${PORT}`);
  console.log(ADMIN_EMAILS.length ? `  Adminët: ${ADMIN_EMAILS.join(", ")}\n` : `  Kujdes: ADMIN_EMAILS nuk është vendosur – askush nuk mund të hyjë te paneli i adminit.\n`);
});
