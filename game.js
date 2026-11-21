/* ============================================================
   js/game.js — Oyuncu durumu + oyun motoru + Oyna ekranı (ES modülü)

   • Tüm modlar (bot, tek oyunculu, dostluk odası, yayın odası) aynı motoru kullanır.
   • Yayın modu (cfg.stream): 10.000 kişiye kadar kalabalık TİPLİ DİZİLERLE simüle edilir
     (tek tek çizilmez), hıza dayalı puan (+100…+1.000), yanlışta −100…−1.000,
     ilk 10 tablo + altta sabit "Sen" şeridi, 500+ katılımcıda 6 şık.
   • Diğer dosyalar (streamer.js vb.) PLAY_EXTRAS / hooks / ui köprüleriyle takılır.
   ============================================================ */
import {
  AVATARS, avatarEl as rawAvatar, CATS, CAT_ICON, DIFFS, DIFF, QUESTIONS, STREAM, rand, clamp, shuffle,
  streamPoints, buildOptions, streamTier, poolSize, cosmeticById,
} from './data.js';
import { syncProfile, listStreamRooms } from './firebase.js';

/* ---------- küçük yardımcılar ---------- */
export const $ = (s, r = document) => r.querySelector(s);
export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}
export const fmt = (n) => Number(n || 0).toLocaleString('tr-TR');
export const LS = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } };
export const LSS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* özel mod vb. */ } };
export const opt = (v, l) => [v, l];

/* ---------- Köprüler (diğer modüller doldurur; döngüsel import olmasın diye) ---------- */
export const ui = { openPanel: () => {}, closePanel: () => {}, toast: () => {} };
export const hooks = { podium: null };          // streamer.js: maç sonu ilk 10 podyum özeti
export const PLAY_EXTRAS = [];                  // streamer.js: Oyna ekranına ek mod kartları

/* ---------- Roller ---------- */
export const ROLE_L = { user: 'Oyuncu', streamer: 'Yayıncı', admin: 'Yönetici' };

/* ============================================================
   OYUNCU DURUMU
   ============================================================ */
const KEY = 'ba_profile_v1';
const DEFAULT = () => ({
  name: 'UmutRBX', avatar: 'a10', level: 15, xp: 420, coins: 12450, gems: 320,
  stats: { played: 0, won: 0, lost: 0, correct: 0, answered: 0, cats: {}, streamPlayed: 0, bestStreamRank: 0 },
  records: {}, seen: [], role: 'user',
  inv: [], equipped: {}, title: '', hints: 0, boosts: { xpMul: 1, coinMul: 1, matches: 0 },
  quests: {}, history: [], dailyDone: '',
});
function load() {
  const d = DEFAULT();
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s && typeof s === 'object') {
      return { ...d, ...s, stats: { ...d.stats, ...(s.stats || {}), cats: { ...(s.stats?.cats || {}) } },
        records: { ...(s.records || {}) }, seen: Array.isArray(s.seen) ? s.seen : [], inv: Array.isArray(s.inv) ? s.inv : [],
        equipped: { ...(s.equipped || {}) }, boosts: { ...d.boosts, ...(s.boosts || {}) }, quests: { ...(s.quests || {}) },
        history: Array.isArray(s.history) ? s.history : [] };
    }
  } catch { /* bozuk kayıt: varsayılan */ }
  return d;
}
export const state = load();
const listeners = [];
export const subscribe = (fn) => listeners.push(fn);
export function saveState() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* sessizce geç */ }
  try { syncProfile(state); } catch { /* yerel mod */ }
  listeners.forEach((fn) => { try { fn(); } catch (e) { console.warn(e); } });
}
export const xpMax = (level) => 100 + 60 * level;
export function addXp(n) {
  state.xp += n; let up = 0;
  while (state.xp >= xpMax(state.level)) { state.xp -= xpMax(state.level); state.level++; up++; }
  return up;
}
export const myScore = () => state.level * 100 + state.xp;
export const isStreamer = () => state.role === 'streamer' || state.role === 'admin';
export const isAdmin = () => state.role === 'admin';
export const roleTag = () => (state.role === 'admin' ? '🛡️ ' : state.role === 'streamer' ? '📡 ' : '');
export const eventActive = () => !!LS('ba_evt', 0);

/** Giriş sonrası bulut profilini yerel duruma uygular (rol sunucudan gelir). */
export function applyCloudProfile(p) {
  if (!p) return;
  ['name', 'avatar', 'level', 'xp', 'coins', 'gems', 'title'].forEach((k) => { if (p[k] != null) state[k] = p[k]; });
  if (Array.isArray(p.inventory)) state.inv = [...new Set([...state.inv, ...p.inventory])];
  if (p.equipped) state.equipped = { ...state.equipped, ...p.equipped };
  if (p.role && ROLE_L[p.role]) state.role = p.role;
  saveState();
}

/* ---------- Ayarlar ---------- */
const SETTINGS_KEY = 'ba_settings_v1';
export const settings = (() => { try { return { quality: 'auto', reduceMotion: false, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; } catch { return { quality: 'auto', reduceMotion: false }; } })();
export const saveSettings = () => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* yok say */ } };

/* ---------- Kozmetik yardımcıları (yayıncı çerçevesi / isim rengi / rozet) ---------- */
const cosCls = (slot) => (isStreamer() ? cosmeticById(state.equipped?.[slot])?.cls || '' : '');
export function myAvatar(cls = 'av') {
  const el = rawAvatar(state.avatar, cls); const f = cosCls('frame'); if (f) el.classList.add(f); return el;
}
export function nameNode(name, me = true) {
  const span = h('span', { class: me ? cosCls('nameColor') : '' }, name);
  const b = me ? cosmeticById(isStreamer() ? state.equipped?.badge : null) : null;
  return b ? h('span', {}, span, ' ', h('span', { class: b.cls }, b.icon)) : span;
}
export const avatarEl = rawAvatar;

/* ============================================================
   GÖREV İLERLEMESİ (günlük/haftalık; features.js ekranı gösterir)
   ============================================================ */
const dayKey = () => new Date().toISOString().slice(0, 10);
const weekKey = () => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
export function questBucket(reset) {
  const k = reset === 'weekly' ? weekKey() : dayKey();
  const b = state.quests[reset];
  if (!b || b.key !== k) state.quests[reset] = { key: k, p: {}, claimed: [] };
  return state.quests[reset];
}
export function trackQuest(metric, n = 1) {
  ['daily', 'weekly'].forEach((r) => { const b = questBucket(r); b.p[metric] = (b.p[metric] || 0) + n; });
}

/* ============================================================
   OYUN YARDIMCILARI
   ============================================================ */
export const BOT_NAMES = ['Zeynep', 'Mert', 'Elif', 'Can', 'Deniz', 'Ayşe', 'Kerem', 'Selin', 'Burak'];
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function makeCode() {
  const a = new Uint32Array(6);
  (globalThis.crypto || { getRandomValues: (x) => x.map(() => Math.random() * 4294967296) }).getRandomValues(a);
  return Array.from(a, (n) => CODE_CHARS[n % CODE_CHARS.length]).join('');
}
export function makeBots(n, skill = 1, exclude = []) {
  const avs = shuffle(AVATARS.filter((a) => a.id !== state.avatar && !exclude.includes(a.id)));
  const names = shuffle(BOT_NAMES);
  return Array.from({ length: n }, (_, i) => ({ name: names[i % names.length], avatar: avs[i % avs.length].id, skill: skill * rand(0.9, 1.1) }));
}
const recKey = (c) => `${c.cat}|${c.diff}|${c.count}|${c.time}`;

/** Soru seçimi: önce görülmemişler (tekrar engeli). */
function pickQuestions({ cat, diff, count }) {
  const seen = new Set(state.seen);
  const byCat = QUESTIONS.filter((q) => cat === 'all' || q.cat === cat);
  const exact = byCat.filter((q) => diff === 'all' || q.d === diff);
  const order = (list) => [...shuffle(list.filter((q) => !seen.has(q.id))), ...shuffle(list.filter((q) => seen.has(q.id)))];
  const chosen = [];
  const add = (list) => { for (const q of order(list)) { if (chosen.length >= count) return; if (!chosen.includes(q)) chosen.push(q); } };
  add(exact); add(byCat); add(QUESTIONS);
  state.seen = [...state.seen, ...chosen.map((q) => q.id)].slice(-QUESTIONS.length);
  if (new Set(state.seen).size >= QUESTIONS.length) state.seen = chosen.map((q) => q.id);
  saveState();
  return shuffle(chosen);
}

/* ---------- Kalabalık simülasyonu: 10.000 kişi = iki tipli dizi ---------- */
export function makeCrowd(n, hard) { const sc = new Int32Array(n), sk = new Float32Array(n); for (let i = 0; i < n; i++) sk[i] = rand(0.5, 1.3) / hard; return { sc, sk }; }
export function crowdRound(c, acc, cnt) {
  for (let i = 0; i < cnt; i++) c.sc[i] += streamPoints(Math.random() < clamp(c.sk[i] * acc, 0.05, 0.95), Math.random());
}
export function crowdTop(c, k, cnt) {
  const t = [];
  for (let i = 0; i < cnt; i++) { const s = c.sc[i]; if (t.length < k || s > t[t.length - 1][0]) { t.push([s, i]); t.sort((a, b) => b[0] - a[0]); if (t.length > k) t.pop(); } }
  return t;
}
export function crowdRankOf(c, score, cnt) { let r = 1; for (let i = 0; i < cnt; i++) if (c.sc[i] > score) r++; return r; }

/* ============================================================
   OYUN EKRANI
   cfg: { cat, diff, count, time, bots, hard?, stream?: {cap}, host?: bool, replay?: fn, label?: string }
   ============================================================ */
export function startMatch(cfg, onDone = () => {}) {
  const qs = pickQuestions(cfg);
  const S = cfg.stream || null;
  const solo = cfg.bots.length === 0 && !S;
  const players = [{ id: 'me', name: roleTag() + state.name, avatar: state.avatar, score: 0, correct: 0, me: true },
    ...cfg.bots.map((b, i) => ({ id: `b${i}`, name: b.name, avatar: b.avatar, skill: b.skill, score: 0, correct: 0 }))];

  let idx = -1, alive = true, roundOver = true, locked = true, cur = null, limit = cfg.time * 1000, startT = 0, tickId = 0, quitAsk = false, lastGain = 0;
  const timers = new Set();
  const crowd = S ? makeCrowd(S.cap, cfg.hard || 1) : null;
  const vcnt = () => (S ? Math.min(S.cap, Math.round(S.cap * Math.min(1, 0.4 + 0.15 * (idx + 1)))) : 0);
  const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); if (alive) fn(); }, ms); timers.add(id); return id; };

  const timeEl = h('b', { class: 'gtime' }, cfg.time);
  const bar = h('i');
  const roundEl = h('span', { class: 'ground' });
  const qEl = h('h2', { class: 'gq' });
  const optsEl = h('div', { class: 'gopts' });
  const fbEl = h('div', { class: 'gfb', 'aria-live': 'polite' });
  const hintBtn = h('button', { class: 'hintbtn', onclick: () => useHint() });
  const boardEl = h('ol', { class: 'gboard', 'aria-label': 'Skor tablosu' });
  const quitBtn = h('button', { class: 'gquit', onclick: () => askQuit() }, '✕ Çık');
  const stage = h('div', { class: 'gstage' });
  const rankEl = h('b', {}, '#–'), scoreEl = h('b', {}, '0'), gainEl = h('small', {});
  const strip = S ? h('div', { class: 'mystrip', 'aria-live': 'polite' }, h('span', {}, '🧑 Sıran ', rankEl), h('span', {}, 'Puan ', scoreEl), gainEl) : null;
  const tierEl = S ? h('span', { class: 'tier-badge' }) : null;
  const main = h('div', { class: 'gmain' },
    h('div', { class: 'gtop' }, quitBtn, roundEl, h('span', { class: 'gcat' }, cfg.cat === 'all' ? '🎲 Karışık' : `${CAT_ICON[cfg.cat] || ''} ${cfg.cat}`),
      h('span', { class: 'gclock' }, '⏱ ', timeEl), tierEl,
      S ? h('button', { class: 'gquit', onclick: () => document.body.classList.toggle('stream-mode') }, '📺 Yayın Modu') : null),
    h('div', { class: 'gbar' }, bar), stage, strip);
  const root = h('div', { id: 'game', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Yarışma' }, main, h('aside', { class: 'gside' }, boardEl));
  document.body.append(root); root.classList.toggle('strm', isStreamer());
  const fx = isStreamer() ? cosCls('effect') : ''; if (fx) root.classList.add(fx);
  document.body.classList.add('in-game');
  const A = globalThis.__arena, d3 = !!(A && A.enterGame);
  if (d3) { root.classList.add('d3'); A.enterGame(players, { viewers: S ? S.cap : 0 }); }

  function cleanup() {
    alive = false; timers.forEach(clearTimeout); timers.clear(); clearInterval(tickId);
    removeEventListener('keydown', onKey); if (d3) A.exitGame(); root.remove(); document.body.classList.remove('in-game', 'stream-mode');
  }
  function askQuit() {
    if (quitAsk) { cleanup(); onDone(); return; }
    quitAsk = true; quitBtn.textContent = 'Emin misin? Tekrar bas'; quitBtn.classList.add('sure');
    later(() => { quitAsk = false; quitBtn.textContent = '✕ Çık'; quitBtn.classList.remove('sure'); }, 3000);
  }
  function onKey(e) {
    if (e.key === 'Escape') askQuit();
    const n = Number(e.key);
    if (n >= 1 && n <= (cur?.opts.length || 4) && !locked && !roundOver) answer(n - 1);
  }
  addEventListener('keydown', onKey);

  /* ----- Skor tablosu ----- */
  function standings(k = STREAM.TOP) {
    const cnt = vcnt();
    const rows = players.map((p) => ({ n: p.name, s: p.score, me: p.me, a: p.avatar, c: p.correct }));
    crowdTop(crowd, k, cnt).forEach(([s, i]) => rows.push({ n: `${BOT_NAMES[i % 9]}${i + 1}`, s, a: AVATARS[i % AVATARS.length].id }));
    rows.sort((a, b) => b.s - a.s);
    const me = players[0];
    const rank = crowdRankOf(crowd, me.score, cnt) + players.filter((p) => !p.me && p.score > me.score).length;
    return { rows: rows.slice(0, k), rank, cnt };
  }
  function drawStream() {
    const { rows, rank } = standings();
    const me = players[0];
    const li = (r, i) => h('li', { class: `grow${r.me ? ' me' : ''}${i === 1 ? ' top1' : i === 2 ? ' top2' : i === 3 ? ' top3' : ''}` },
      h('span', { class: 'rk' }, i), r.me ? myAvatar('av sm') : avatarEl(r.a, 'av sm'),
      h('span', { class: 'nm' }, r.me ? h('span', {}, nameNode(r.n), ' (Sen)') : r.n), h('b', {}, fmt(r.s)));
    boardEl.replaceChildren(...rows.map((r, i) => li(r, i + 1)));
    rankEl.textContent = `#${fmt(rank)}`; scoreEl.textContent = fmt(me.score);
    gainEl.textContent = lastGain ? `${lastGain > 0 ? '+' : ''}${lastGain}` : ''; gainEl.className = lastGain < 0 ? 'neg' : 'pos';
  }
  function drawBoard() {
    if (d3) A.refresh();
    if (S) return drawStream();
    const sorted = players.slice().sort((a, b) => b.score - a.score || b.correct - a.correct);
    boardEl.replaceChildren(...sorted.map((p, i) => h('li', { class: `grow${p.me ? ' me' : ''}${cur?.done.has(p.id) && !roundOver ? ' done' : ''}` },
      h('span', { class: 'rk' }, i + 1), p.me ? myAvatar('av sm') : avatarEl(p.avatar, 'av sm'),
      h('span', { class: 'nm' }, p.me ? h('span', {}, nameNode(p.name), ' (Sen)') : p.name), h('b', {}, fmt(p.score)))));
  }

  function countdown(n) {
    stage.replaceChildren(h('div', { class: 'gcount' }, n > 0 ? n : 'BAŞLA!'));
    if (n < 0) return;
    later(() => (n > 0 ? countdown(n - 1) : nextRound()), n > 0 ? 900 : 600);
  }

  /* ----- İpucu (mağazadan alınır): iki yanlış şıkkı eler ----- */
  function drawHint() { hintBtn.hidden = !(state.hints > 0) || roundOver || locked; hintBtn.textContent = `💡 İpucu (${state.hints})`; }
  function useHint() {
    if (state.hints <= 0 || locked || roundOver || cur.hinted) return;
    cur.hinted = true; state.hints--; saveState();
    shuffle(cur.opts.map((o, i) => ({ o, i })).filter((x) => !x.o.ok)).slice(0, 2).forEach(({ i }) => { optsEl.children[i].disabled = true; optsEl.children[i].classList.add('gone'); });
    drawHint();
  }

  function nextRound() {
    idx++;
    if (idx >= qs.length) return finish();
    const q = qs[idx];
    const viewers = vcnt();
    cur = { q, opts: buildOptions(q, viewers), done: new Set() };        // 500+ → 6 şık
    if (d3 && S) A.setCrowdMode?.(viewers);
    roundOver = false; locked = false; limit = cfg.time * 1000; startT = performance.now();
    roundEl.textContent = `Soru ${idx + 1}/${qs.length}${S ? ' • 👥 ' + fmt(viewers) : ''}`;
    if (tierEl) { const t = streamTier(viewers); tierEl.textContent = `${t.label} • ${t.opts} şık`; tierEl.className = `tier-badge ${t.id === 'mega' ? 'mega' : ''}`; }
    qEl.textContent = q.q;
    fbEl.textContent = ''; fbEl.className = 'gfb';
    optsEl.className = `gopts${cur.opts.length > 4 ? ' six' : ''}`;
    optsEl.replaceChildren(...cur.opts.map((o, i) => h('button', { class: 'gopt', onclick: () => answer(i) }, h('span', { class: 'k' }, i + 1), h('span', {}, o.t))));
    cur.info = { n: idx + 1, total: qs.length, cat: q.cat, diff: DIFF[q.d]?.label || '', q: q.q, left: cfg.time };
    drawHint();
    if (d3) { A.setAnswer(null); A.setView('desk'); A.setQuestion(cur.info); stage.replaceChildren(optsEl, hintBtn, fbEl); }
    else stage.replaceChildren(h('div', { class: 'gdiff' }, S ? 'Hıza göre +100…+1.000 • Yanlış −100…−1.000' : `${DIFF[q.d]?.label || ''} • ${DIFF[q.d]?.pts || 10} puan`), qEl, optsEl, hintBtn, fbEl);
    const r = idx;
    players.filter((p) => !p.me).forEach((p) => {
      const ok = Math.random() < clamp(p.skill * (DIFF[q.d]?.acc || 0.6) / (cfg.hard || 1), 0.05, 0.97);
      const t = limit * rand(0.2, 0.85);
      later(() => { if (r === idx && !roundOver) award(p, ok, t); }, t);
    });
    clearInterval(tickId); tickId = setInterval(tick, 100);
    tick(); drawBoard();
  }

  function award(p, ok, elapsed) {
    const f = clamp(elapsed / limit, 0, 1);
    const pts = S ? streamPoints(ok, f) : (ok ? 10 : -1);          // yayın: hız + −100…−1000 ceza
    p.score += pts; if (ok) p.correct++;
    cur.done.add(p.id);
    if (p.me) { cur.gained = pts; lastGain = pts; }
    drawBoard();
    if (players.every((x) => cur.done.has(x.id))) endRound();
    return pts;
  }

  function tick() {
    const left = Math.max(0, limit - (performance.now() - startT));
    bar.style.width = `${(left / limit) * 100}%`;
    bar.classList.toggle('low', left < limit * 0.25);
    const sec = Math.ceil(left / 1000); timeEl.textContent = sec;
    if (d3 && !roundOver && cur?.info && sec !== cur.info.left) { cur.info.left = sec; A.setQuestion(cur.info); }
    if (left <= 0) { if (!cur.done.has('me')) { locked = true; cur.done.add('me'); } endRound(); }
  }

  function answer(i) {
    if (locked || roundOver) return;
    locked = true;
    const o = cur.opts[i];
    const pts = award(players[0], o.ok, performance.now() - startT);
    cur.pick = i; drawHint();
    optsEl.children[i].classList.add(o.ok ? 'ok' : 'bad');
    fbEl.textContent = o.ok ? `Doğru! +${pts} puan` : `Yanlış cevap ${pts} puan`;
    fbEl.className = `gfb ${o.ok ? 'ok' : 'bad'}`;
    if (!roundOver && solo) endRound();
    if (d3) later(() => { A.setView('wide'); optsEl.classList.add('away'); }, 900);
  }

  function endRound() {
    if (roundOver) return;
    roundOver = true; locked = true; clearInterval(tickId); drawHint();
    [...optsEl.children].forEach((b, i) => { b.disabled = true; if (cur.opts[i].ok) b.classList.add('ok'); });
    if (cur.pick == null) { fbEl.textContent = 'Süre doldu'; fbEl.className = 'gfb bad'; lastGain = 0; }
    if (cur.pick == null || !cur.opts[cur.pick].ok) fbEl.textContent += ` • Doğru: ${cur.opts.find((o) => o.ok).t}`;
    const late = cur.pick == null;
    if (d3) { A.setView('wide'); optsEl.classList.add('away'); A.setAnswer(cur.opts.find((o) => o.ok).t); }
    if (S) crowdRound(crowd, (DIFF[cur.q.d]?.acc || 0.6) / (cfg.hard || 1), vcnt());
    drawBoard();
    later(nextRound, late ? 3200 : 1900);
  }

  /* ----- Maç sonu: ödül, istatistik, görev, geçmiş kaydı ----- */
  function finish() {
    clearInterval(tickId);
    if (d3) { A.setView('wide'); A.setQuestion(null); A.setAnswer(null); }
    const ranked = players.slice().sort((a, b) => b.score - a.score || b.correct - a.correct);
    const me = players[0];
    const st = S ? standings() : null;
    const rank = S ? st.rank : ranked.indexOf(me) + 1;
    const won = !solo && rank === 1;
    const b = state.boosts, boosted = b.matches > 0;
    const evt = eventActive() ? 2 : 1;
    let xp = (me.correct * 6 + (solo ? 5 : won ? 25 : 10)) * evt * (boosted ? b.xpMul : 1);
    let coins = (me.correct * 8 + (won ? 40 : 0)) * (boosted ? b.coinMul : 1);
    if (S) coins += Math.max(0, Math.round(me.score / 50)); // yayında puan altına çevrilir
    if (cfg.daily && state.dailyDone !== dayKey()) { state.dailyDone = dayKey(); coins += 300; xp += 30; }
    xp = Math.round(xp); coins = Math.round(coins);
    if (boosted) b.matches--;
    const s = state.stats;
    s.played++; s.correct += me.correct; s.answered += qs.length;
    if (!solo) { if (won) s.won++; else s.lost++; }
    if (S) { s.streamPlayed = (s.streamPlayed || 0) + 1; if (!s.bestStreamRank || rank < s.bestStreamRank) s.bestStreamRank = rank; }
    if (cfg.cat !== 'all') s.cats[cfg.cat] = (s.cats[cfg.cat] || 0) + me.correct;
    let record = false;
    if (solo) { const k = recKey(cfg); if (me.score > (state.records[k] || 0)) { state.records[k] = me.score; record = true; } }
    trackQuest('played', 1); trackQuest('correct', me.correct); if (won) trackQuest('won', 1); if (S) trackQuest('streamPlayed', 1);
    state.history = [{ t: Date.now(), mode: S ? 'yayın' : solo ? 'tek' : cfg.label || 'maç', cat: cfg.cat, rank, score: me.score, correct: me.correct, total: qs.length, viewers: S ? S.cap : 0 }, ...state.history].slice(0, 30);
    const ups = addXp(xp); state.coins += coins; saveState();

    const row = (p, i) => h('li', { class: `grow res${p.me ? ' me' : ''}` }, h('span', { class: 'rk' }, i + 1), p.me ? myAvatar('av') : avatarEl(p.avatar || p.a, 'av'),
      h('span', { class: 'nm' }, p.me ? `${p.name || p.n} (Sen)` : p.name || p.n), h('small', {}, p.correct != null ? `${p.correct}/${qs.length} doğru` : ''), h('b', {}, fmt(p.score ?? p.s)));
    const title = solo ? 'Yarışma Bitti' : won ? '🏆 Kazandın!' : `${fmt(rank)}. sıradasın`;
    const summary = S
      ? (hooks.podium ? hooks.podium({ rows: st.rows, rank, viewers: st.cnt, cap: S.cap, me, total: qs.length, cfg })
        : h('ol', { class: 'gboard big' }, st.rows.map((r, i) => row(r, i))))
      : h('ol', { class: 'gboard big' }, ranked.map(row));
    const replay = () => { cleanup(); (cfg.replay ? cfg.replay() : startMatch(cfg, onDone)); };
    stage.replaceChildren(h('div', { class: 'gres' },
      h('h2', {}, title),
      record ? h('div', { class: 'grec' }, '⭐ Yeni kişisel rekor!') : null,
      summary,
      S && !st.rows.some((r) => r.me) ? h('div', { class: 'mystrip static' }, `Senin sıran #${fmt(rank)} • ${fmt(me.score)} puan`) : null,
      h('div', { class: 'greward' }, h('span', {}, `+${fmt(xp)} XP`), h('span', {}, `🪙 +${fmt(coins)}`), ups ? h('span', { class: 'up' }, `⬆ Seviye ${state.level}!`) : null,
        boosted ? h('span', {}, '⚡ Güçlendirici aktif') : null, evt > 1 ? h('span', {}, '🎉 Çift XP') : null),
      h('div', { class: 'gbtns' },
        h('button', { class: 'btn-y', onclick: replay }, 'Tekrar Oyna'),
        h('button', { class: 'btn-p', onclick: () => { cleanup(); onDone(); } }, 'Menüye Dön'))));
    roundEl.textContent = 'Sonuç'; bar.style.width = '0'; timeEl.textContent = '–';
    quitBtn.hidden = true; hintBtn.hidden = true; if (strip) strip.hidden = true; drawBoard();
  }

  drawBoard();
  countdown(3);
}

/* ============================================================
   FORM YARDIMCILARI + OYNA EKRANI (bot, tek, dostluk odası, oda bul)
   ============================================================ */
export const CAT_OPTS = [opt('all', '🎲 Karışık'), ...CATS.map((c) => opt(c, `${CAT_ICON[c]} ${c}`))];
export const DIFF_OPTS = [opt('all', 'Karışık'), ...DIFFS.map((d) => opt(d.id, d.label))];
export const COUNT_OPTS = [opt('5', '5 soru'), opt('10', '10 soru'), opt('15', '15 soru')];
export const TIME_OPTS = [opt('10', '10 sn'), opt('15', '15 sn'), opt('20', '20 sn'), opt('30', '30 sn')];

export function countField(v = 10) {
  const out = h('b', {}, v);
  const inp = h('input', { id: 'f-count', type: 'range', min: '10', max: '60', step: '1', value: String(v), class: 'rng', 'aria-label': 'Soru sayısı' });
  inp.addEventListener('input', () => { out.textContent = inp.value; });
  return { sel: inp, row: h('label', { class: 'fld', for: 'f-count' }, h('span', {}, 'Soru sayısı: ', out, ' (10–60)'), inp) };
}
let fid = 0;
export function field(label, id, options, val) {
  const uid = `${id}-${++fid}`;
  const sel = h('select', { id: uid, class: 'sel' }, options.map(([v, l]) => h('option', { value: v, selected: String(v) === String(val) }, l)));
  return { sel, row: h('label', { class: 'fld', for: uid }, h('span', {}, label), sel) };
}

export const DEMO_ROOMS = [
  { code: 'K7M4QX', name: 'Hızlı Bilgi Yarışı', owner: 'Elif', oav: 'a12', cat: 'Genel Kültür', diff: 'o', count: 10, time: 15, max: 8, n: 5, status: 'Bekliyor' },
  { code: 'T3WN9B', name: 'Arkadaşlarla Eğlence', owner: 'Mert', oav: 'a09', cat: 'Film ve Diziler', diff: 'k', count: 10, time: 20, max: 8, n: 4, status: 'Bekliyor' },
  { code: 'H8R2ZD', name: 'Zor Seviye Sorular', owner: 'Deniz', oav: 'a05', cat: 'Bilim', diff: 'z', count: 10, time: 20, max: 6, n: 6, status: 'Dolu' },
  { code: 'P5C6VA', name: 'Oyuncular Arenası', owner: 'Can', oav: 'a15', cat: 'Video Oyunları', diff: 'o', count: 10, time: 15, max: 4, n: 2, status: 'Bekliyor' },
  { code: 'M2F8JE', name: 'Tarih Meraklıları', owner: 'Ayşe', oav: 'a01', cat: 'Tarih', diff: 'u', count: 10, time: 30, max: 8, n: 3, status: 'Oyunda' },
  { code: 'D9Y4SG', name: 'Sabah Isınması', owner: 'Kerem', oav: 'a13', cat: 'Spor', diff: 'k', count: 10, time: 10, max: 5, n: 1, status: 'Bekliyor' },
];
export const allRooms = () => [...DEMO_ROOMS, ...LS('ba_rooms', [])];
const hasDiff = (d) => (DIFF[d] ? d : 'o');

/** Yayın odasına izleyici olarak katılır (bot kalabalıkla). */
export function joinStreamRoom(r, ctx) {
  ctx?.close?.();
  startMatch({ cat: r.cat, diff: r.diff, count: r.count, time: r.time, hard: r.hard, bots: makeBots(5), stream: { cap: r.max }, label: 'yayın' }, () => {});
}

/**
 * Oyna ekranı. ctx: { setTitle, close, isOpen }. start: 'home' | 'find'
 * Dostluk maçı odaları burada; yayıncı modları PLAY_EXTRAS ile eklenir.
 */
export function renderPlay(ctx, start = 'home') {
  const wrap = h('div', { class: 'play' });
  let loop = [];
  const stopLoop = () => { loop.forEach(clearTimeout); loop = []; };
  const live = () => wrap.isConnected && ctx.isOpen();
  const later = (fn, ms) => { const id = setTimeout(() => { if (live()) fn(); }, ms); loop.push(id); };
  const show = (title, node) => { stopLoop(); ctx.setTitle(title); wrap.replaceChildren(node); wrap.scrollTop = 0; };
  const back = (fn, label = '← Geri') => h('button', { class: 'back', onclick: fn }, label);
  const launch = (cfg) => { stopLoop(); ctx.close(); startMatch(cfg, () => {}); };
  const note = h('div', { class: 'note' }, 'Dostluk odalarında diğer oyuncular şimdilik bot olarak simüle edilir (gerçek zamanlı çok oyunculu bağlantı yoktur).');
  const api = { show, back, home: () => home(), launch, later, stopLoop, ctx, card: null };

  const card = (cls, icon, title, sub, badge, fn) => h('button', { class: `mode ${cls}`, onclick: fn },
    h('span', { class: 'mico', 'aria-hidden': 'true' }, icon), h('b', {}, title), h('small', {}, sub), badge ? h('span', { class: 'mbadge' }, badge) : null);
  api.card = card;

  function home() {
    const extras = PLAY_EXTRAS.map((fn) => { try { return fn(api); } catch (e) { console.warn(e); return null; } }).flat().filter(Boolean);
    show('Oyun Modu Seç', h('div', {},
      h('div', { class: 'modes' },
        card('m-bot', '🤖', 'Bot Maçı', 'Botlara karşı yarış', null, () => setup('bot')),
        card('m-solo', '🎯', 'Tek Oyunculu', 'Süreye karşı, rekorunu kır', null, () => setup('solo')),
        card('m-room', '🏠', 'Dostluk Odası Kur', 'Arkadaş maçı odası aç', 'Simüle', () => setup('create')),
        card('m-find', '🔎', 'Oda Bul', 'Açık odalara veya koda katıl', null, find),
        ...extras),
      note));
  }

  function setup(mode) {
    const f = { cat: field('Kategori', 'f-cat', CAT_OPTS, 'all'), diff: field('Zorluk', 'f-diff', DIFF_OPTS, 'all'), count: countField(10), time: field('Soru süresi', 'f-time', TIME_OPTS, '15') };
    const rows = [f.cat.row, f.diff.row, f.count.row, f.time.row];
    let botsSel, lvlSel, nameIn, maxSel, visSel;
    if (mode === 'bot') {
      botsSel = field('Bot sayısı', 'f-bots', [1, 2, 3, 4, 5, 6, 7].map((n) => opt(n, `${n} bot`)), 3);
      lvlSel = field('Bot seviyesi', 'f-lvl', [opt('0.8', 'Kolay'), opt('1', 'Normal'), opt('1.2', 'Usta')], '1');
      rows.push(botsSel.row, lvlSel.row);
    }
    if (mode === 'create') {
      nameIn = h('input', { id: 'f-name', class: 'sel', maxlength: '28', value: `${state.name}'in Odası`, 'aria-label': 'Oda adı' });
      maxSel = field('Maksimum oyuncu', 'f-max', [2, 3, 4, 5, 6, 7, 8].map((n) => opt(n, `${n} oyuncu`)), 4);
      visSel = field('Oda türü', 'f-vis', [opt('public', 'Herkese açık'), opt('private', 'Özel (kodla)')], 'public');
      rows.unshift(h('label', { class: 'fld', for: 'f-name' }, h('span', {}, 'Oda adı'), nameIn), maxSel.row, visSel.row);
    }
    const info = h('div', { class: 'bank' });
    const upd = () => {
      const n = poolSize(f.cat.sel.value, f.diff.sel.value), need = Number(f.count.sel.value);
      info.textContent = n >= need ? `Bu seçimde ${n} soru var (toplam banka: ${fmt(QUESTIONS.length)}).` : `Bu seçimde ${n} soru var; eksikler diğer seviye/kategorilerden tamamlanır.`;
    };
    [f.cat, f.diff, f.count].forEach((x) => x.sel.addEventListener('change', upd)); upd();
    const readCfg = () => ({ cat: f.cat.sel.value, diff: f.diff.sel.value, count: Number(f.count.sel.value), time: Number(f.time.sel.value) });
    const err = h('div', { class: 'ferr', role: 'alert' });
    const go = () => {
      const base = readCfg();
      if (mode === 'solo') return launch({ ...base, bots: [] });
      if (mode === 'bot') return launch({ ...base, bots: makeBots(Number(botsSel.sel.value), Number(lvlSel.sel.value)), label: 'bot' });
      const name = nameIn.value.trim();
      if (name.length < 3) { err.textContent = 'Oda adı en az 3 karakter olmalı.'; return; }
      const room = { code: makeCode(), name, max: Number(maxSel.sel.value), vis: visSel.sel.value, cfg: base, owner: true, players: [] };
      if (room.vis === 'public') LSS('ba_rooms', [...LS('ba_rooms', []), { code: room.code, name, owner: state.name, oav: state.avatar, cat: base.cat === 'all' ? 'Genel Kültür' : base.cat, diff: hasDiff(base.diff === 'all' ? 'o' : base.diff), count: base.count, time: base.time, max: room.max, n: 1, status: 'Bekliyor' }].slice(-30));
      lobby(room);
    };
    const title = { bot: 'Bot Maçı', solo: 'Tek Oyunculu', create: 'Dostluk Odası Kur' }[mode];
    const best = mode === 'solo' ? h('div', { class: 'bank' }, 'Kişisel rekor: ', h('b', {}, fmt(state.records[recKey(readCfg())] || 0)), ' puan (seçili ayarlar için)') : null;
    if (best) [f.cat, f.diff, f.count, f.time].forEach((x) => x.sel.addEventListener('change', () => { best.querySelector('b').textContent = fmt(state.records[recKey(readCfg())] || 0); }));
    show(title, h('div', {}, back(home), h('div', { class: 'form' }, rows), info, h('div', { class: 'bank' }, 'Doğru cevap +10 puan • Yanlış cevap −1 puan'), best, err,
      mode === 'create' ? note : null, h('button', { class: 'btn-y go', onclick: go }, mode === 'create' ? 'Odayı Oluştur' : 'Başla')));
  }

  /* ----- Oda bul (dostluk + yayın odaları) ----- */
  function find() {
    const q = h('input', { class: 'sel', type: 'search', placeholder: 'Oda, sahip veya kod ara…', 'aria-label': 'Oda ara' });
    const cat = h('select', { class: 'sel', 'aria-label': 'Kategori filtresi' }, CAT_OPTS.map(([v, l]) => h('option', { value: v }, v === 'all' ? 'Tüm kategoriler' : l)));
    const list = h('div', { class: 'rooms' });
    const codeIn = h('input', { class: 'sel code', maxlength: '6', placeholder: 'ODA KODU', 'aria-label': 'Oda kodu', autocapitalize: 'characters' });
    const err = h('div', { class: 'ferr', role: 'alert' });
    let remote = [];
    const rooms = () => { const seen = new Set(); return [...allRooms(), ...remote].filter((r) => { const k = r.code || r.id; if (seen.has(k)) return false; seen.add(k); return true; }); };
    const join = (r) => {
      if (r.stream) return joinStreamRoom(r, ctx);
      const others = makeBots(Math.max(0, r.n - 1), 1, [r.oav]);
      lobby({ code: r.code, name: r.name, max: r.max, vis: 'public', owner: false, ownerBot: { name: r.owner, avatar: r.oav, skill: 1 },
        cfg: { cat: r.cat, diff: r.diff, count: r.count, time: r.time }, players: others });
    };
    const draw = () => {
      const t = q.value.trim().toLocaleLowerCase('tr'), c = cat.value;
      const rs = rooms().filter((r) => (c === 'all' || r.cat === c) && (!t || [r.name, r.owner, r.code].some((x) => String(x || '').toLocaleLowerCase('tr').includes(t))));
      list.replaceChildren(...(rs.length ? rs.map((r) => {
        const open = r.status === 'Bekliyor';
        return h('div', { class: 'room' }, avatarEl(r.oav || 'a10', 'av'),
          h('div', { class: 'rinfo' }, h('b', {}, (r.stream ? '📡 ' : '') + r.name), h('small', {}, `👑 ${r.owner} • ${CAT_ICON[r.cat] || ''} ${r.cat} • ${DIFF[r.diff]?.label || 'Karışık'}`)),
          h('span', { class: 'rcnt' }, `${fmt(r.n)}/${fmt(r.max)}`), h('span', { class: `rst ${open ? 'on' : 'off'}` }, r.status),
          h('button', { class: 'btn-y', disabled: !open, onclick: () => join(r) }, 'Katıl'));
      }) : [h('p', { class: 'empty' }, 'Eşleşen oda bulunamadı.')]));
    };
    q.addEventListener('input', draw); cat.addEventListener('change', draw); draw();
    listStreamRooms().then((rs) => {
      remote = (rs || []).map((r) => ({ ...r, owner: r.ownerName || r.owner, oav: r.oav || 'a10', status: r.status || 'Bekliyor', stream: 1, cat: r.cat === 'all' ? 'Genel Kültür' : r.cat, diff: hasDiff(r.diff === 'all' ? 'o' : r.diff) }));
      if (live()) draw();
    }).catch(() => {});
    const byCode = () => {
      const code = codeIn.value.trim().toUpperCase();
      const r = rooms().find((x) => x.code === code);
      if (!r) { err.textContent = `"${code || '—'}" kodlu oda bulunamadı.`; return; }
      if (r.status !== 'Bekliyor') { err.textContent = 'Bu oda dolu ya da oyun başlamış.'; return; }
      join(r);
    };
    show('Oda Bul', h('div', {}, back(home), note, h('div', { class: 'frow' }, q, cat), list,
      h('div', { class: 'frow code-row' }, codeIn, h('button', { class: 'btn-p', onclick: byCode }, 'Koda Katıl')), err));
  }

  /* ----- Dostluk bekleme odası (simüle oyuncular) ----- */
  function lobby(room) {
    const me = { name: state.name, avatar: state.avatar, me: true };
    const owner = room.owner ? me : room.ownerBot;
    const players = [owner, ...(room.owner ? [] : [me]), ...room.players.filter((p) => p !== owner)];
    const slots = h('div', { class: 'slots' });
    const status = h('div', { class: 'lstat' });
    const startBtn = h('button', { class: 'btn-y go', disabled: true }, 'Oyunu Başlat');
    let started = false;
    const close = () => LSS('ba_rooms', LS('ba_rooms', []).filter((r) => r.code !== room.code || r.stream));
    const draw = () => {
      slots.replaceChildren(...Array.from({ length: room.max }, (_, i) => {
        const p = players[i];
        return p ? h('div', { class: `slot${p.me ? ' me' : ''}` }, p.me ? myAvatar('av') : avatarEl(p.avatar, 'av'), h('span', {}, `${p === owner ? '👑 ' : ''}${p.name}${p.me ? ' (Sen)' : ''}`))
          : h('div', { class: 'slot empty' }, h('span', { class: 'av ph' }, '+'), h('span', {}, 'Boş'));
      }));
      startBtn.disabled = !room.owner || started;
      status.textContent = room.owner ? 'Kontenjanı beklemeden istediğin an başlatabilirsin.' : 'Oda sahibinin oyunu başlatması bekleniyor…';
    };
    const begin = () => {
      if (started) return; started = true; draw(); close();
      const bots = players.filter((p) => !p.me).map((p) => ({ name: p.name, avatar: p.avatar, skill: p.skill || rand(0.9, 1.1) }));
      let n = 3; const tick = () => { status.textContent = `Başlıyor: ${n}…`; if (n-- > 0) later(tick, 900); else launch({ ...room.cfg, bots, label: 'dostluk' }); }; tick();
    };
    startBtn.addEventListener('click', begin);
    const copy = h('button', { class: 'btn-p', onclick: () => {
      const text = `Bilgi Arenası oda kodu: ${room.code}`;
      (navigator.clipboard?.writeText(text) || Promise.reject()).then(() => { copy.textContent = 'Kopyalandı ✓'; }, () => { copy.textContent = text; });
    } }, 'Kodu Kopyala / Davet Et');
    const c = room.cfg;
    show(room.name, h('div', {}, back(() => { started = true; stopLoop(); if (room.owner) close(); home(); }, '← Odadan Ayrıl'), note,
      h('div', { class: 'lcode' }, h('small', {}, room.vis === 'private' ? 'Özel oda kodu' : 'Oda kodu'), h('b', {}, room.code), copy),
      h('div', { class: 'lcfg' }, h('span', {}, c.cat === 'all' ? '🎲 Karışık' : `${CAT_ICON[c.cat] || ''} ${c.cat}`), h('span', {}, c.diff === 'all' ? 'Karışık zorluk' : DIFF[c.diff]?.label), h('span', {}, `${c.count} soru`), h('span', {}, `${c.time} sn`), h('span', {}, `${room.max} kişilik`)),
      slots, status, room.owner ? startBtn : null));
    const target = room.owner ? Math.min(room.max, Math.max(2, 2 + Math.floor(Math.random() * 3))) : Math.min(room.max, Math.max(players.length, 3));
    const spawn = () => {
      if (started || players.length >= target) return;
      players.push(makeBots(1, 1, players.map((p) => p.avatar))[0]); draw(); later(spawn, rand(1200, 2600));
    };
    later(spawn, 1200);
    if (!room.owner) later(begin, 7000);
    draw();
  }

  if (start === 'find') find(); else home();
  return wrap;
}
