// Sinapsa – krijimi automatik i kartave dhe kuizeve me AI.
// Punon me njërin nga këta çelësa (vendosen te Render → Environment):
//   GEMINI_API_KEY     – Google Gemini (ka nivel falas)
//   ANTHROPIC_API_KEY  – Claude nga Anthropic (me pagesë sipas përdorimit)
// Opsionale: AI_MODEL (për të zgjedhur një model tjetër), AI_DAILY_LIMIT (sa krijime në ditë, parazgjedhur 100).

const fs = require("fs");
const zlib = require("zlib");

const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
const CLAUDE_KEY = process.env.ANTHROPIC_API_KEY || "";
const MOCK = process.env.AI_MOCK === "1"; // vetëm për prova, pa AI të vërtetë
const PROVIDER = GEMINI_KEY ? "gemini" : CLAUDE_KEY ? "claude" : MOCK ? "mock" : null;
const MODEL = process.env.AI_MODEL || (PROVIDER === "gemini" ? "gemini-3.5-flash" : "claude-haiku-4-5-20251001");
const MAX_AI_BYTES = 20 * 1024 * 1024; // kufiri i skedarëve që i dërgohen AI-së
const MAX_TEXT = 150000;

// ---------- leximi i skedarëve ----------
// Lexues i vogël ZIP (docx, pptx, odt, odp janë arkiva ZIP me XML brenda)
function unzip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("zip");
  const count = buf.readUInt16LE(eocd + 10); let p = buf.readUInt32LE(eocd + 16);
  const out = {};
  for (let n = 0; n < count && p + 46 <= buf.length; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20);
    const nlen = buf.readUInt16LE(p + 28), elen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42), name = buf.toString("utf8", p + 46, p + 46 + nlen);
    p += 46 + nlen + elen + clen;
    if (!/\.xml$/.test(name)) continue;
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = buf.subarray(start, start + csize);
    try { out[name] = (method === 8 ? zlib.inflateRawSync(data) : data).toString("utf8"); } catch {}
  }
  return out;
}
const decode = s => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&amp;/g, "&");
const xmlText = (xml, paraTag) => decode(xml.replace(new RegExp(`</${paraTag}>`, "g"), "\n").replace(/<[^>]+>/g, "")).replace(/\n{3,}/g, "\n\n").trim();

function extractText(buf, ext) {
  if (ext === "txt" || ext === "csv") return buf.toString("utf8");
  const files = unzip(buf);
  if (ext === "docx") return xmlText(files["word/document.xml"] || "", "w:p");
  if (ext === "pptx") {
    return Object.keys(files).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n))
      .sort((a, b) => +a.match(/\d+/)[0] - +b.match(/\d+/)[0])
      .map((n, i) => `--- Slajdi ${i + 1} ---\n` + xmlText(files[n], "a:p")).join("\n\n");
  }
  if (ext === "odt" || ext === "odp") return xmlText(files["content.xml"] || "", "text:p");
  return "";
}
const AI_EXT = new Set(["pdf", "png", "jpg", "jpeg", "gif", "webp", "docx", "pptx", "odt", "odp", "txt"]);
const MIME = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp" };

// Kthen listën e "pjesëve" që i dërgohen AI-së: dokumente, foto ose tekst
function prepareInputs(paths) {
  const parts = []; let total = 0;
  for (const { file, ext, name } of paths) {
    if (!AI_EXT.has(ext)) throw Object.assign(new Error(`“${name}” nuk mund të lexohet nga AI. Përdorni PDF, foto, Word (.docx), PowerPoint (.pptx) ose tekst. Skedarët e vjetër .doc/.ppt ruajini si PDF.`), { status: 400 });
    const buf = fs.readFileSync(file); total += buf.length;
    if (total > MAX_AI_BYTES) throw Object.assign(new Error("Skedarët janë shumë të mëdhenj për AI (deri në 20 MB gjithsej). Ndajeni PDF-në në pjesë më të vogla."), { status: 400 });
    if (MIME[ext]) parts.push({ kind: ext === "pdf" ? "pdf" : "image", mime: MIME[ext], data: buf.toString("base64") });
    else {
      let text; try { text = extractText(buf, ext); } catch { text = ""; }
      if (!text || text.trim().length < 40) throw Object.assign(new Error(`Nuk u gjet tekst te “${name}”. Provoni ta ruani si PDF.`), { status: 400 });
      parts.push({ kind: "text", text: `Përmbajtja e skedarit “${name}”:\n\n` + text.slice(0, MAX_TEXT) });
    }
  }
  return parts;
}

// ---------- udhëzimi dhe formati ----------
function instructions(count, language) {
  const lang = language === "doc" ? "the same language as the material (if it is Albanian, use standard Albanian)" : "standard Albanian (gjuha standarde shqipe), with correct ë and ç";
  const q = Math.min(count, 20);
  return `You are helping university students study for exams. From the attached study material, create:
1. Exactly ${count} flashcards (or fewer only if the material is very short). "term" is the front: a key term, concept, or short question (max ~12 words). "def" is the back: a clear, correct answer or definition in 1–2 sentences.
2. Exactly ${q} multiple-choice quiz questions (fewer only if the material is very short). Each has exactly 4 options, exactly one correct ("answer" is its index 0–3), plausible wrong options of similar length, and a one-sentence "explanation" of why the answer is correct. Vary the position of the correct answer.
3. A short "title" for the set (max 8 words), a one-sentence "description", and a "subject" (the course or topic name, 1–3 words).
Cover the most important, exam-relevant ideas across the whole material, not just the beginning. Use only facts supported by the material. Do not number the cards.
Write ALL text in ${lang}. Keep established scientific terms (e.g. Latin anatomical names) where appropriate.`;
}
const SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" }, description: { type: "string" }, subject: { type: "string" },
    cards: { type: "array", items: { type: "object", properties: { term: { type: "string" }, def: { type: "string" } }, required: ["term", "def"] } },
    quiz: { type: "array", items: { type: "object", properties: {
      q: { type: "string" }, options: { type: "array", items: { type: "string" } }, answer: { type: "integer" }, explanation: { type: "string" },
    }, required: ["q", "options", "answer"] } },
  },
  required: ["title", "cards", "quiz"],
};
const upper = s => JSON.parse(JSON.stringify(s).replace(/"type":"(\w+)"/g, (_, t) => `"type":"${t.toUpperCase()}"`));

// ---------- thirrjet te AI ----------
let geminiModel = MODEL; // ndryshon vetë nëse ky model nuk funksionon
const JSON_SHAPE = `Return ONLY a JSON object, no other text, in exactly this shape:
{"title":"...","description":"...","subject":"...","cards":[{"term":"...","def":"..."}],"quiz":[{"q":"...","options":["...","...","...","..."],"answer":0,"explanation":"..."}]}`;
async function geminiRequest(model, parts, prompt, withSchema) {
  const body = {
    contents: [{ role: "user", parts: [
      ...parts.map(p => p.kind === "text" ? { text: p.text } : { inlineData: { mimeType: p.mime, data: p.data } }),
      { text: withSchema ? prompt : prompt + "\n\n" + JSON_SHAPE },
    ] }],
    generationConfig: Object.assign({ responseMimeType: "application/json", temperature: 0.4, maxOutputTokens: 32768 }, withSchema ? { responseSchema: upper(SCHEMA) } : {}),
  };
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_KEY }, body: JSON.stringify(body),
      signal: AbortSignal.timeout(150000),
    });
    const j = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, j, msg: (j.error && j.error.message) || "" };
  } catch (e) { return { ok: false, status: 504, j: {}, msg: e.name === "TimeoutError" ? "koha mbaroi" : e.message }; }
}
// Lista e modeleve "flash" që ka ky çelës (ruhet për 6 orë)
let modelCache = null, modelCacheAt = 0;
async function listGeminiModels() {
  if (modelCache && Date.now() - modelCacheAt < 6 * 3600000) return modelCache;
  try {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", { headers: { "x-goog-api-key": GEMINI_KEY }, signal: AbortSignal.timeout(20000) });
    const j = await r.json().catch(() => ({}));
    const names = (j.models || []).filter(m => (m.supportedGenerationMethods || []).includes("generateContent"))
      .map(m => String(m.name || "").replace(/^models\//, ""))
      .filter(n => /^gemini-[\d.]+-flash(-lite)?$/.test(n) || n === "gemini-flash-latest" || n === "gemini-flash-lite-latest");
    const ver = n => parseFloat((n.match(/gemini-([\d.]+)/) || [])[1] || "0");
    names.sort((a, b) => (/lite/.test(a) - /lite/.test(b)) || ver(b) - ver(a));
    console.log("AI: modelet e disponueshme:", names.join(", ") || "(asnjë)", r.ok ? "" : `(gabim ${r.status})`);
    if (names.length) { modelCache = names; modelCacheAt = Date.now(); }
    return names;
  } catch (e) { console.error("AI: lista e modeleve dështoi:", e.message); return []; }
}
// Provon modelin kryesor; nëse Google ka probleme, provon format më të thjeshtë dhe pastaj modele të tjera
async function callGemini(parts, prompt) {
  const others = (await listGeminiModels()).filter(n => n !== geminiModel);
  const models = [geminiModel, ...others].slice(0, 4);
  let last = null;
  for (const model of models) {
    for (const withSchema of [true, false]) {
      const res = await geminiRequest(model, parts, prompt, withSchema);
      if (res.ok) {
        const cand = (res.j.candidates || [])[0] || {};
        const text = ((cand.content || {}).parts || []).filter(p => !p.thought).map(p => p.text || "").join("");
        if (!text) {
          const why = (res.j.promptFeedback && res.j.promptFeedback.blockReason) || cand.finishReason || "bosh";
          console.error(`AI: ${model} ktheu përgjigje pa tekst:`, why);
          last = { status: 422, msg: `përgjigje pa tekst (${why})` };
          if (why === "SAFETY" || why === "PROHIBITED_CONTENT" || why === "OTHER") break;
          continue;
        }
        try {
          const out = parseJson(text);
          if (model !== geminiModel) { console.log(`AI: po përdor ${model} në vend të ${geminiModel}`); geminiModel = model; }
          return out;
        } catch (e) { console.error(`AI: ${model} ktheu JSON të paplotë (finishReason=${cand.finishReason})`); last = { status: 502, msg: "përgjigje e paplotë" }; continue; }
      }
      console.error(`AI error ${res.status} (${model}${withSchema ? ", me skemë" : ", pa skemë"}):`, res.msg);
      last = res;
      if (res.status === 401 || res.status === 403 || res.status === 413) throw providerError(res.status, res.msg);
      if (res.status === 404 || res.status === 429) break; // ky model nuk shërben: provo tjetrin
    }
  }
  throw providerError(last ? last.status : 502, last && last.msg);
}
async function callClaude(parts, prompt) {
  const content = parts.map(p => p.kind === "text" ? { type: "text", text: p.text }
    : p.kind === "pdf" ? { type: "document", source: { type: "base64", media_type: p.mime, data: p.data } }
    : { type: "image", source: { type: "base64", media_type: p.mime, data: p.data } });
  content.push({ type: "text", text: prompt });
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": CLAUDE_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: MODEL, max_tokens: 16000, messages: [{ role: "user", content }],
      tools: [{ name: "save_study_set", description: "Save the generated flashcards and quiz.", input_schema: SCHEMA }],
      tool_choice: { type: "tool", name: "save_study_set" },
    }),
    signal: AbortSignal.timeout(170000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw providerError(r.status, j.error && j.error.message);
  const tool = (j.content || []).find(c => c.type === "tool_use");
  if (!tool) throw Object.assign(new Error("AI nuk ktheu rezultat."), { status: 502, transient: true });
  return tool.input;
}
function providerError(status, msg) {
  console.error("AI error", status, msg);
  const d = msg ? ` [Google: ${String(msg).slice(0, 140)}]` : "";
  const e = (text, st, transient) => Object.assign(new Error(text), { status: st, transient: !!transient, code: status });
  if (status === 429) return e("AI është e zënë për momentin (shumë kërkesa)." + d, 429, true);
  if (status === 401 || status === 403) return e("Çelësi i AI-së nuk është i vlefshëm ose nuk ka leje. Kontrolloni GEMINI_API_KEY / ANTHROPIC_API_KEY te Render." + d, 400);
  if (status === 404) return e("Modeli i AI-së nuk u gjet për këtë çelës." + d, 400);
  if (status === 413) return e("Skedari është shumë i madh për AI. Provoni një pjesë më të vogël.", 400);
  if (status === 400) return e("AI nuk e pranoi këtë skedar." + d, 400);
  if (status === 422) return e("AI nuk ktheu përmbajtje për këtë skedar." + d, 422);
  if (status >= 500) return e("Shërbimi i AI-së ka probleme për momentin." + d, 502, true);
  return e(`AI ktheu gabim (kodi ${status}).` + d, 502);
}
function parseJson(text) {
  try { return JSON.parse(text); } catch {}
  const m = text.match(/\{[\s\S]*\}/); if (m) { try { return JSON.parse(m[0]); } catch {} }
  throw Object.assign(new Error("AI ktheu një përgjigje të paplotë."), { status: 502, transient: true });
}
async function mock() {
  await new Promise(r => setTimeout(r, +process.env.AI_MOCK_MS || 9000));
  return {
    title: "Zemra – anatomia dhe qarkullimi", subject: "Fiziologjia", description: "Konceptet kryesore për zemrën dhe qarkullimin e gjakut.",
    cards: [
      ["Miokardi", "Shtresa muskulore e zemrës që tkurret për të shtyrë gjakun."], ["Nyja sinoatriale", "Stimuluesi natyral i zemrës; nis çdo rrahje në atriumin e djathtë."],
      ["Valvula mitrale", "Valvula ndërmjet atriumit të majtë dhe ventrikulit të majtë."], ["Sistola", "Faza kur ventrikujt tkurren dhe e nxjerrin gjakun nga zemra."],
      ["Diastola", "Faza kur zemra relaksohet dhe dhomat mbushen me gjak."], ["Aorta", "Arteria më e madhe; çon gjakun e oksigjenuar nga ventrikuli i majtë në trup."],
      ["Vena kava", "Venat që sjellin gjakun e deoksigjenuar në atriumin e djathtë."], ["Debiti kardiak", "Sasia e gjakut që zemra pompon në minutë (frekuenca × vëllimi goditës)."],
    ].map(([term, def]) => ({ term, def })),
    quiz: [
      { q: "Ku fillon normalisht impulsi elektrik i zemrës?", options: ["Nyja atrioventrikulare", "Nyja sinoatriale", "Tufa e His-it", "Fibrat e Purkinjes"], answer: 1, explanation: "Nyja sinoatriale është stimuluesi natyral i zemrës." },
      { q: "Cila valvulë ndodhet ndërmjet atriumit të majtë dhe ventrikulit të majtë?", options: ["Trikuspidale", "Pulmonare", "Mitrale", "Aortale"], answer: 2, explanation: "Valvula mitrale (bikuspidale) ndan atriumin e majtë nga ventrikuli i majtë." },
      { q: "Çfarë ndodh gjatë sistolës?", options: ["Ventrikujt tkurren", "Atriumet relaksohen dhe mbushen", "Valvulat mbyllen të gjitha", "Zemra pushon"], answer: 0, explanation: "Në sistolë ventrikujt tkurren dhe e nxjerrin gjakun." },
      { q: "Cila enë e çon gjakun e oksigjenuar në trup?", options: ["Vena kava", "Arteria pulmonare", "Vena pulmonare", "Aorta"], answer: 3, explanation: "Aorta del nga ventrikuli i majtë dhe e shpërndan gjakun në trup." },
      { q: "Debiti kardiak është i barabartë me:", options: ["Frekuenca × vëllimi goditës", "Presioni × rezistenca", "Vëllimi goditës ÷ frekuenca", "Frekuenca + presioni"], answer: 0, explanation: "DK = frekuenca e zemrës × vëllimi goditës." },
      { q: "Cila shtresë e zemrës tkurret?", options: ["Perikardi", "Endokardi", "Miokardi", "Epikardi"], answer: 2, explanation: "Miokardi është shtresa muskulore." },
    ],
  };
}

// ---------- pastrimi i rezultatit ----------
const s = (v, n) => String(v == null ? "" : v).trim().slice(0, n);
function clean(out) {
  const cards = (Array.isArray(out.cards) ? out.cards : []).map(c => ({ term: s(c && c.term, 300), def: s(c && c.def, 1200) })).filter(c => c.term && c.def).slice(0, 60);
  const quiz = (Array.isArray(out.quiz) ? out.quiz : []).map(x => {
    const options = (Array.isArray(x && x.options) ? x.options : []).map(o => s(o, 300)).filter(Boolean).slice(0, 4);
    const answer = Number.isInteger(x && x.answer) ? x.answer : parseInt(x && x.answer, 10);
    return { q: s(x && x.q, 500), options, answer, explanation: s(x && x.explanation, 600) };
  }).filter(x => x.q && x.options.length === 4 && x.answer >= 0 && x.answer < 4).slice(0, 30);
  if (cards.length < 2) throw Object.assign(new Error("AI nuk gjeti mjaftueshëm përmbajtje për karta. Provoni një skedar me më shumë tekst."), { status: 422 });
  return { title: s(out.title, 120) || "Set i krijuar me AI", description: s(out.description, 500), subject: s(out.subject, 60), cards, quiz };
}

async function generate(files, { count = 15, language = "sq" } = {}) {
  if (!PROVIDER) throw Object.assign(new Error("AI nuk është aktivizuar ende në këtë faqe."), { status: 503 });
  const n = [10, 15, 20, 30].includes(+count) ? +count : 15;
  const parts = PROVIDER === "mock" ? [] : prepareInputs(files);
  const prompt = instructions(n, language);
  const out = PROVIDER === "gemini" ? await callGemini(parts, prompt) : PROVIDER === "claude" ? await callClaude(parts, prompt) : await mock();
  return clean(out);
}

if (PROVIDER === "gemini") setTimeout(() => listGeminiModels(), 1500); // shfaq te Logs cilat modele janë të disponueshme

module.exports = { generate, enabled: !!PROVIDER, provider: PROVIDER, get model() { return PROVIDER === "gemini" ? geminiModel : MODEL; }, AI_EXT };
