// Sinapsa – serveri. Nuk kërkon instalime shtesë. Nisni me:  node server.js
// Pastaj hapni http://localhost:3000 në shfletues.
// Setet dhe materialet ruhen te data/db.json, skedarët te uploads/.

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads"); // brenda "data", që të ruhet në diskun e Render-it
const DB_FILE = path.join(DATA_DIR, "db.json");
const MAX_UPLOAD = 50 * 1024 * 1024; // 50 MB
const MAX_JSON = 2 * 1024 * 1024;

const FACULTIES = [
  "Mjekësi", "Stomatologji", "Farmaci", "Infermieri dhe Shkenca Shëndetësore", "Juridik", "Ekonomik",
  "Shkenca Politike", "Administratë Publike", "Filologjik", "Gjuhë të Huaja", "Filozofik", "Psikologji", "Sociologji",
  "Histori", "Gjeografi", "Edukim", "Matematikë", "Fizikë", "Kimi", "Biologji", "Shkenca Kompjuterike",
  "Inxhinieri Elektrike dhe Kompjuterike", "Inxhinieri Mekanike", "Ndërtimtari", "Arkitekturë",
  "Inxhinieri Kimike dhe Teknologjike", "Gjeoshkenca dhe Miniera", "Bujqësi dhe Veterinari", "Shkenca Ushqimore",
  "Shkenca Sportive", "Arte", "Muzikë", "Gazetari dhe Komunikim", "Turizëm", "Siguri dhe Studime Mbrojtëse", "Tjetër",
];

// Allowed file extensions -> type they are served with
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

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ---------- ruajtja ----------
function newId() { return crypto.randomBytes(9).toString("base64url"); }
function exampleSets() {
  const now = Date.now();
  const mk = (title, faculty, subject, description, pairs, age) => ({
    id: newId(), title, author: "Shembuj nga Sinapsa", faculty, subject, description,
    createdAt: now - age, files: [], cards: pairs.map(([term, def]) => ({ term, def })),
  });
  return [
    mk("Nervat kraniale – emrat dhe funksionet kryesore", "Mjekësi", "Anatomia",
      "12 nervat kraniale sipas radhës, me funksionin kryesor. Mund ta fshini këtë shembull kur të doni.", [
        ["N. I – Olfaktor", "Nuhatja"],
        ["N. II – Optik", "Shikimi"],
        ["N. III – Okulomotor", "Shumica e lëvizjeve të syrit, ngushtimi i bebëzës, ngritja e qepallës"],
        ["N. IV – Troklear", "Muskuli i pjerrët i sipërm (syri lëviz poshtë dhe brenda)"],
        ["N. V – Trigeminal", "Ndjeshmëria e fytyrës; muskujt e përtypjes"],
        ["N. VI – Abducens", "Muskuli i drejtë anësor (syri lëviz nga jashtë)"],
        ["N. VII – Facial", "Muskujt e mimikës, shija (2/3 e përparme e gjuhës), gjëndrat lotore dhe të pështymës"],
        ["N. VIII – Vestibulokoklear", "Dëgjimi dhe ekuilibri"],
        ["N. IX – Glosofaringeal", "Shija (1/3 e pasme e gjuhës), gëlltitja, gjëndra parotide"],
        ["N. X – Vagus", "Inervimi parasimpatik i organeve të kraharorit dhe barkut; gëlltitja dhe të folurit"],
        ["N. XI – Aksesor", "Muskujt sternokleidomastoid dhe trapez"],
        ["N. XII – Hipoglos", "Lëvizjet e gjuhës"],
      ], 86400000),
    mk("Fjalor bazë i programimit", "Shkenca Kompjuterike", "Hyrje në programim",
      "Termat e parë që mësohen në programim.", [
        ["Variabël", "Emër që ruan një vlerë në memorie, e cila mund të ndryshojë gjatë ekzekutimit"],
        ["Funksion", "Bllok kodi me emër që kryen një detyrë dhe mund të thirret shumë herë"],
        ["Cikël (loop)", "Strukturë që përsërit një bllok kodi derisa të plotësohet një kusht"],
        ["Algoritëm", "Varg hapash të qartë për zgjidhjen e një problemi"],
        ["Kompajler", "Program që përkthen kodin burimor në kod që e ekzekuton kompjuteri"],
        ["Varg (array)", "Koleksion elementesh të renditura, të qasshme me indeks"],
      ], 3600000),
  ];
}
function saveDb(db) {
  const tmp = DB_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db, null, 1));
  fs.renameSync(tmp, DB_FILE);
}
function loadDb() {
  try { const d = JSON.parse(fs.readFileSync(DB_FILE, "utf8")); d.sets = d.sets || []; d.materials = d.materials || []; return d; }
  catch {
    // Kalim nga versioni i vjetër (MedDeck) nëse ekziston data/sets.json
    let sets = null;
    try { sets = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "sets.json"), "utf8")).sets; } catch {}
    if (sets) sets = sets.map(s => Object.assign({}, s, { faculty: s.faculty || "Mjekësi", subject: s.faculty ? s.subject : (s.subject || "") }));
    const db = { sets: sets || exampleSets(), materials: [] };
    saveDb(db); return db;
  }
}
let db = loadDb();

// ---------- ndihmëse ----------
function send(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(obj));
}
const fail = (status, message) => Object.assign(new Error(message), { status });
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on("data", c => {
      size += c.length;
      if (size > limit) { reject(fail(413, "Skedari është shumë i madh. Kufiri është 50 MB.")); req.destroy(); return; }
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
function removeUnusedAssets(ids) {
  const used = new Set([...db.sets.flatMap(assetsOf), ...db.materials.flatMap(assetsOf)]);
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

// ---------- rrugët ----------
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://x");
    const p = decodeURIComponent(url.pathname);

    if (p === "/api/all" && req.method === "GET")
      return send(res, 200, { sets: byNewest(db.sets), materials: byNewest(db.materials), faculties: FACULTIES });

    // --- setet ---
    if (p === "/api/sets" && req.method === "POST") {
      const set = Object.assign({ id: newId() }, cleanSet(await readJson(req)), { createdAt: Date.now() });
      db.sets.push(set); saveDb(db);
      return send(res, 201, set);
    }
    let m = p.match(/^\/api\/sets\/([A-Za-z0-9_-]+)$/);
    if (m) {
      const i = db.sets.findIndex(s => s.id === m[1]);
      if (i < 0) return send(res, 404, { error: "Ky set nuk ekziston më." });
      if (req.method === "PUT") {
        const old = db.sets[i];
        const set = Object.assign({ id: old.id }, cleanSet(await readJson(req)), { createdAt: old.createdAt, updatedAt: Date.now() });
        db.sets[i] = set; saveDb(db); removeUnusedAssets(assetsOf(old));
        return send(res, 200, set);
      }
      if (req.method === "DELETE") {
        const [old] = db.sets.splice(i, 1); saveDb(db); removeUnusedAssets(assetsOf(old));
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
      const mat = {
        id: newId(), title, faculty: fac, subject: str(b.subject, 60), uploader: str(b.uploader, 60),
        asset, fileName: str(b.fileName, 200) || asset, size: fs.statSync(path.join(UPLOAD_DIR, asset)).size, createdAt: Date.now(),
      };
      db.materials.push(mat); saveDb(db);
      return send(res, 201, mat);
    }
    m = p.match(/^\/api\/materials\/([A-Za-z0-9_-]+)$/);
    if (m && req.method === "DELETE") {
      const i = db.materials.findIndex(x => x.id === m[1]);
      if (i < 0) return send(res, 404, { error: "Ky material nuk ekziston më." });
      const [old] = db.materials.splice(i, 1); saveDb(db); removeUnusedAssets(assetsOf(old));
      return send(res, 200, { ok: true });
    }

    // --- ngarkimi i skedarëve ---
    if (p === "/api/upload" && req.method === "POST") {
      const name = str(url.searchParams.get("name"), 200);
      const ext = (name.toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1];
      if (!ext || !TYPES[ext]) return send(res, 415, { error: "Ky lloj skedari nuk lejohet. Përdorni PDF, Word, PowerPoint, Excel, foto, TXT ose ZIP." });
      const buf = await readBody(req, MAX_UPLOAD);
      if (!buf.length) return send(res, 400, { error: "Skedari është bosh." });
      const id = newId() + "." + ext;
      fs.writeFileSync(path.join(UPLOAD_DIR, id), buf);
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
    if (req.method === "GET") {
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
  console.log(`\n  Sinapsa po punon!  Hapeni në shfletues:  http://localhost:${PORT}\n`);
});
