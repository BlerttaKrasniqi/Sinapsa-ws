// Sinapsa – krijimi i kartave, kuizeve dhe lojërave me AI.
// Punon me njërin nga këta çelësa (vendosen te Render → Environment):
//   GEMINI_API_KEY     – Google Gemini (rekomandohet; aktivizoni faturimin për nivelin me pagesë)
//   ANTHROPIC_API_KEY  – Claude nga Anthropic
// Opsionale: AI_MODEL (për të zgjedhur një model tjetër).

const fs = require("fs");
const zlib = require("zlib");

const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
const CLAUDE_KEY = process.env.ANTHROPIC_API_KEY || "";
const MOCK = process.env.AI_MOCK === "1"; // vetëm për prova, pa AI të vërtetë
const PROVIDER = GEMINI_KEY ? "gemini" : CLAUDE_KEY ? "claude" : MOCK ? "mock" : null;
const MODEL = process.env.AI_MODEL || (PROVIDER === "gemini" ? "gemini-3.8-flash" : "claude-haiku-4-5-20251001");
const MAX_AI_BYTES = 40 * 1024 * 1024; // gjithsej për një set
const MAX_TEXT = 400000;
const MAX_OUT = 48000;

// ---------- leximi i skedarëve ----------
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
const err = (msg, status, extra) => Object.assign(new Error(msg), { status }, extra || {});

// Të gjithë skedarët e një ngarkimi bashkohen në një material të vetëm për AI-në
function prepareInputs(paths) {
  const parts = []; let total = 0;
  paths.forEach(({ file, ext, name }, i) => {
    if (!AI_EXT.has(ext)) throw err(`“${name}” nuk mund të lexohet nga AI. Përdorni PDF, foto, Word (.docx), PowerPoint (.pptx) ose tekst. Skedarët e vjetër .doc/.ppt ruajini si PDF.`, 400);
    const buf = fs.readFileSync(file); total += buf.length;
    if (total > MAX_AI_BYTES) throw err("Skedarët janë shumë të mëdhenj për AI (deri në 40 MB gjithsej). Ndajeni materialin në dy pjesë.", 400);
    parts.push({ kind: "text", text: `--- Pjesa ${i + 1}: “${name}” ---` });
    if (MIME[ext]) parts.push({ kind: ext === "pdf" ? "pdf" : "image", mime: MIME[ext], data: buf.toString("base64") });
    else {
      let text; try { text = extractText(buf, ext); } catch { text = ""; }
      if (!text || text.trim().length < 40) throw err(`Nuk u gjet tekst te “${name}”. Provoni ta ruani si PDF.`, 400);
      parts.push({ kind: "text", text: text.slice(0, MAX_TEXT) });
    }
  });
  return parts;
}

// ---------- udhëzimet ----------
function audience(o) {
  if (o.level === "school") {
    const g = +o.grade || 5;
    return `The learners are school children in grade ${g} (about ${g + 5}–${g + 6} years old). Use very simple words, short sentences and a friendly, encouraging tone. Avoid jargon unless it is the word being learned.`;
  }
  return "The learners are university students preparing for exams. Be precise and exam-oriented.";
}
function langLine(o) {
  return o.language === "doc"
    ? "Write ALL text in the same language as the material (if it is Albanian, use standard Albanian with correct ë and ç)."
    : "Write ALL text in standard Albanian (gjuha standarde shqipe) with correct ë and ç. Keep established scientific terms (e.g. Latin anatomical names) where appropriate.";
}
function cardsPrompt(o) {
  return `You are an expert teacher. The attached material may consist of several parts (pages, photos, files); treat them together as ONE material and make ONE study set from all of them.
${audience(o)}
Create:
1. FLASHCARDS that cover the ENTIRE material from beginning to end – every important fact, definition, term, name, date, number, formula, classification, cause/effect and process step. Do not skip later parts. Create as many as the material needs: roughly one card per 40–80 words of content (a 1-page handout ≈ 10–20 cards, 5 dense pages or photos ≈ 60–120, a long chapter ≈ 150–250). Minimum 6, maximum 250. "term" (front) is a short term, concept or question (max ~14 words); "def" (back) is a correct, self-contained answer in 1–2 sentences.
2. FILL-IN-THE-BLANK sentences: about one for every three flashcards (minimum 4, maximum 70). Each "s" is a short sentence from the material's key facts where the key word or phrase is replaced by "____" (exactly four underscores, once). "a" is the missing word or short phrase.
3. "title" (max 8 words), "description" (one sentence) and "subject" (course or topic name, 1–3 words).
Use only facts supported by the material. No numbering.
${langLine(o)}`;
}
function quizPrompt(o) {
  return `You are an expert teacher. The attached material may consist of several parts; treat them together as ONE material.
${audience(o)}
Create multiple-choice QUIZ questions that test the ENTIRE material from beginning to end, about one question for every two important facts (minimum 6, maximum 90). Each question has exactly 4 options, exactly one correct ("answer" is its index 0–3), plausible wrong options of similar length and style, and a one-sentence "explanation". Vary the position of the correct answer. Mix recall, understanding and application questions.
Use only facts supported by the material. No numbering.
${langLine(o)}`;
}
const CARDS_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" }, description: { type: "string" }, subject: { type: "string" },
    cards: { type: "array", items: { type: "object", properties: { term: { type: "string" }, def: { type: "string" } }, required: ["term", "def"] } },
    fills: { type: "array", items: { type: "object", properties: { s: { type: "string" }, a: { type: "string" } }, required: ["s", "a"] } },
  },
  required: ["title", "cards", "fills"],
};
const QUIZ_SCHEMA = {
  type: "object",
  properties: { quiz: { type: "array", items: { type: "object", properties: {
    q: { type: "string" }, options: { type: "array", items: { type: "string" } }, answer: { type: "integer" }, explanation: { type: "string" },
  }, required: ["q", "options", "answer"] } } },
  required: ["quiz"],
};
const SHAPES = {
  cards: `Return ONLY a JSON object: {"title":"...","description":"...","subject":"...","cards":[{"term":"...","def":"..."}],"fills":[{"s":"... ____ ...","a":"..."}]}`,
  quiz: `Return ONLY a JSON object: {"quiz":[{"q":"...","options":["...","...","...","..."],"answer":0,"explanation":"..."}]}`,
};
const upper = s => JSON.parse(JSON.stringify(s).replace(/"type":"(\w+)"/g, (_, t) => `"type":"${t.toUpperCase()}"`));

// ---------- Gemini ----------
let geminiModel = MODEL;
async function geminiRequest(model, parts, prompt, schema, shape) {
  const body = {
    contents: [{ role: "user", parts: [
      ...parts.map(p => p.kind === "text" ? { text: p.text } : { inlineData: { mimeType: p.mime, data: p.data } }),
      { text: schema ? prompt : prompt + "\n\n" + shape },
    ] }],
    generationConfig: Object.assign({ responseMimeType: "application/json", temperature: 0.4, maxOutputTokens: MAX_OUT }, schema ? { responseSchema: upper(schema) } : {}),
  };
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_KEY }, body: JSON.stringify(body),
      signal: AbortSignal.timeout(280000),
    });
    const j = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, j, msg: (j.error && j.error.message) || "" };
  } catch (e) { return { ok: false, status: 504, j: {}, msg: e.name === "TimeoutError" ? "koha mbaroi" : e.message }; }
}
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
async function callGemini(parts, prompt, schema, shape) {
  const others = (await listGeminiModels()).filter(n => n !== geminiModel);
  const models = [geminiModel, ...others].slice(0, 4);
  let last = null;
  for (const model of models) {
    for (const useSchema of [true, false]) {
      const res = await geminiRequest(model, parts, prompt, useSchema ? schema : null, shape);
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
      console.error(`AI error ${res.status} (${model}${useSchema ? ", me skemë" : ", pa skemë"}):`, res.msg);
      last = res;
      if (res.status === 401 || res.status === 403 || res.status === 413) throw providerError(res.status, res.msg);
      if (res.status === 404 || res.status === 429) break;
    }
  }
  throw providerError(last ? last.status : 502, last && last.msg);
}

// ---------- Claude ----------
async function callClaude(parts, prompt, schema) {
  const content = parts.map(p => p.kind === "text" ? { type: "text", text: p.text }
    : p.kind === "pdf" ? { type: "document", source: { type: "base64", media_type: p.mime, data: p.data } }
    : { type: "image", source: { type: "base64", media_type: p.mime, data: p.data } });
  content.push({ type: "text", text: prompt });
  let r, j;
  try {
    r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": CLAUDE_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: MODEL, max_tokens: 32000, messages: [{ role: "user", content }],
        tools: [{ name: "save", description: "Save the generated study content.", input_schema: schema }],
        tool_choice: { type: "tool", name: "save" },
      }),
      signal: AbortSignal.timeout(280000),
    });
    j = await r.json().catch(() => ({}));
  } catch (e) { throw providerError(504, e.message); }
  if (!r.ok) throw providerError(r.status, j.error && j.error.message);
  const tool = (j.content || []).find(c => c.type === "tool_use");
  if (!tool) throw err("AI nuk ktheu rezultat.", 502, { transient: true });
  return tool.input;
}

function providerError(status, msg) {
  console.error("AI error", status, msg);
  const d = msg ? ` [AI: ${String(msg).slice(0, 140)}]` : "";
  if (status === 429) return err("AI është e zënë për momentin (shumë kërkesa)." + d, 429, { transient: true });
  if (status === 401 || status === 403) return err("Çelësi i AI-së nuk është i vlefshëm ose nuk ka leje." + d, 400);
  if (status === 404) return err("Modeli i AI-së nuk u gjet për këtë çelës." + d, 400);
  if (status === 413) return err("Materiali është shumë i madh për AI. Ndajeni në dy pjesë.", 400);
  if (status === 400) return err("AI nuk e pranoi këtë material." + d, 400);
  if (status === 422) return err("AI nuk ktheu përmbajtje për këtë material." + d, 422);
  if (status >= 500) return err("Shërbimi i AI-së ka probleme për momentin." + d, 502, { transient: true });
  return err(`AI ktheu gabim (kodi ${status}).` + d, 502);
}
function parseJson(text) {
  try { return JSON.parse(text); } catch {}
  const m = text.match(/\{[\s\S]*\}/); if (m) { try { return JSON.parse(m[0]); } catch {} }
  throw err("AI ktheu një përgjigje të paplotë.", 502, { transient: true });
}

// ---------- prova pa AI ----------
async function mock(kind) {
  await new Promise(r => setTimeout(r, +process.env.AI_MOCK_MS || 6000));
  if (kind === "quiz") return { quiz: [
    { q: "Ku fillon normalisht impulsi elektrik i zemrës?", options: ["Nyja atrioventrikulare", "Nyja sinoatriale", "Tufa e His-it", "Fibrat e Purkinjes"], answer: 1, explanation: "Nyja sinoatriale është stimuluesi natyral i zemrës." },
    { q: "Cila valvulë ndodhet ndërmjet atriumit të majtë dhe ventrikulit të majtë?", options: ["Trikuspidale", "Pulmonare", "Mitrale", "Aortale"], answer: 2, explanation: "Valvula mitrale ndan atriumin e majtë nga ventrikuli i majtë." },
    { q: "Çfarë ndodh gjatë sistolës?", options: ["Ventrikujt tkurren", "Atriumet relaksohen dhe mbushen", "Valvulat mbyllen të gjitha", "Zemra pushon"], answer: 0, explanation: "Në sistolë ventrikujt tkurren dhe e nxjerrin gjakun." },
    { q: "Cila enë e çon gjakun e oksigjenuar në trup?", options: ["Vena kava", "Arteria pulmonare", "Vena pulmonare", "Aorta"], answer: 3, explanation: "Aorta del nga ventrikuli i majtë." },
    { q: "Debiti kardiak është i barabartë me:", options: ["Frekuenca × vëllimi goditës", "Presioni × rezistenca", "Vëllimi goditës ÷ frekuenca", "Frekuenca + presioni"], answer: 0, explanation: "DK = frekuenca × vëllimi goditës." },
    { q: "Cila shtresë e zemrës tkurret?", options: ["Perikardi", "Endokardi", "Miokardi", "Epikardi"], answer: 2, explanation: "Miokardi është shtresa muskulore." },
  ] };
  return {
    title: "Zemra – anatomia dhe qarkullimi", subject: "Fiziologjia", description: "Konceptet kryesore për zemrën dhe qarkullimin e gjakut.",
    cards: [
      ["Miokardi", "Shtresa muskulore e zemrës që tkurret për të shtyrë gjakun."], ["Nyja sinoatriale", "Stimuluesi natyral i zemrës; nis çdo rrahje në atriumin e djathtë."],
      ["Valvula mitrale", "Valvula ndërmjet atriumit të majtë dhe ventrikulit të majtë."], ["Sistola", "Faza kur ventrikujt tkurren dhe e nxjerrin gjakun nga zemra."],
      ["Diastola", "Faza kur zemra relaksohet dhe dhomat mbushen me gjak."], ["Aorta", "Arteria më e madhe; çon gjakun e oksigjenuar nga ventrikuli i majtë në trup."],
      ["Vena kava", "Venat që sjellin gjakun e deoksigjenuar në atriumin e djathtë."], ["Debiti kardiak", "Sasia e gjakut që zemra pompon në minutë (frekuenca × vëllimi goditës)."],
    ].map(([term, def]) => ({ term, def })),
    fills: [
      { s: "Stimuluesi natyral i zemrës është nyja ____.", a: "sinoatriale" },
      { s: "Gjatë ____ ventrikujt tkurren.", a: "sistolës" },
      { s: "Arteria më e madhe e trupit është ____.", a: "aorta" },
      { s: "Shtresa muskulore e zemrës quhet ____.", a: "miokard" },
      { s: "Valvula ____ ndodhet ndërmjet atriumit të majtë dhe ventrikulit të majtë.", a: "mitrale" },
    ],
  };
}

// ---------- pastrimi ----------
const s = (v, n) => String(v == null ? "" : v).trim().slice(0, n);
function cleanCards(out) {
  const cards = (Array.isArray(out.cards) ? out.cards : []).map(c => ({ term: s(c && c.term, 300), def: s(c && c.def, 1200) })).filter(c => c.term && c.def).slice(0, 300);
  const fills = (Array.isArray(out.fills) ? out.fills : []).map(f => ({ s: s(f && f.s, 400).replace(/_{3,}/, "____"), a: s(f && f.a, 80) }))
    .filter(f => f.a && f.s.includes("____")).slice(0, 90);
  if (cards.length < 2) throw err("AI nuk gjeti mjaftueshëm përmbajtje për karta. Provoni një material me më shumë tekst.", 422);
  return { title: s(out.title, 120) || "Set i krijuar me AI", description: s(out.description, 500), subject: s(out.subject, 60), cards, fills };
}
function cleanQuiz(out) {
  return (Array.isArray(out.quiz) ? out.quiz : []).map(x => {
    const options = (Array.isArray(x && x.options) ? x.options : []).map(o => s(o, 300)).filter(Boolean).slice(0, 4);
    const answer = Number.isInteger(x && x.answer) ? x.answer : parseInt(x && x.answer, 10);
    return { q: s(x && x.q, 500), options, answer, explanation: s(x && x.explanation, 600) };
  }).filter(x => x.q && x.options.length === 4 && x.answer >= 0 && x.answer < 4).slice(0, 100);
}

// Krijon një set të vetëm nga të gjithë skedarët: karta + plotëso + kuiz
async function generateSet(files, opts = {}) {
  if (!PROVIDER) throw err("AI nuk është aktivizuar ende në këtë faqe.", 503);
  const parts = PROVIDER === "mock" ? [] : prepareInputs(files);
  const call = (prompt, schema, shape, kind) => PROVIDER === "gemini" ? callGemini(parts, prompt, schema, shape)
    : PROVIDER === "claude" ? callClaude(parts, prompt, schema) : mock(kind);
  const base = cleanCards(await call(cardsPrompt(opts), CARDS_SCHEMA, SHAPES.cards, "cards"));
  let quiz = [];
  try { quiz = cleanQuiz(await call(quizPrompt(opts), QUIZ_SCHEMA, SHAPES.quiz, "quiz")); }
  catch (e) { console.error("AI: kuizi nuk u krijua, vazhdoj vetëm me kartat:", e.message); }
  return Object.assign(base, { quiz });
}

if (PROVIDER === "gemini") setTimeout(() => listGeminiModels(), 1500);

module.exports = { generateSet, enabled: !!PROVIDER, provider: PROVIDER, get model() { return PROVIDER === "gemini" ? geminiModel : MODEL; }, AI_EXT, MAX_AI_BYTES };
