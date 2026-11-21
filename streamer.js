/* ============================================================
   js/streamer.js — Yayıncı özellikleri (ES modülü)

   • Yayıncı kozmetikleri (çerçeve, isim rengi, rozet, efekt)
   • Oyna ekranında "Yayıncı Bot Modu" (anında, 10–10.000 kişilik bot kalabalığı)
   • Ayrı "Yayıncı Odası" ekranı: oda kodu, canlı katılımcı sayacı,
     gelmeyenleri beklemeden başlatma, maç sonunda tekrar oynama
   • Maç sonu ilk 10 podyum özeti (game.js hooks.podium)
   Yayıncı rolü sunucudan (Firestore) doğrulanır; bu dosya yalnızca arayüzdür.
   ============================================================ */
import { CAT_ICON, STREAM, STREAM_CATS, STREAMER_COSMETICS, optionCountFor, streamTier } from './data.js';
import {
  h, fmt, LS, LSS, state, saveState, isStreamer, ui, avatarEl, myAvatar, nameNode, makeCode, makeBots, startMatch,
  field, countField, opt, CAT_OPTS, DIFF_OPTS, TIME_OPTS, PLAY_EXTRAS, hooks, roleTag,
} from './game.js';
import { createStreamRoom, closeStreamRoom, equipItem, requestStreamerRole, trError } from './firebase.js';

const msgBox = () => h('div', { class: 'ferr', role: 'alert' });
const STREAM_CAT_OPTS = [...CAT_OPTS, ...STREAM_CATS.map((c) => opt(c, `${CAT_ICON[c]} ${c}`))];
const STREAM_DIFF_OPTS = [...DIFF_OPTS, opt('x1', '🔥 Zorlu Kalabalık'), opt('x2', '💀 Dahi Kalabalık')];
const capOptions = () => STREAM.CAPS.map((n) => opt(n, `${fmt(n)} kişi${n >= STREAM.SIX_AT ? ' • 6 şık' : ''}`));

/** Form değerlerinden maç ayarı üretir (x1/x2 = botların zorluk çarpanı). */
function readStreamCfg(f) {
  const dv = f.diff.sel.value, hard = dv === 'x1' ? 1.25 : dv === 'x2' ? 1.6 : 1;
  return { cat: f.cat.sel.value, diff: hard > 1 ? 'u' : dv, count: Number(f.count.sel.value), time: Number(f.time.sel.value), hard };
}
const rulesNote = () => h('div', { class: 'bank' }, `Doğru: hıza göre +100…+1.000 • Yanlış: −100…−1.000 • ${fmt(STREAM.SIX_AT)}+ katılımcıda 6 şık • Ekranda ilk ${STREAM.TOP} ve senin sıran gösterilir`);

/* ============================================================
   MAÇ SONU: İLK 10 PODYUM ÖZETİ
   ============================================================ */
export function renderPodium({ rows, rank, viewers, cap, me, total }) {
  const t = streamTier(cap);
  const slot = (r, place) => (r ? h('div', { class: `pod p${place}${r.me ? ' me' : ''}` },
    h('span', { class: 'pmedal' }, ['🥇', '🥈', '🥉'][place - 1]), r.me ? myAvatar('av') : avatarEl(r.a, 'av'),
    h('b', { class: 'pnm' }, r.me ? 'Sen' : r.n), h('small', {}, fmt(r.s)), h('i', { class: 'pbase' }, place)) : h('div', { class: 'pod empty' }));
  const rest = rows.slice(3).map((r, i) => h('li', { class: `grow res${r.me ? ' me' : ''}` }, h('span', { class: 'rk' }, i + 4), r.me ? myAvatar('av sm') : avatarEl(r.a, 'av sm'),
    h('span', { class: 'nm' }, r.me ? 'Sen' : r.n), h('b', {}, fmt(r.s))));
  return h('div', { class: 'podium' },
    h('div', { class: 'phead2' }, h('span', { class: `tier-badge ${t.id === 'mega' ? 'mega' : ''}` }, `${t.label} • ${t.opts} şık`), h('span', { class: 'live-count' }, `${fmt(viewers)} katılımcı`)),
    h('div', { class: 'pods' }, slot(rows[1], 2), slot(rows[0], 1), slot(rows[2], 3)),
    rest.length ? h('ol', { class: 'gboard big' }, rest) : null,
    h('div', { class: `mystrip static${rows.some((r) => r.me) ? ' in' : ''}` }, `🧑 Sıran #${fmt(rank)} • ${fmt(me.score)} puan • ${me.correct}/${total} doğru`));
}
hooks.podium = renderPodium;

/* ============================================================
   KOZMETİKLER (yalnızca yayıncı/yönetici)
   ============================================================ */
const SLOTS = [['frame', '🖼️ Avatar Çerçevesi'], ['nameColor', '🎨 İsim Rengi'], ['badge', '🏷️ Rozet'], ['effect', '✨ Oda Efekti']];
export function renderCosmetics() {
  if (!isStreamer()) return h('p', { class: 'empty' }, 'Yayıncı kozmetikleri yalnızca yayıncı hesaplarına açıktır.');
  const wrap = h('div', { class: 'apanel' });
  const msg = msgBox();
  const pick = async (slot, id) => {
    const next = state.equipped[slot] === id ? null : id;
    state.equipped = { ...state.equipped, [slot]: next }; saveState(); draw();
    try { await equipItem(slot, next); msg.className = 'msg ok'; msg.textContent = next ? 'Kozmetik uygulandı ✓' : 'Kozmetik kaldırıldı.'; }
    catch (e) { msg.className = 'ferr'; msg.textContent = e.userMessage || trError(e); }
  };
  const draw = () => wrap.replaceChildren(
    h('div', { class: 'box' }, h('b', {}, 'Önizleme'), h('div', { class: 'row' }, myAvatar('av'), h('span', {}, nameNode(roleTag() + state.name)))),
    ...SLOTS.map(([slot, label]) => h('div', { class: 'box' }, h('b', {}, label),
      h('div', { class: 'cos-pick' }, STREAMER_COSMETICS.filter((c) => c.type === slot).map((c) =>
        h('button', { 'aria-pressed': String(state.equipped[slot] === c.id), onclick: () => pick(slot, c.id) }, h('span', { 'aria-hidden': 'true' }, c.icon), h('small', {}, c.name)))))),
    msg);
  draw();
  return wrap;
}

/* ============================================================
   YAYINCI ODASI (ayrı ekran) — kurulum → bekleme odası (kod) → maç
   ============================================================ */
export function renderStreamRoom(ctx) {
  const wrap = h('div', { class: 'play' });
  let loop = [];
  const stop = () => { loop.forEach(clearTimeout); loop = []; };
  const live = () => wrap.isConnected && (ctx.isOpen?.() ?? true);
  const later = (fn, ms) => { const id = setTimeout(() => { if (live()) fn(); }, ms); loop.push(id); };
  const show = (title, node) => { stop(); ctx.setTitle?.(title); wrap.replaceChildren(node); wrap.scrollTop = 0; };

  if (!isStreamer()) return renderApply();

  function renderApply() {
    const note = h('textarea', { class: 'sel', rows: '3', maxlength: '300', placeholder: 'Kanalın / yayın platformun (isteğe bağlı)', 'aria-label': 'Başvuru notu' });
    const msg = msgBox();
    wrap.replaceChildren(h('div', { class: 'apanel' }, h('div', { class: 'box' }, h('h3', {}, '📡 Yayıncı Odası'),
      h('p', {}, 'Yayıncı odası 10.000 kişiye kadar katılımcıyı destekler. Bu özellik yayıncı hesaplarına açıktır.'),
      note, msg, h('button', { class: 'btn-y', onclick: async () => {
        try { await requestStreamerRole(note.value); msg.className = 'msg ok'; msg.textContent = 'Başvurun alındı. Yönetici onayından sonra rolün güncellenir ✓'; }
        catch (e) { msg.className = 'ferr'; msg.textContent = e.userMessage || trError(e); }
      } }, 'Yayıncı Olmak İçin Başvur'))));
    return wrap;
  }

  /* ----- Kurulum ----- */
  function setup() {
    const f = { cat: field('Kategori', 'sr-cat', STREAM_CAT_OPTS, 'all'), diff: field('Zorluk', 'sr-diff', STREAM_DIFF_OPTS, 'all'), count: countField(15),
      time: field('Soru süresi', 'sr-time', TIME_OPTS, '15'), cap: field('Kapasite', 'sr-cap', capOptions(), 1000) };
    const nameIn = h('input', { id: 'sr-name', class: 'sel', maxlength: '28', value: `${state.name} Yayını`, 'aria-label': 'Oda adı' });
    const err = msgBox();
    const info = h('div', { class: 'bank' });
    const upd = () => { const cap = Number(f.cap.sel.value), t = streamTier(cap); info.textContent = `${t.label}: ${t.opts} şıklı sorular.`; };
    f.cap.sel.addEventListener('change', upd); upd();
    const go = async () => {
      const name = nameIn.value.trim();
      if (name.length < 3) { err.textContent = 'Oda adı en az 3 karakter olmalı.'; return; }
      err.className = 'msg'; err.textContent = 'Oda oluşturuluyor…';
      const cfg = readStreamCfg(f), cap = Number(f.cap.sel.value), code = makeCode();
      try {
        const room = await createStreamRoom({ ...cfg, name, max: cap, code, oav: state.avatar, ownerName: state.name });
        lobby({ ...room, code, name, max: cap, cfg });
      } catch (e) { err.className = 'ferr'; err.textContent = e.userMessage || trError(e); }
    };
    show('Yayıncı Odası', h('div', {},
      h('div', { class: 'form' }, h('label', { class: 'fld', for: 'sr-name' }, h('span', {}, 'Oda adı'), nameIn), f.cat.row, f.diff.row, f.count.row, f.time.row, f.cap.row),
      info, rulesNote(), err,
      h('button', { class: 'btn-y go', onclick: go }, 'Yayıncı Odasını Aç'),
      h('button', { class: 'btn-s', onclick: () => ui.openPanel('cosmetics') }, '✨ Kozmetiklerim')));
  }

  /* ----- Bekleme odası: oda kodu + canlı sayaç + hemen başlat ----- */
  function lobby(room) {
    let started = false, n = 1;
    const cnt = h('b', {}, '1');
    const fill = h('i', { style: 'width:0%' });
    const rm = () => { LSS('ba_rooms', LS('ba_rooms', []).filter((r) => r.code !== room.code)); if (room.id) closeStreamRoom(room.id).catch(() => {}); };
    const copy = h('button', { class: 'btn-p', onclick: () => {
      const t = `Bilgi Arenası yayın odası kodu: ${room.code}`;
      (navigator.clipboard?.writeText(t) || Promise.reject()).then(() => { copy.textContent = 'Kopyalandı ✓'; }, () => { copy.textContent = t; });
    } }, 'Kodu Kopyala / Davet Et');
    const play = () => startMatch({ ...room.cfg, bots: makeBots(5), stream: { cap: room.max }, host: true, label: 'yayın', replay: play }, () => {});
    const begin = () => { if (started) return; started = true; stop(); rm(); ctx.close?.(); play(); };   // gelmeyenleri beklemeden başlat
    const tick = () => {
      if (started) return;
      n = Math.min(room.max, n + Math.ceil(room.max * (0.01 + Math.random() * 0.05)));
      cnt.textContent = fmt(n); fill.style.width = `${Math.round((n / room.max) * 100)}%`;
      const all = LS('ba_rooms', []), r = all.find((x) => x.code === room.code); if (r) { r.n = n; LSS('ba_rooms', all); }
      later(tick, 1000);
    };
    show(room.name, h('div', {},
      h('button', { class: 'back', onclick: () => { started = true; stop(); rm(); setup(); } }, '← Odayı Kapat'),
      h('div', { class: 'lcode' }, h('small', {}, '📡 Yayın odası kodu'), h('b', {}, room.code), copy),
      h('div', { class: 'lcfg' }, h('span', {}, '👥 ', cnt, ` / ${fmt(room.max)}`), h('span', {}, `${room.cfg.count} soru`), h('span', {}, `${room.cfg.time} sn`), h('span', {}, `${optionCountFor(room.max)} şık`)),
      h('div', { class: 'qbar' }, fill),
      h('div', { class: 'bank' }, 'İzleyiciler “Oda Bul” ekranında kodu veya oda adını aratıp katılır. 3D sahnede yalnızca ilk oyuncular çizilir; kalabalık liste olarak yönetilir.'),
      h('div', { class: 'lstat' }, 'Gelmeyenleri beklemeden istediğin an başlatabilirsin.'),
      h('button', { class: 'btn-y go', onclick: begin }, '▶ Şimdi Başlat')));
    later(tick, 1000);
  }

  setup();
  return wrap;
}

/* ============================================================
   OYNA EKRANINA EK MOD KARTLARI
   ============================================================ */
function botModeForm(api) {
  const f = { cat: field('Kategori', 'bm-cat', STREAM_CAT_OPTS, 'all'), diff: field('Zorluk', 'bm-diff', STREAM_DIFF_OPTS, 'all'), count: countField(15),
    time: field('Soru süresi', 'bm-time', TIME_OPTS, '15'), cap: field('Bot kalabalığı', 'bm-cap', capOptions(), 500) };
  const go = () => {
    const cfg = readStreamCfg(f), cap = Number(f.cap.sel.value);
    const run = () => api.launch({ ...cfg, bots: makeBots(5), stream: { cap }, label: 'yayın-bot', replay: run });
    run();
  };
  api.show('Yayıncı Bot Modu', h('div', {}, api.back(api.home),
    h('div', { class: 'note' }, 'Oda kurmadan, bot izleyici kalabalığına karşı yayın deneyimini dene. Oda kodu üretilmez; maç hemen başlar.'),
    h('div', { class: 'form' }, f.cat.row, f.diff.row, f.count.row, f.time.row, f.cap.row), rulesNote(),
    h('button', { class: 'btn-y go', onclick: go }, 'Başla')));
}

/** app.js açılışta bir kez çağırır; kartlar rol değişince de doğru görünür (kontrol her çizimde). */
export function registerStreamerModes() {
  PLAY_EXTRAS.push((api) => {
    if (!isStreamer()) return null;
    return [
      api.card('m-room', '🤖', 'Yayıncı Bot Modu', 'Bot kalabalığa karşı anında', 'Yayıncı', () => botModeForm(api)),
      api.card('m-room', '📡', 'Yayıncı Odası', 'Kodlu oda • 10.000 kişiye kadar', 'Yayıncı', () => { api.ctx.close(); ui.openPanel('streamroom'); }),
    ];
  });
}
