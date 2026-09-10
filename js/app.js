// ===================== Utilidades =====================
const $ = (sel, ctx) => (ctx || document).querySelector(sel);
const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

function getJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) { return fallback; }
}
function setJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore quota errors */ }
}
function pad(n) { return String(n).padStart(2, '0'); }
function dateStr(d) {
  d = d || new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function wordCount(text) {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}
function pickRandom(arr) {
  if (!arr || !arr.length) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

// ===================== Corrección de escritura con IA externa =====================
function buildCorrectionPrompt(p, text) {
  return `Eres un examinador certificado de DELE B2 (Instituto Cervantes). Corrige el siguiente texto de Expresión Escrita según los criterios oficiales del DELE B2:
1. Adecuación al contexto (tipo de texto, registro, destinatario)
2. Coherencia y cohesión (organización de las ideas, uso de conectores)
3. Corrección gramatical y ortográfica
4. Riqueza y variedad léxica

TAREA: ${p.enunciado}
Tipo de texto: ${p.tipo}
Extensión requerida: ${p.palabrasMin}-${p.palabrasMax} palabras

TEXTO DEL ALUMNO:
"${text}"

Por favor, dame:
- Una valoración aproximada de si este texto alcanzaría el nivel B2 (sí / con matices / no todavía) y por qué, en 2-3 frases.
- Los 3-5 errores más importantes a corregir (cita la frase original, la corrección propuesta y una breve explicación).
- 2-3 sugerencias concretas para enriquecer el vocabulario o mejorar la cohesión.
- Un comentario final breve y motivador.

Sé claro, constructivo y concreto. No hace falta que reescribas el texto entero, céntrate en lo más importante.`;
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    // Alternativa para navegadores sin acceso al portapapeles moderno
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      return true;
    } catch (err2) {
      return false;
    }
  }
}

function showCorrectionHelp() {
  const overlay = document.createElement('div');
  overlay.className = 'motivation-overlay';
  overlay.innerHTML = `
    <div class="motivation-card" style="max-width:360px;">
      <div class="motivation-emoji">🤖</div>
      <p><strong>¡Copiado!</strong> Pégalo en tu IA favorita (Claude, ChatGPT...) y te dará la corrección al momento.</p>
      <div class="grid-2" style="margin-bottom:10px;">
        <a href="https://claude.ai" target="_blank" rel="noopener" class="btn small">Abrir Claude</a>
        <a href="https://chatgpt.com" target="_blank" rel="noopener" class="btn small secondary">Abrir ChatGPT</a>
      </div>
      <button class="btn small secondary" id="correctionClose">Cerrar</button>
    </div>`;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.querySelector('#correctionClose').addEventListener('click', close);
}

// ===================== Mensajes motivacionales =====================
let lastGreetingIndex = -1;
function pickGreeting() {
  const arr = DATA.motivation && DATA.motivation.greetings;
  if (!arr || !arr.length) return '¡Vamos con el repaso!';
  let idx = Math.floor(Math.random() * arr.length);
  if (arr.length > 1 && idx === lastGreetingIndex) idx = (idx + 1) % arr.length;
  lastGreetingIndex = idx;
  return arr[idx];
}

let motivationQueue = [];
let motivationShowing = false;
function queueMotivation(text) {
  if (!text) return;
  motivationQueue.push(text);
  if (!motivationShowing) showNextMotivation();
}
function showNextMotivation() {
  if (motivationQueue.length === 0) { motivationShowing = false; return; }
  motivationShowing = true;
  const text = motivationQueue.shift();
  const overlay = document.createElement('div');
  overlay.className = 'motivation-overlay';
  overlay.innerHTML = `
    <div class="motivation-card">
      <div class="motivation-emoji">✨</div>
      <p>${escapeHtml(text)}</p>
      <button class="btn small" id="motivationClose">¡Vale! 😊</button>
    </div>`;
  document.body.appendChild(overlay);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    overlay.remove();
    showNextMotivation();
  };
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.querySelector('#motivationClose').addEventListener('click', close);
  setTimeout(close, 7000);
}

function checkWordsMasteredMilestone() {
  const milestones = DATA.motivation && DATA.motivation.wordsMasteredMilestones;
  if (!milestones) return;
  const srs = getSrsState();
  const masteredCount = Object.values(srs).filter((s) => s.box >= 3).length;
  const key = String(masteredCount);
  if (!milestones[key]) return;
  const seen = getJSON('dele_milestones_seen', {});
  const seenKey = 'words_' + key;
  if (seen[seenKey]) return;
  seen[seenKey] = true;
  setJSON('dele_milestones_seen', seen);
  queueMotivation(milestones[key]);
}

// ===================== Detección de plataforma / instalación =====================
const UA = navigator.userAgent || '';
const isIOS = /iphone|ipad|ipod/i.test(UA) && !window.MSStream;
// Navegadores integrados en apps (WhatsApp, Gmail, Instagram, Facebook...) no completan
// la instalación aunque muestren el botón: hay que abrir el enlace en Chrome/Safari.
const isInAppBrowser = /(FBAN|FBAV|Instagram|Line\/|WhatsApp|; wv\))/i.test(UA) ||
  (/Version\/[\d.]+/.test(UA) && /iPhone|iPad/.test(UA) && !/Safari/.test(UA));
function isStandaloneMode() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}
function installHelpHtml() {
  const steps = isIOS
    ? ['Abre este enlace en <strong>Safari</strong> (no en WhatsApp, Gmail u otra app).', 'Toca el icono de compartir 📤 en la barra inferior.', 'Elige "Añadir a pantalla de inicio".', 'Confirma tocando "Añadir".']
    : ['Abre este enlace en <strong>Chrome</strong> (no en WhatsApp, Gmail u otra app).', 'Toca el menú ⋮ (arriba a la derecha).', 'Elige "Instalar aplicación" o "Añadir a pantalla de inicio".', 'Confirma tocando "Instalar".'];
  return `
    <details class="card" id="installHelp">
      <summary style="cursor:pointer;font-weight:700;list-style:none;">📲 Instalar en el móvil</summary>
      <ol style="margin:10px 0 0;padding-left:20px;">${steps.map((s) => `<li style="margin-bottom:6px;">${s}</li>`).join('')}</ol>
      ${isInAppBrowser ? `<p class="quiz-explain" style="margin-top:10px;">⚠️ Parece que has abierto este enlace dentro de otra app. Toca el menú de esa app y elige "Abrir en ${isIOS ? 'Safari' : 'Chrome'}" antes de instalar; si no, el botón de instalar no funcionará.</p>` : ''}
    </details>`;
}

// ===================== Racha de estudio =====================
function touchStreak() {
  const s = getJSON('dele_streak', { lastDate: null, count: 0 });
  const today = dateStr();
  if (s.lastDate === today) { updateStreakBadge(); return s; }
  const yesterday = dateStr(new Date(Date.now() - 86400000));
  s.count = (s.lastDate === yesterday) ? s.count + 1 : 1;
  s.lastDate = today;
  setJSON('dele_streak', s);
  updateStreakBadge();
  const milestones = DATA.motivation && DATA.motivation.streakMilestones;
  if (milestones && milestones[String(s.count)]) queueMotivation(milestones[String(s.count)]);
  return s;
}
function updateStreakBadge() {
  const s = getJSON('dele_streak', { lastDate: null, count: 0 });
  const badge = $('#streakBadge');
  if (badge) badge.textContent = `🔥 ${s.count}`;
}

// ===================== Repaso de errores =====================
// Cualquier pregunta fallada en gramática, lectura o tiempos verbales se guarda aquí
// (indexada por un id único de la pregunta) y desaparece en cuanto se acierta.
function getMistakes() { return getJSON('dele_mistakes', {}); }
function saveMistakes(m) { setJSON('dele_mistakes', m); }
function recordMistake(id, data) {
  const m = getMistakes();
  const prev = m[id];
  m[id] = Object.assign({}, data, { mistakeId: id, veces: (prev ? prev.veces : 0) + 1, fecha: dateStr() });
  saveMistakes(m);
}
function clearMistake(id) {
  const m = getMistakes();
  if (m[id]) { delete m[id]; saveMistakes(m); }
}
function mistakeCount() { return Object.keys(getMistakes()).length; }
// Añade a cada pregunta un id único (y su tipo/contexto) para poder registrarla si se falla.
function withMistakeIds(items, prefix, tipo, contexto) {
  return items.map((it, i) => Object.assign({}, it, { mistakeId: `${prefix}-${i}`, mistakeTipo: tipo, mistakeContexto: contexto }));
}

// ===================== Datos =====================
const DATA = { vocab: [], vocabFlat: [], grammar: [], reading: [], writing: [], motivation: null, tenses: [], verbs: [] };

async function loadData() {
  const [vocab, grammar, reading, writing, motivation, tenses, verbs] = await Promise.all([
    fetch('data/vocab.json').then((r) => r.json()),
    fetch('data/grammar.json').then((r) => r.json()),
    fetch('data/reading.json').then((r) => r.json()),
    fetch('data/writing.json').then((r) => r.json()),
    fetch('data/motivation.json').then((r) => r.json()),
    fetch('data/tenses.json').then((r) => r.json()),
    fetch('data/verbs.json').then((r) => r.json())
  ]);
  DATA.vocab = vocab;
  DATA.grammar = grammar;
  DATA.reading = reading;
  DATA.writing = writing;
  DATA.motivation = motivation;
  DATA.tenses = tenses;
  DATA.verbs = verbs;
  DATA.vocabFlat = [];
  vocab.forEach((tema, ti) => {
    tema.palabras.forEach((w, wi) => {
      DATA.vocabFlat.push({ id: `t${ti}-w${wi}`, themeIndex: ti, tema: tema.tema, ...w });
    });
  });
}

// ===================== SRS (Leitner) para vocabulario =====================
const BOX_DAYS = [0, 1, 3, 7, 14, 30];

function getSrsState() { return getJSON('dele_vocab_srs', {}); }
function saveSrsState(s) { setJSON('dele_vocab_srs', s); }

function isDue(state, id) {
  const st = state[id];
  if (!st) return true;
  return st.next <= Date.now();
}

function getDueWords(themeIndex) {
  const state = getSrsState();
  let words = DATA.vocabFlat;
  if (themeIndex !== undefined && themeIndex !== null) {
    words = words.filter((w) => w.themeIndex === Number(themeIndex));
  }
  return words.filter((w) => isDue(state, w.id));
}

function themeStats(themeIndex) {
  const state = getSrsState();
  const words = DATA.vocabFlat.filter((w) => w.themeIndex === themeIndex);
  const mastered = words.filter((w) => state[w.id] && state[w.id].box >= 3).length;
  const due = words.filter((w) => isDue(state, w.id)).length;
  return { total: words.length, mastered, due };
}

function reviewWord(id, knewIt) {
  const state = getSrsState();
  const st = state[id] || { box: 0, next: 0 };
  if (knewIt) {
    st.box = Math.min(st.box + 1, BOX_DAYS.length - 1);
  } else {
    st.box = 0;
  }
  st.next = Date.now() + BOX_DAYS[st.box] * 86400000;
  st.lastSeen = Date.now();
  state[id] = st;
  saveSrsState(state);
}

// ===================== Motor de conjugación (tiempos verbales) =====================
// Terminaciones para tiempos simples que se construyen sobre la raíz (infinitivo sin -ar/-er/-ir).
const REGULAR_SUFFIXES = {
  'presente-indicativo': { ar: ['o', 'as', 'a', 'amos', 'áis', 'an'], er: ['o', 'es', 'e', 'emos', 'éis', 'en'], ir: ['o', 'es', 'e', 'imos', 'ís', 'en'] },
  'preterito-indefinido': { ar: ['é', 'aste', 'ó', 'amos', 'asteis', 'aron'], er: ['í', 'iste', 'ió', 'imos', 'isteis', 'ieron'], ir: ['í', 'iste', 'ió', 'imos', 'isteis', 'ieron'] },
  'preterito-imperfecto': { ar: ['aba', 'abas', 'aba', 'ábamos', 'abais', 'aban'], er: ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'], ir: ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'] },
  'presente-subjuntivo': { ar: ['e', 'es', 'e', 'emos', 'éis', 'en'], er: ['a', 'as', 'a', 'amos', 'áis', 'an'], ir: ['a', 'as', 'a', 'amos', 'áis', 'an'] }
};
// Futuro y condicional se construyen sobre el infinitivo completo (no sobre la raíz), igual en los tres grupos.
const INFINITIVE_SUFFIXES = {
  'futuro-simple': ['é', 'ás', 'á', 'emos', 'éis', 'án'],
  'condicional-simple': ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían']
};
// Pretérito imperfecto de subjuntivo (formas -ra / -se), sobre la raíz.
const IMPERFECTO_SUBJ_SUFFIXES = {
  ar: { ra: ['ara', 'aras', 'ara', 'áramos', 'arais', 'aran'], se: ['ase', 'ases', 'ase', 'ásemos', 'aseis', 'asen'] },
  er: { ra: ['iera', 'ieras', 'iera', 'iéramos', 'ierais', 'ieran'], se: ['iese', 'ieses', 'iese', 'iésemos', 'ieseis', 'iesen'] },
  ir: { ra: ['iera', 'ieras', 'iera', 'iéramos', 'ierais', 'ieran'], se: ['iese', 'ieses', 'iese', 'iésemos', 'ieseis', 'iesen'] }
};
const HABER_FORMS = {
  'presente-indicativo': ['he', 'has', 'ha', 'hemos', 'habéis', 'han'],
  'preterito-imperfecto': ['había', 'habías', 'había', 'habíamos', 'habíais', 'habían'],
  'futuro-simple': ['habré', 'habrás', 'habrá', 'habremos', 'habréis', 'habrán'],
  'condicional-simple': ['habría', 'habrías', 'habría', 'habríamos', 'habríais', 'habrían'],
  'presente-subjuntivo': ['haya', 'hayas', 'haya', 'hayamos', 'hayáis', 'hayan'],
  'preterito-imperfecto-subjuntivo': ['hubiera/hubiese', 'hubieras/hubieses', 'hubiera/hubiese', 'hubiéramos/hubiésemos', 'hubierais/hubieseis', 'hubieran/hubiesen']
};
// Cada tiempo compuesto usa la forma de "haber" del tiempo simple indicado + el participio.
const COMPOUND_TENSES = {
  'preterito-perfecto-compuesto': 'presente-indicativo',
  'preterito-pluscuamperfecto': 'preterito-imperfecto',
  'futuro-compuesto': 'futuro-simple',
  'condicional-compuesto': 'condicional-simple',
  'preterito-perfecto-subjuntivo': 'presente-subjuntivo',
  'preterito-pluscuamperfecto-subjuntivo': 'preterito-imperfecto-subjuntivo'
};
const SIMPLE_TENSE_IDS = ['presente-indicativo', 'preterito-indefinido', 'preterito-imperfecto', 'futuro-simple', 'condicional-simple', 'presente-subjuntivo', 'preterito-imperfecto-subjuntivo'];

function verbRoot(verb) { return verb.infinitivo.slice(0, -2); }

function conjugarRegular(verb, tiempoId) {
  const root = verbRoot(verb);
  if (INFINITIVE_SUFFIXES[tiempoId]) {
    return INFINITIVE_SUFFIXES[tiempoId].map((s) => verb.infinitivo + s);
  }
  if (tiempoId === 'preterito-imperfecto-subjuntivo') {
    const { ra, se } = IMPERFECTO_SUBJ_SUFFIXES[verb.grupo];
    return ra.map((s, i) => `${root}${s}/${root}${se[i]}`);
  }
  return REGULAR_SUFFIXES[tiempoId][verb.grupo].map((s) => root + s);
}

// Devuelve las 6 formas (yo/tú/él.../nosotros/vosotros/ellos...) de un verbo en un tiempo dado.
// Formas alternativas (p. ej. -ra/-se) van separadas por "/".
function conjugarVerbo(verb, tiempoId) {
  if (COMPOUND_TENSES[tiempoId]) {
    const auxForms = HABER_FORMS[COMPOUND_TENSES[tiempoId]];
    return auxForms.map((f) => f.split('/').map((a) => `${a} ${verb.participio}`).join('/'));
  }
  if (verb.overrides && verb.overrides[tiempoId]) return verb.overrides[tiempoId];
  return conjugarRegular(verb, tiempoId);
}

function findTiempo(tiempoId) {
  for (const cat of DATA.tenses) {
    const tiempo = cat.tiempos.find((t) => t.id === tiempoId);
    if (tiempo) return { cat, tiempo };
  }
  return null;
}

function pickPracticeVerb() {
  return pickRandom(DATA.verbs.filter((v) => !v.soloFormas));
}

// Comprueba una respuesta escrita contra una (o varias, separadas por "/") formas correctas.
function isCorrectAnswer(given, correct) {
  const accepted = correct.split('/').map((a) => a.trim().toLowerCase());
  return given.trim() !== '' && accepted.includes(given.trim().toLowerCase());
}

// ===================== Router =====================
function parseHash() {
  return (location.hash.slice(1) || '/').split('/').filter(Boolean);
}
function navigate(path) { location.hash = path; }

function setActiveTab(root) {
  $$('.tab-item').forEach((a) => {
    a.classList.toggle('active', a.dataset.route === '/' + (root || ''));
  });
}

function setTitle(title) { $('#pageTitle').textContent = title; }

async function render() {
  const segs = parseHash();
  setActiveTab(segs[0]);
  const app = $('#app');
  app.innerHTML = '';
  $('#btnBack').hidden = segs.length === 0;
  window.scrollTo(0, 0);

  if (segs.length === 0) return viewHome(app);
  if (segs[0] === 'vocab') {
    if (segs[1] === 'review') return viewVocabReview(app, segs[2]);
    if (segs[1] === 'theme') return viewVocabTheme(app, segs[2]);
    return viewVocabList(app);
  }
  if (segs[0] === 'grammar') {
    if (segs[1] === 'quiz') return viewGrammarQuiz(app, segs[2]);
    if (segs[1] === 'tenses') {
      if (segs[2] === 'conjugar') return viewTensesConjugate(app, segs[3]);
      if (segs[2] === 'frases') return viewTensesFrases(app, segs[3]);
      if (segs[2] === 'formas') return viewTensesFormas(app);
      if (segs[2] && segs[3]) return viewTenseDetail(app, segs[2], segs[3]);
      if (segs[2]) return viewTensesCategory(app, segs[2]);
      return viewTensesCategories(app);
    }
    return viewGrammarList(app);
  }
  if (segs[0] === 'reading') {
    if (segs[1] === 'quiz') return viewReadingQuiz(app, segs[2]);
    return viewReadingList(app);
  }
  if (segs[0] === 'writing') {
    if (segs[1] === 'practice') return viewWritingPractice(app, segs[2]);
    return viewWritingList(app);
  }
  if (segs[0] === 'repaso') {
    if (segs[1]) return viewRepasoTipo(app, segs[1]);
    return viewRepaso(app);
  }
  return viewHome(app);
}

$('#btnBack').addEventListener('click', () => {
  if (history.length > 1) history.back(); else navigate('/');
});

// ===================== Vista: Inicio =====================
function viewHome(app) {
  setTitle('DELE B2');
  const dueVocab = getDueWords().length;
  const totalVocab = DATA.vocabFlat.length;
  const srs = getSrsState();
  const masteredVocab = Object.values(srs).filter((s) => s.box >= 3).length;

  const gstats = getJSON('dele_grammar_stats', {});
  const gradedCats = DATA.grammar.filter((c) => gstats[c.id]);
  const avgGrammar = gradedCats.length
    ? Math.round(gradedCats.reduce((sum, c) => sum + (gstats[c.id].lastCorrect / gstats[c.id].lastTotal), 0) / gradedCats.length * 100)
    : null;

  const rscores = getJSON('dele_reading_scores', {});
  const readDone = Object.keys(rscores).length;

  const wdone = getJSON('dele_writing_done', {});
  const writeDone = Object.keys(wdone).filter((k) => wdone[k].done).length;

  const mistakes = mistakeCount();

  app.innerHTML = `
    <div class="card">
      <h2>${escapeHtml(pickGreeting())}</h2>
      <p>Esto es lo que te toca hoy:</p>
      <div class="grid-2">
        <div>
          <div class="stat-num">${dueVocab}</div>
          <div class="stat-label">tarjetas pendientes</div>
        </div>
        <div>
          <div class="stat-num">${masteredVocab}/${totalVocab}</div>
          <div class="stat-label">palabras dominadas</div>
        </div>
      </div>
    </div>

    <a href="#/vocab/review" class="btn" style="margin-bottom:14px;">🗂️ Repasar vocabulario ${dueVocab ? `(${dueVocab})` : ''}</a>
    ${mistakes ? `<a href="#/repaso" class="btn secondary" style="margin-bottom:14px;">🔁 Repaso de errores (${mistakes})</a>` : ''}

    <div class="section-title">Tu progreso</div>
    <div class="card">
      <div class="stat-row"><span>Gramática</span><span>${avgGrammar !== null ? avgGrammar + '%' : 'sin empezar'}</span></div>
      <div class="progress-bar"><div style="width:${avgGrammar || 0}%"></div></div>
      <div class="stat-row" style="margin-top:12px;"><span>Lectura</span><span>${readDone}/${DATA.reading.length} textos</span></div>
      <div class="progress-bar"><div style="width:${DATA.reading.length ? (readDone / DATA.reading.length * 100) : 0}%"></div></div>
      <div class="stat-row" style="margin-top:12px;"><span>Escritura</span><span>${writeDone}/${DATA.writing.length} practicados</span></div>
      <div class="progress-bar"><div style="width:${DATA.writing.length ? (writeDone / DATA.writing.length * 100) : 0}%"></div></div>
    </div>

    <div class="section-title">Accesos rápidos</div>
    <div class="grid-2">
      <a href="#/grammar" class="list-item"><div>✏️ Gramática</div><span class="chev">›</span></a>
      <a href="#/reading" class="list-item"><div>📖 Lectura</div><span class="chev">›</span></a>
      <a href="#/writing" class="list-item"><div>📝 Escritura</div><span class="chev">›</span></a>
      <a href="#/vocab" class="list-item"><div>🗂️ Vocabulario</div><span class="chev">›</span></a>
    </div>

    ${!isStandaloneMode() ? `<div class="section-title">Instalación</div>${installHelpHtml()}` : ''}
  `;
}

// ===================== Vista: Vocabulario (lista de temas) =====================
function viewVocabList(app) {
  setTitle('Vocabulario');
  const dueTotal = getDueWords().length;
  let html = `<a href="#/vocab/review" class="btn" style="margin-bottom:16px;">🔁 Repasar ahora ${dueTotal ? `(${dueTotal} pendientes)` : '(todo al día)'}</a>`;
  html += `<div class="section-title">Temas</div>`;
  DATA.vocab.forEach((tema, ti) => {
    const st = themeStats(ti);
    const pct = st.total ? Math.round((st.mastered / st.total) * 100) : 0;
    html += `
      <div class="card">
        <div class="stat-row"><strong>${escapeHtml(tema.tema)}</strong><span class="pill ${st.due ? 'accent' : ''}">${st.due ? st.due + ' pendientes' : 'al día'}</span></div>
        <div class="progress-bar"><div style="width:${pct}%"></div></div>
        <div class="stat-row" style="margin-top:6px;"><span class="meta" style="color:var(--text-muted);font-size:12px;">${st.mastered}/${st.total} dominadas</span></div>
        <div class="grid-2" style="margin-top:10px;">
          <a href="#/vocab/review/${ti}" class="btn small secondary">Repasar tema</a>
          <a href="#/vocab/theme/${ti}" class="btn small secondary">Ver palabras</a>
        </div>
      </div>`;
  });
  app.innerHTML = html;
}

function viewVocabTheme(app, themeIndex) {
  const ti = Number(themeIndex);
  const tema = DATA.vocab[ti];
  if (!tema) return navigate('/vocab');
  setTitle(tema.tema);
  const state = getSrsState();
  let html = `<a href="#/vocab/review/${ti}" class="btn" style="margin-bottom:16px;">🔁 Repasar este tema</a>`;
  tema.palabras.forEach((w, wi) => {
    const id = `t${ti}-w${wi}`;
    const mastered = state[id] && state[id].box >= 3;
    html += `
      <details class="card">
        <summary style="cursor:pointer;font-weight:700;list-style:none;display:flex;justify-content:space-between;align-items:center;">
          <span>${escapeHtml(w.es)}</span>
          ${mastered ? '<span class="pill good">dominada</span>' : ''}
        </summary>
        <p style="margin-top:10px;">${escapeHtml(w.definicion)}</p>
        <p class="meta" style="font-style:italic;color:var(--text-muted);">"${escapeHtml(w.ejemplo)}"</p>
        ${w.sinonimo ? `<span class="pill">sinónimo: ${escapeHtml(w.sinonimo)}</span>` : ''}
      </details>`;
  });
  app.innerHTML = html;
}

function viewVocabReview(app, themeIndex) {
  const ti = (themeIndex !== undefined && themeIndex !== '') ? Number(themeIndex) : undefined;
  const tema = ti !== undefined ? DATA.vocab[ti] : null;
  setTitle(tema ? `Repaso: ${tema.tema}` : 'Repaso de vocabulario');

  let queue = shuffle(getDueWords(ti)).slice(0, 25);
  let idx = 0;
  let flipped = false;
  let stats = { revisadas: 0, sabidas: 0 };

  function renderCard() {
    if (idx >= queue.length) return renderFinish();
    const w = queue[idx];
    flipped = false;
    app.innerHTML = `
      <div class="pill" style="margin-bottom:10px;">${idx + 1} / ${queue.length}</div>
      <div class="card flashcard" id="flashcard">
        <div class="word">${escapeHtml(w.es)}</div>
        <div class="hint">Toca la tarjeta para ver la definición</div>
      </div>
      <div class="review-actions" id="reviewActions" style="visibility:hidden;">
        <button class="btn bad" id="btnDontKnow">😕 No lo sé</button>
        <button class="btn good" id="btnKnow">😄 Lo sé</button>
      </div>
    `;
    $('#flashcard').addEventListener('click', () => {
      flipped = true;
      $('#flashcard').innerHTML = `
        <div class="word">${escapeHtml(w.es)}</div>
        <div class="def">${escapeHtml(w.definicion)}</div>
        <div class="example">"${escapeHtml(w.ejemplo)}"</div>
        ${w.sinonimo ? `<div class="syn">sinónimo: ${escapeHtml(w.sinonimo)}</div>` : ''}
      `;
      $('#reviewActions').style.visibility = 'visible';
    });
    $('#btnDontKnow').addEventListener('click', () => answer(false));
    $('#btnKnow').addEventListener('click', () => answer(true));
  }

  function answer(knewIt) {
    const w = queue[idx];
    reviewWord(w.id, knewIt);
    touchStreak();
    checkWordsMasteredMilestone();
    stats.revisadas++;
    if (knewIt) stats.sabidas++;
    else queue.splice(idx + 3, 0, w); // se repite un poco más adelante en la sesión
    idx++;
    renderCard();
  }

  function renderFinish() {
    app.innerHTML = `
      <div class="card score-hero">
        <div class="emoji" style="font-size:40px;">🎉</div>
        <h2>¡Sesión terminada!</h2>
        <p>Has repasado <strong>${stats.revisadas}</strong> tarjetas y sabías <strong>${stats.sabidas}</strong> de ellas.</p>
      </div>
      <a href="#/vocab" class="btn">Volver a vocabulario</a>
    `;
    if (stats.revisadas > 0) {
      const msg = pickRandom(DATA.motivation && DATA.motivation.sessionEnd.vocab);
      queueMotivation(msg);
    }
  }

  if (queue.length === 0) {
    app.innerHTML = `
      <div class="empty-state">
        <div class="emoji">✅</div>
        <h3>¡Todo al día!</h3>
        <p>No tienes tarjetas pendientes ${tema ? `en "${escapeHtml(tema.tema)}"` : ''} ahora mismo. Vuelve más tarde.</p>
        <a href="#/vocab" class="btn secondary" style="margin-top:10px;">Volver</a>
      </div>`;
    return;
  }
  renderCard();
}

// ===================== Vista: Gramática =====================
function viewGrammarList(app) {
  setTitle('Gramática');
  const gstats = getJSON('dele_grammar_stats', {});
  let html = `
    <a href="#/grammar/tenses" class="list-item">
      <div>
        <div><strong>📘 Tiempos verbales</strong></div>
        <div class="meta">Teoría por bloques (presente, pasado, futuro...) y práctica de conjugación</div>
      </div>
      <span class="chev">›</span>
    </a>`;
  html += `<div class="section-title">Bloques de gramática</div>`;
  html += `<p style="color:var(--text-muted);margin-bottom:16px;">Elige un bloque para practicar. Repite los que tengan menos porcentaje.</p>`;
  DATA.grammar.forEach((cat) => {
    const s = gstats[cat.id];
    const pct = s ? Math.round((s.lastCorrect / s.lastTotal) * 100) : null;
    html += `
      <a href="#/grammar/quiz/${cat.id}" class="list-item">
        <div>
          <div><strong>${escapeHtml(cat.titulo)}</strong></div>
          <div class="meta">${pct !== null ? `Última puntuación: ${pct}%` : 'Sin practicar todavía'}</div>
        </div>
        <span class="pill ${pct !== null ? (pct >= 75 ? 'good' : pct < 50 ? 'bad' : '') : ''}">${pct !== null ? pct + '%' : 'nuevo'}</span>
      </a>`;
  });
  app.innerHTML = html;
}

function viewGrammarQuiz(app, catId) {
  const cat = DATA.grammar.find((c) => c.id === catId);
  if (!cat) return navigate('/grammar');
  setTitle(cat.titulo);
  runQuiz(app, {
    intro: cat.explicacion,
    items: withMistakeIds(cat.items, `grammar-${cat.id}`, 'grammar', cat.titulo),
    backRoute: '/grammar',
    kind: 'grammar',
    onFinish: (correct, total) => {
      const stats = getJSON('dele_grammar_stats', {});
      const prevBest = stats[cat.id] ? stats[cat.id].bestPct : 0;
      const pct = Math.round((correct / total) * 100);
      stats[cat.id] = { lastCorrect: correct, lastTotal: total, bestPct: Math.max(prevBest || 0, pct) };
      setJSON('dele_grammar_stats', stats);
      touchStreak();
    },
    retryRoute: `/grammar/quiz/${cat.id}`
  });
}

// ===================== Vista: Tiempos verbales (teoría + práctica) =====================
const PRONOMBRES = ['yo', 'tú', 'él/ella/usted', 'nosotros/as', 'vosotros/as', 'ellos/ellas/ustedes'];

function viewTensesCategories(app) {
  setTitle('Tiempos verbales');
  let html = `<p style="color:var(--text-muted);margin-bottom:16px;">Primero repasa la teoría de cada bloque y luego practica con los ejercicios.</p>`;
  DATA.tenses.forEach((cat) => {
    html += `
      <a href="#/grammar/tenses/${cat.id}" class="list-item">
        <div>
          <div><strong>${escapeHtml(cat.titulo)}</strong></div>
          <div class="meta">${cat.tiempos.length} tiempo${cat.tiempos.length > 1 ? 's' : ''}</div>
        </div>
        <span class="chev">›</span>
      </a>`;
  });
  html += `<div class="section-title">Práctica general</div>`;
  html += `
    <a href="#/grammar/tenses/formas" class="list-item">
      <div>
        <div><strong>🔤 Infinitivo, gerundio y participio</strong></div>
        <div class="meta">Identifica las formas no personales de un verbo</div>
      </div>
      <span class="chev">›</span>
    </a>`;
  app.innerHTML = html;
}

function viewTensesCategory(app, catId) {
  const cat = DATA.tenses.find((c) => c.id === catId);
  if (!cat) return navigate('/grammar/tenses');
  setTitle(cat.titulo);
  let html = `<div class="card"><p style="margin:0;">${escapeHtml(cat.resumen)}</p></div>`;
  html += `<div class="section-title">Teoría</div>`;
  cat.tiempos.forEach((t) => {
    html += `<a href="#/grammar/tenses/${cat.id}/${t.id}" class="list-item"><div><strong>${escapeHtml(t.nombre)}</strong></div><span class="chev">›</span></a>`;
  });
  if (cat.practicaFrases && cat.practicaFrases.length) {
    html += `<div class="section-title">Práctica</div>`;
    html += `<a href="#/grammar/tenses/frases/${cat.id}" class="btn secondary" style="margin-bottom:10px;">📝 Completa las frases</a>`;
  }
  html += `<a href="#/grammar/tenses" class="btn secondary" style="margin-top:6px;">Volver</a>`;
  app.innerHTML = html;
}

function viewTenseDetail(app, catId, tiempoId) {
  const cat = DATA.tenses.find((c) => c.id === catId);
  const t = cat && cat.tiempos.find((x) => x.id === tiempoId);
  if (!t) return navigate('/grammar/tenses');
  setTitle(t.nombre);
  let html = `<div class="section-title">Usos</div><div class="card"><ul style="margin:0;padding-left:20px;">${t.usos.map((u) => `<li style="margin-bottom:6px;">${escapeHtml(u)}</li>`).join('')}</ul></div>`;
  html += `<div class="section-title">Formación</div><div class="card"><p style="margin:0;">${escapeHtml(t.formacion)}</p></div>`;
  html += `<div class="section-title">Conjugación</div><div class="card"><div class="tense-table-wrap"><table class="tense-table"><thead><tr><th></th>${t.tabla.columnas.map((c) => `<th>${escapeHtml(c)}</th>`).join('')}</tr></thead><tbody>`;
  t.tabla.filas.forEach((fila, i) => {
    html += `<tr><th>${escapeHtml(PRONOMBRES[i])}</th>${fila.map((f) => `<td>${escapeHtml(f)}</td>`).join('')}</tr>`;
  });
  html += `</tbody></table></div></div>`;
  if (t.irregulares && t.irregulares.length) {
    html += `<details class="card"><summary style="cursor:pointer;font-weight:700;list-style:none;">⚠️ Irregulares frecuentes</summary><ul style="margin:10px 0 0;padding-left:20px;">${t.irregulares.map((x) => `<li style="margin-bottom:6px;">${escapeHtml(x)}</li>`).join('')}</ul></details>`;
  }
  html += `<div class="section-title">Ejemplos</div><div class="card">${t.ejemplos.map((e) => `<p style="font-style:italic;margin-bottom:6px;">"${escapeHtml(e)}"</p>`).join('')}</div>`;
  if (SIMPLE_TENSE_IDS.includes(t.id)) {
    html += `<a href="#/grammar/tenses/conjugar/${t.id}" class="btn" style="margin-top:6px;">🖊️ Practicar: conjugar este tiempo</a>`;
  }
  html += `<a href="#/grammar/tenses/${catId}" class="btn secondary" style="margin-top:10px;">Volver</a>`;
  app.innerHTML = html;
}

function viewTensesConjugate(app, tiempoId) {
  const found = findTiempo(tiempoId);
  if (!found) return navigate('/grammar/tenses');
  setTitle(`Conjugar: ${found.tiempo.nombre}`);
  let verb = pickPracticeVerb();

  function renderRound() {
    app.innerHTML = `
      <div class="card">
        <p class="meta" style="color:var(--text-muted);margin-bottom:4px;">${escapeHtml(found.tiempo.nombre)}</p>
        <h2 style="margin:0;">${escapeHtml(verb.infinitivo)}</h2>
        <p class="meta" style="color:var(--text-muted);margin-top:6px;">Escribe las seis formas (los acentos cuentan).</p>
      </div>
      <div class="card">
        ${PRONOMBRES.map((p, i) => `
          <div class="conjugate-row">
            <label for="cf${i}">${escapeHtml(p)}</label>
            <input type="text" id="cf${i}" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false">
          </div>`).join('')}
      </div>
      <button class="btn" id="btnCheck">Comprobar</button>
      <div id="conjugateResult"></div>
    `;
    $('#btnCheck').addEventListener('click', checkRound);
  }

  function checkRound() {
    const correct = conjugarVerbo(verb, tiempoId);
    let ok = 0;
    correct.forEach((c, i) => {
      const input = $(`#cf${i}`);
      const right = isCorrectAnswer(input.value, c);
      const mistakeId = `tenses-conjugate-${tiempoId}-${verb.infinitivo}-${i}`;
      if (right) {
        clearMistake(mistakeId);
      } else {
        recordMistake(mistakeId, {
          tipo: 'tenses-conjugate',
          contexto: found.tiempo.nombre,
          frase: `${verb.infinitivo} — ${PRONOMBRES[i]} (${found.tiempo.nombre})`,
          respuesta: c
        });
      }
      input.classList.add(right ? 'field-correct' : 'field-incorrect');
      input.disabled = true;
      if (!right) {
        const hint = document.createElement('div');
        hint.className = 'field-hint';
        hint.textContent = `✓ ${c.replace(/\//g, ' / ')}`;
        input.insertAdjacentElement('afterend', hint);
      }
      if (right) ok++;
    });
    $('#btnCheck').remove();
    $('#conjugateResult').innerHTML = `
      <div class="card score-hero">
        <div class="big">${ok}/${correct.length}</div>
        <p>formas correctas de "${escapeHtml(verb.infinitivo)}"</p>
      </div>
      <button class="btn" id="btnNextVerb">Otro verbo</button>
      <a href="#/grammar/tenses" class="btn secondary" style="margin-top:10px;">Terminar y volver</a>
    `;
    $('#btnNextVerb').addEventListener('click', () => { verb = pickPracticeVerb(); renderRound(); });
    touchStreak();
  }

  renderRound();
}

// Componente genérico de ejercicios de respuesta escrita (rellenar el hueco).
function runClozeQuiz(app, opts) {
  const { items, backRoute } = opts;
  let idx = 0;
  let correctCount = 0;
  let answered = false;

  function renderQuestion() {
    if (idx >= items.length) return renderFinish();
    const q = items[idx];
    answered = false;
    app.innerHTML = `
      <div class="pill" style="margin-bottom:10px;">Frase ${idx + 1} / ${items.length}</div>
      <div class="card">
        <div class="quiz-q">${escapeHtml(q.frase)}</div>
        <input type="text" id="clozeInput" class="cloze-input" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Escribe la forma verbal...">
        <div id="clozeExplain"></div>
      </div>
      <button class="btn" id="btnCloze">Comprobar</button>
    `;
    const input = $('#clozeInput');
    input.focus();
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleClozeClick(); });
    $('#btnCloze').addEventListener('click', handleClozeClick);
  }

  function handleClozeClick() {
    if (answered) { idx++; renderQuestion(); return; }
    answered = true;
    const q = items[idx];
    const input = $('#clozeInput');
    const correct = isCorrectAnswer(input.value, q.respuesta);
    if (correct) correctCount++;
    if (q.mistakeId) {
      if (correct) clearMistake(q.mistakeId);
      else recordMistake(q.mistakeId, { tipo: q.mistakeTipo, contexto: q.mistakeContexto, frase: q.frase, respuesta: q.respuesta });
    }
    input.classList.add(correct ? 'field-correct' : 'field-incorrect');
    input.disabled = true;
    $('#clozeExplain').innerHTML = `<div class="quiz-explain">${correct ? '✅ ¡Correcto!' : `❌ La respuesta correcta es: <strong>${escapeHtml(q.respuesta.replace(/\//g, ' / '))}</strong>`}</div>`;
    $('#btnCloze').textContent = (idx === items.length - 1) ? 'Ver resultado' : 'Siguiente';
  }

  function renderFinish() {
    const pct = Math.round((correctCount / items.length) * 100);
    if (DATA.motivation) {
      const pool = pct >= 75 ? DATA.motivation.sessionEnd.grammarHigh : DATA.motivation.sessionEnd.grammarLow;
      const msg = pickRandom(pool);
      if (msg) queueMotivation(msg);
    }
    app.innerHTML = `
      <div class="card score-hero">
        <div class="big">${pct}%</div>
        <p>${correctCount} de ${items.length} respuestas correctas</p>
      </div>
      <a href="#${backRoute}" class="btn secondary">Volver</a>
    `;
    touchStreak();
  }

  renderQuestion();
}

function viewTensesFrases(app, catId) {
  const cat = DATA.tenses.find((c) => c.id === catId);
  if (!cat || !cat.practicaFrases) return navigate('/grammar/tenses');
  setTitle(`Practicar: ${cat.titulo}`);
  const items = withMistakeIds(cat.practicaFrases, `tenses-frases-${catId}`, 'tenses-frases', cat.titulo);
  runClozeQuiz(app, { items: shuffle(items), backRoute: `/grammar/tenses/${catId}` });
}

function viewTensesFormas(app) {
  setTitle('Infinitivo, gerundio y participio');
  let verb, forma;

  function pickPrompt() {
    verb = pickRandom(DATA.verbs);
    const tiempo = pickRandom(SIMPLE_TENSE_IDS);
    const persona = Math.floor(Math.random() * 6);
    forma = conjugarVerbo(verb, tiempo)[persona].split('/')[0];
  }

  function renderRound() {
    pickPrompt();
    app.innerHTML = `
      <div class="card">
        <p class="meta" style="color:var(--text-muted);margin-bottom:4px;">¿De qué verbo viene esta forma?</p>
        <h2 style="margin:0;">${escapeHtml(forma)}</h2>
      </div>
      <div class="card">
        <div class="conjugate-row"><label for="fInf">Infinitivo</label><input type="text" id="fInf" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"></div>
        <div class="conjugate-row"><label for="fGer">Gerundio</label><input type="text" id="fGer" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"></div>
        <div class="conjugate-row"><label for="fPart">Participio</label><input type="text" id="fPart" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"></div>
      </div>
      <button class="btn" id="btnCheckFormas">Comprobar</button>
      <div id="formasResult"></div>
    `;
    $('#btnCheckFormas').addEventListener('click', checkFormas);
  }

  function checkFormas() {
    const checks = [['fInf', verb.infinitivo, 'infinitivo'], ['fGer', verb.gerundio, 'gerundio'], ['fPart', verb.participio, 'participio']];
    let ok = 0;
    checks.forEach(([id, correct, label]) => {
      const input = $('#' + id);
      const right = isCorrectAnswer(input.value, correct);
      const mistakeId = `tenses-formas-${verb.infinitivo}-${label}`;
      if (right) {
        clearMistake(mistakeId);
      } else {
        recordMistake(mistakeId, { tipo: 'tenses-formas', contexto: 'Formas no personales', frase: `${forma} → ¿${label}?`, respuesta: correct });
      }
      input.classList.add(right ? 'field-correct' : 'field-incorrect');
      input.disabled = true;
      if (!right) {
        const hint = document.createElement('div');
        hint.className = 'field-hint';
        hint.textContent = `✓ ${correct}`;
        input.insertAdjacentElement('afterend', hint);
      }
      if (right) ok++;
    });
    $('#btnCheckFormas').remove();
    $('#formasResult').innerHTML = `
      <div class="card score-hero"><div class="big">${ok}/3</div><p>formas correctas</p></div>
      <button class="btn" id="btnNextFormas">Otro verbo</button>
      <a href="#/grammar/tenses" class="btn secondary" style="margin-top:10px;">Terminar y volver</a>
    `;
    $('#btnNextFormas').addEventListener('click', renderRound);
    touchStreak();
  }

  renderRound();
}

// ===================== Vista: Repaso de errores =====================
const REPASO_GRUPOS = {
  'grammar': { titulo: 'Gramática', icon: '✏️' },
  'reading': { titulo: 'Lectura', icon: '📖' },
  'tenses-conjugate': { titulo: 'Tiempos verbales: conjugación', icon: '🖊️' },
  'tenses-frases': { titulo: 'Tiempos verbales: frases', icon: '📝' },
  'tenses-formas': { titulo: 'Tiempos verbales: formas no personales', icon: '🔤' }
};

function viewRepaso(app) {
  setTitle('Repaso de errores');
  const mistakes = Object.values(getMistakes());
  if (!mistakes.length) {
    app.innerHTML = `
      <div class="empty-state">
        <div class="emoji">🎉</div>
        <h3>¡Sin errores pendientes!</h3>
        <p>Cuando falles una pregunta en cualquier práctica (gramática, lectura o tiempos verbales), aparecerá aquí para que la repases. En cuanto la aciertes, desaparece.</p>
      </div>`;
    return;
  }
  let html = `<p style="color:var(--text-muted);margin-bottom:16px;">Estas son las preguntas que has fallado alguna vez. Repásalas cuando quieras: en cuanto las aciertes, se quitan solas de la lista.</p>`;
  Object.keys(REPASO_GRUPOS).forEach((tipo) => {
    const items = mistakes.filter((m) => m.tipo === tipo);
    if (!items.length) return;
    const g = REPASO_GRUPOS[tipo];
    html += `
      <div class="card">
        <div class="stat-row"><strong>${g.icon} ${escapeHtml(g.titulo)}</strong><span class="pill bad">${items.length}</span></div>
        <a href="#/repaso/${tipo}" class="btn small" style="margin-top:10px;">Repasar</a>
      </div>`;
  });
  app.innerHTML = html;
}

function viewRepasoTipo(app, tipo) {
  const g = REPASO_GRUPOS[tipo];
  const items = shuffle(Object.values(getMistakes()).filter((m) => m.tipo === tipo));
  if (!g || !items.length) return navigate('/repaso');
  setTitle(`Repaso: ${g.titulo}`);
  if (tipo === 'grammar' || tipo === 'reading') {
    runQuiz(app, { items, backRoute: '/repaso', kind: tipo });
  } else {
    runClozeQuiz(app, { items, backRoute: '/repaso' });
  }
}

// ===================== Vista: Lectura =====================
function viewReadingList(app) {
  setTitle('Comprensión de lectura');
  const scores = getJSON('dele_reading_scores', {});
  let html = '';
  DATA.reading.forEach((t, i) => {
    const s = scores[i];
    html += `
      <a href="#/reading/quiz/${i}" class="list-item">
        <div>
          <div><strong>${escapeHtml(t.titulo)}</strong></div>
          <div class="meta">${s ? `Mejor puntuación: ${s.bestPct}%` : `${t.preguntas.length} preguntas`}</div>
        </div>
        <span class="chev">›</span>
      </a>`;
  });
  app.innerHTML = html;
}

function viewReadingQuiz(app, idxStr) {
  const i = Number(idxStr);
  const text = DATA.reading[i];
  if (!text) return navigate('/reading');
  setTitle(text.titulo);

  let stage = 'read'; // 'read' -> 'quiz'
  function renderRead() {
    app.innerHTML = `
      <div class="card">
        <h2>${escapeHtml(text.titulo)}</h2>
        <div class="readtext">${escapeHtml(text.texto)}</div>
      </div>
      <button class="btn" id="btnStartQ">Empezar preguntas (${text.preguntas.length})</button>
    `;
    $('#btnStartQ').addEventListener('click', () => {
      stage = 'quiz';
      runQuiz(app, {
        items: withMistakeIds(text.preguntas, `reading-${i}`, 'reading', text.titulo),
        backRoute: '/reading',
        kind: 'reading',
        onFinish: (correct, total) => {
          const scores = getJSON('dele_reading_scores', {});
          const pct = Math.round((correct / total) * 100);
          const prevBest = scores[i] ? scores[i].bestPct : 0;
          scores[i] = { lastCorrect: correct, lastTotal: total, bestPct: Math.max(prevBest || 0, pct) };
          setJSON('dele_reading_scores', scores);
          touchStreak();
        },
        retryRoute: `/reading/quiz/${i}`
      });
    });
  }
  renderRead();
}

// ===================== Componente de quiz genérico =====================
function runQuiz(app, opts) {
  const { items, onFinish, backRoute, retryRoute, intro, kind } = opts;
  let idx = 0;
  let correctCount = 0;
  let answered = false;

  function renderQuestion() {
    if (idx >= items.length) return renderFinish();
    const q = items[idx];
    answered = false;
    app.innerHTML = `
      ${intro && idx === 0 ? `<div class="card"><p style="margin:0;">${escapeHtml(intro)}</p></div>` : ''}
      <div class="pill" style="margin-bottom:10px;">Pregunta ${idx + 1} / ${items.length}</div>
      <div class="card">
        <div class="quiz-q">${escapeHtml(q.pregunta)}</div>
        <div id="opts"></div>
        <div id="explainBox"></div>
      </div>
      <button class="btn" id="btnNext" disabled>Siguiente</button>
    `;
    const optsBox = $('#opts');
    q.opciones.forEach((opt, oi) => {
      const b = document.createElement('button');
      b.className = 'quiz-opt';
      b.textContent = opt;
      b.addEventListener('click', () => selectOption(oi));
      optsBox.appendChild(b);
    });
    $('#btnNext').addEventListener('click', () => { idx++; renderQuestion(); });
  }

  function selectOption(oi) {
    if (answered) return;
    answered = true;
    const q = items[idx];
    const correct = oi === q.correcta;
    if (correct) correctCount++;
    if (q.mistakeId) {
      if (correct) clearMistake(q.mistakeId);
      else recordMistake(q.mistakeId, { tipo: q.mistakeTipo, contexto: q.mistakeContexto, pregunta: q.pregunta, opciones: q.opciones, correcta: q.correcta, explicacion: q.explicacion });
    }
    $$('.quiz-opt').forEach((btn, i) => {
      if (i === q.correcta) btn.classList.add('correct');
      else if (i === oi) btn.classList.add('incorrect');
    });
    if (q.explicacion) {
      $('#explainBox').innerHTML = `<div class="quiz-explain">${correct ? '✅' : '❌'} ${escapeHtml(q.explicacion)}</div>`;
    }
    $('#btnNext').disabled = false;
    $('#btnNext').textContent = (idx === items.length - 1) ? 'Ver resultado' : 'Siguiente';
  }

  function renderFinish() {
    if (typeof onFinish === 'function') onFinish(correctCount, items.length);
    const pct = Math.round((correctCount / items.length) * 100);
    if (DATA.motivation && kind) {
      let pool = null;
      if (kind === 'grammar') pool = pct >= 75 ? DATA.motivation.sessionEnd.grammarHigh : DATA.motivation.sessionEnd.grammarLow;
      else if (kind === 'reading') pool = DATA.motivation.sessionEnd.reading;
      const msg = pickRandom(pool);
      if (msg) queueMotivation(msg);
    }
    app.innerHTML = `
      <div class="card score-hero">
        <div class="big">${pct}%</div>
        <p>${correctCount} de ${items.length} respuestas correctas</p>
      </div>
      <button class="btn" id="btnRetry" style="margin-bottom:10px;">Repetir</button>
      <a href="#${backRoute}" class="btn secondary">Volver</a>
    `;
    $('#btnRetry').addEventListener('click', () => {
      if (retryRoute) { navigate(retryRoute); render(); } else { idx = 0; correctCount = 0; renderQuestion(); }
    });
  }

  renderQuestion();
}

// ===================== Vista: Escritura =====================
function viewWritingList(app) {
  setTitle('Expresión escrita');
  const done = getJSON('dele_writing_done', {});
  app.innerHTML = `<div class="section-title">Tarea 1 · Carta / correo</div>` +
    DATA.writing.filter((p) => p.tarea === 1).map((p) => writingListItem(p)).join('') +
    `<div class="section-title">Tarea 2 · Texto argumentativo / narrativo</div>` +
    DATA.writing.filter((p) => p.tarea === 2).map((p) => writingListItem(p)).join('');

  function writingListItem(p) {
    const i = DATA.writing.indexOf(p);
    const d = done[i];
    return `
      <a href="#/writing/practice/${i}" class="list-item">
        <div>
          <div><strong>${escapeHtml(p.titulo)}</strong></div>
          <div class="meta">${escapeHtml(p.tipo)} · ${p.palabrasMin}-${p.palabrasMax} palabras${d && d.done ? ' · ✅ practicado' : ''}</div>
        </div>
        <span class="chev">›</span>
      </a>`;
  }
}

function viewWritingPractice(app, idxStr) {
  const i = Number(idxStr);
  const p = DATA.writing[i];
  if (!p) return navigate('/writing');
  setTitle(p.titulo);

  let seconds = p.tiempoMin * 60;
  let timerInterval = null;

  app.innerHTML = `
    <div class="card">
      <span class="pill accent">${escapeHtml(p.tipo)}</span>
      <h2 style="margin-top:8px;">${escapeHtml(p.titulo)}</h2>
      <p>${escapeHtml(p.enunciado)}</p>
      <p class="meta" style="color:var(--text-muted);">${p.palabrasMin}-${p.palabrasMax} palabras · ~${p.tiempoMin} min</p>
    </div>

    <details class="card">
      <summary style="cursor:pointer;font-weight:700;list-style:none;">📋 Estructura sugerida</summary>
      <ol style="margin:10px 0 0;padding-left:20px;">${p.estructura.map((s) => `<li style="margin-bottom:6px;">${escapeHtml(s)}</li>`).join('')}</ol>
    </details>

    <details class="card">
      <summary style="cursor:pointer;font-weight:700;list-style:none;">🔗 Conectores útiles</summary>
      <div class="chips">${p.conectores.map((c) => `<span class="chip">${escapeHtml(c)}</span>`).join('')}</div>
    </details>

    <div class="card">
      <div class="stat-row">
        <strong>⏱️ Cronómetro</strong>
        <span class="timer" id="timerDisplay">${fmtTime(seconds)}</span>
      </div>
      <button class="btn secondary small" id="btnTimer" style="margin-top:8px;">Empezar</button>
    </div>

    <div class="card">
      <textarea class="writing-area" id="writingArea" placeholder="Escribe aquí tu texto..."></textarea>
      <div class="wordcount" id="wordcount">0 palabras</div>
    </div>

    <div class="card">
      <div class="stat-row"><strong>🤖 Corrección con IA</strong></div>
      <p class="meta" style="color:var(--text-muted);margin-top:4px;">Copia tu texto junto con los criterios oficiales del DELE B2 para pegarlo en tu IA favorita (Claude, ChatGPT...) y recibir correcciones y feedback al momento.</p>
      <button class="btn secondary small" id="btnCorrect">Corregir con IA</button>
      <p class="meta" id="correctWarning" style="color:var(--bad);margin-top:6px;"></p>
    </div>

    <details class="card" open>
      <summary style="cursor:pointer;font-weight:700;list-style:none;">✅ Autoevaluación</summary>
      <div id="checklist" style="margin-top:8px;">
        ${p.checklist.map((c, ci) => `
          <label class="checklist-item">
            <input type="checkbox" data-ci="${ci}">
            <span>${escapeHtml(c)}</span>
          </label>`).join('')}
      </div>
    </details>

    <button class="btn" id="btnDone" style="margin-top:6px;">Marcar como practicado</button>
    <a href="#/writing" class="btn secondary" style="margin-top:10px;">Volver</a>
  `;

  function fmtTime(s) {
    const m = Math.floor(s / 60), sec = s % 60;
    return `${pad(m)}:${pad(sec)}`;
  }

  $('#writingArea').addEventListener('input', (e) => {
    const wc = wordCount(e.target.value);
    const el = $('#wordcount');
    el.textContent = `${wc} palabras`;
    el.className = 'wordcount ' + (wc >= p.palabrasMin && wc <= p.palabrasMax * 1.15 ? 'ok' : wc > 0 ? 'warn' : '');
  });

  $('#btnCorrect').addEventListener('click', async () => {
    const text = $('#writingArea').value.trim();
    if (wordCount(text) < 15) {
      $('#correctWarning').textContent = 'Escribe un poco más antes de pedir la corrección.';
      return;
    }
    $('#correctWarning').textContent = '';
    const promptText = buildCorrectionPrompt(p, text);
    await copyToClipboard(promptText);
    showCorrectionHelp();
  });

  $('#btnTimer').addEventListener('click', () => {
    const btn = $('#btnTimer');
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
      btn.textContent = 'Continuar';
      return;
    }
    btn.textContent = 'Pausar';
    timerInterval = setInterval(() => {
      seconds = Math.max(0, seconds - 1);
      $('#timerDisplay').textContent = fmtTime(seconds);
      if (seconds === 0) { clearInterval(timerInterval); timerInterval = null; btn.textContent = '¡Tiempo!'; btn.disabled = true; }
    }, 1000);
  });

  $('#btnDone').addEventListener('click', () => {
    const wc = wordCount($('#writingArea').value);
    const done = getJSON('dele_writing_done', {});
    done[i] = { done: true, lastDate: dateStr(), lastWords: wc };
    setJSON('dele_writing_done', done);
    touchStreak();
    const msg = pickRandom(DATA.motivation && DATA.motivation.sessionEnd.writing);
    if (msg) queueMotivation(msg);
    navigate('/writing');
  });
}

// ===================== Instalación PWA =====================
let deferredInstallPrompt = null;
// Si ya se está ejecutando como app instalada, no volvemos a molestar nunca más.
if (isStandaloneMode()) setJSON('dele_install_dismissed', true);

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  const dismissed = getJSON('dele_install_dismissed', false);
  if (!isStandaloneMode() && !dismissed) $('#installToast').hidden = false;
});
// El navegador confirma que la instalación se completó: no mostrar nunca más el aviso.
window.addEventListener('appinstalled', () => {
  setJSON('dele_install_dismissed', true);
  $('#installToast').hidden = true;
});
$('#btnInstall').addEventListener('click', async () => {
  if (deferredInstallPrompt) {
    try {
      deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      if (choice && choice.outcome === 'accepted') {
        $('#installToast').hidden = true;
        return;
      }
      // El usuario canceló el diálogo nativo: seguimos abajo mostrando instrucciones manuales.
    } catch (err) {
      deferredInstallPrompt = null;
      // El navegador (a menudo un navegador integrado en otra app) no completó la instalación:
      // caemos a las instrucciones manuales en vez de fallar en silencio.
    }
  }
  // Sin prompt nativo disponible, o el usuario lo canceló: mostramos la guía manual siempre visible.
  $('#installToast').hidden = true;
  navigate('/');
  setTimeout(() => {
    const el = document.getElementById('installHelp');
    if (el) {
      el.open = true;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, 60);
});
$('#btnDismissInstall').addEventListener('click', () => {
  $('#installToast').hidden = true;
  setJSON('dele_install_dismissed', true);
});

// ===================== Arranque =====================
window.addEventListener('hashchange', render);

(async function init() {
  updateStreakBadge();
  await loadData();
  render();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
    // Cuando entra en juego una versión nueva del service worker, recargamos una vez
    // automáticamente para que la actualización se vea sin que haya que recargar a mano.
    let reloadedForUpdate = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloadedForUpdate) return;
      reloadedForUpdate = true;
      location.reload();
    });
  }
})();
