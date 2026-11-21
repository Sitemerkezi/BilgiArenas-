/* ============================================================
   js/app.js — Uygulama girişi (ES modülü)
   HUD, bildirimler, sunucu kartları, ayarlar, panel/modal yönetimi,
   rol/yetki kontrolü, buton görünürlükleri ve 3D sahne başlatma.
   ============================================================ */
import { QUESTIONS, mergeCustomQuestions, CAT_ICON, DIFF } from './data.js';
import {
  $, h, fmt, LS, LSS, state, saveState, subscribe, xpMax, settings, saveSettings, isStreamer, isAdmin, ROLE_L, ui,
  avatarEl, myAvatar, applyCloudProfile, myScore, allRooms, renderPlay, eventActive,
} from './game.js';
import {
  initFirebase, status, isOnline, currentUser, loadProfile, onStatusChange, listCustomQuestions, listDeletedQuestions, getEventFlag, listAnnouncements, listStreamRooms,
} from './firebase.js';
import {
  renderAccount, renderProfile, renderShop, renderLeaderboard, renderFriends, renderQuests, renderDaily, renderAchievements, renderEvents,
} from './features.js';
import { renderStreamRoom, renderCosmetics, registerStreamerModes } from './streamer.js';
import { renderAdmin } from './admin.js';

/* ============================================================
   Yerel geliştirici notu (ROL GÜVENLİĞİ):
   • Çevrimiçi modda rol SUNUCUDAN (Firestore users/{uid}.role) okunur; istemci değiştiremez.
   • Çevrimdışı/yerel modda varsayılan rol "user"dür. Test için tarayıcı konsolunda:
       localStorage.setItem('ba_local_role', 'admin')   // veya 'streamer'
     Bu yalnızca KENDİ cihazında geçerlidir; güvenlik sınırı değildir.
   ============================================================ */

/* ---------- Bildirimler (cihazda saklanır) ---------- */
const NKEY = 'ba_notifs';
const DEFAULT_NOTIFS = [
  { id: 1, text: 'Hoş geldin! Günlük görevler hazır.', time: 'Şimdi', read: false },
  { id: 2, text: 'Yayıncı odalarında 500+ katılımcıda sorular 6 şıklı olur.', time: 'Bilgi', read: false },
];
let notifs = LS(NKEY, DEFAULT_NOTIFS);
const saveNotifs = () => LSS(NKEY, notifs.slice(0, 30));
ui.notify = (text) => { if (notifs.some((n) => n.text === text)) return; notifs.unshift({ id: Date.now(), text, time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }), read: false }); saveNotifs(); renderBadge(); };
ui.toast = (text) => {
  const t = h('div', { class: 'toast', role: 'status' }, text); document.body.append(t);
  setTimeout(() => t.classList.add('show'), 20); setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2600);
};

/* ============================================================
   HUD
   ============================================================ */
function renderHud() {
  const p = state, max = xpMax(p.level);
  $('#pName').textContent = p.name;
  $('#pLevel').textContent = p.level;
  $('#coins').textContent = fmt(p.coins);
  $('#gems').textContent = fmt(p.gems);
  $('#xpBar').style.width = `${Math.round((p.xp / max) * 100)}%`;
  $('#xpTxt').textContent = `${fmt(p.xp)} / ${fmt(max)}`;
  $('.xp').setAttribute('aria-valuenow', p.xp); $('.xp').setAttribute('aria-valuemax', max);
  $('#pAvatar').replaceChildren(myAvatar('avimg'));
  const crown = $('.pname span[aria-hidden]'); if (crown) crown.textContent = p.role === 'admin' ? '🛡️' : p.role === 'streamer' ? '📡' : '👑';
}
function renderBadge() {
  const n = notifs.filter((x) => !x.read).length, b = $('#notifBadge');
  b.textContent = n; b.hidden = n === 0;
}
let remoteRooms = [];
function renderServers() {
  const ul = $('#serverList');
  const rooms = [...remoteRooms, ...allRooms()].filter((r) => r.status === 'Bekliyor').slice(0, 3);
  ul.replaceChildren(...(rooms.length ? rooms.map((s, i) => {
    const filled = Math.max(1, Math.round((s.n / s.max) * 3));
    const bars = h('span', { class: 'bars', 'aria-hidden': 'true' }, [1, 2, 3].map((k) => h('i', { style: `height:${k * 5}px;${k > filled ? 'opacity:.25' : ''}` })));
    return h('li', {}, h('button', { class: 'srow', 'data-panel': 'servers' }, h('span', { 'aria-hidden': 'true' }, s.stream ? '📡' : ['⚡', '👥', '⭐'][i % 3]),
      h('span', { class: 'sn' }, s.name), h('span', {}, `${fmt(s.n)}/${fmt(s.max)}`), bars));
  }) : [h('li', {}, h('small', {}, 'Şu an açık oda yok.'))]));
  const demo = $('.servers .demo'); if (demo) demo.textContent = isOnline() ? 'Canlı yayın odaları ve dostluk odaları' : 'Örnek odalar ve bu cihazdaki odalar';
}
function startDailyTimer() {
  const el = $('#dailyTimer');
  const tick = () => {
    const now = new Date(), end = new Date(now); end.setHours(24, 0, 0, 0);
    const d = Math.max(0, Math.floor((end - now) / 1000)), p = (n) => String(n).padStart(2, '0');
    el.textContent = `${p(Math.floor(d / 3600))}:${p(Math.floor((d % 3600) / 60))}:${p(d % 60)}`;
  };
  tick(); setInterval(tick, 1000);
}

/* ============================================================
   Rol / yetki kontrolü ve buton görünürlükleri
   ============================================================ */
let banned = false;
function ensureRoleButtons() {
  const hud = $('.hud'), settingsBtn = hud.querySelector('[data-panel="settings"]');
  const mk = (id, icon, panel, label) => { let b = $(`#${id}`); if (!b) { b = h('button', { id, class: 'ibtn', 'data-panel': panel, 'aria-label': label, title: label }, icon); hud.insertBefore(b, settingsBtn); } return b; };
  mk('streamBtn', '📡', 'streamroom', 'Yayıncı Odası'); mk('adminBtn', '🛠️', 'admin', 'Yönetici Paneli');
}
function applyVisibility() {
  ensureRoleButtons();
  $('#streamBtn').hidden = !isStreamer();
  $('#adminBtn').hidden = !isAdmin();
  document.body.classList.toggle('role-streamer', isStreamer()); document.body.classList.toggle('role-admin', isAdmin());
  renderHud();
  if (!isAdmin() && !modal.hidden && curPanel === 'admin') closePanel();
}
/** Rolü sunucudan (çevrimiçi) veya yerel yedekten belirler. */
async function refreshRole() {
  let role = 'user';
  if (isOnline() && currentUser()) {
    const p = await loadProfile().catch(() => null);
    role = p?.role && ROLE_L[p.role] ? p.role : 'user'; banned = !!p?.banned;
  } else { const r = LS('ba_local_role', 'user'); role = ROLE_L[r] ? r : 'user'; banned = false; }
  if (role !== state.role) { state.role = role; saveState(); }
  applyVisibility();
}
ui.refreshRole = refreshRole;

/* ============================================================
   Ayarlar paneli
   ============================================================ */
let arena = null, resolveQuality = () => 'medium';
function renderSettings() {
  const sel = h('select', { 'aria-label': 'Grafik kalitesi', onchange: (e) => { settings.quality = e.target.value; saveSettings(); arena?.setQuality(resolveQuality(settings.quality)); } },
    [['auto', 'Otomatik'], ['low', 'Düşük'], ['medium', 'Orta'], ['high', 'Yüksek']].map(([v, l]) => h('option', { value: v, selected: settings.quality === v }, l)));
  const chk = h('input', { type: 'checkbox', checked: settings.reduceMotion, 'aria-label': 'Hareketi azalt', onchange: (e) => {
    settings.reduceMotion = e.target.checked; saveSettings(); document.body.classList.toggle('reduce-motion', settings.reduceMotion); arena?.setReduceMotion(settings.reduceMotion);
  } });
  return h('div', { class: 'apanel' },
    h('div', { class: `fb-status ${isOnline() ? 'on' : 'off'}` }, status()),
    h('div', { class: 'row' }, h('div', {}, h('b', {}, 'Hesap'), h('br'), h('small', {}, currentUser()?.email || (isOnline() ? 'Misafir' : 'Yerel profil'))), h('button', { class: 'btn-p', 'data-panel': 'account' }, 'Hesap / Giriş')),
    h('div', { class: 'row' }, h('div', {}, h('b', {}, 'Rol'), h('br'), h('small', {}, 'Sunucudan doğrulanır')), h('span', { class: `tag ${state.role}` }, ROLE_L[state.role])),
    isStreamer() ? h('button', { class: 'btn-s', 'data-panel': 'cosmetics' }, '✨ Yayıncı Kozmetikleri') : null,
    isAdmin() ? h('button', { class: 'btn-y go', 'data-panel': 'admin' }, '🛠 Yönetici Paneli') : null,
    h('div', { class: 'row' }, h('div', {}, h('b', {}, 'Grafik kalitesi'), h('br'), h('small', {}, 'Düşük: akıcılık, Yüksek: gölgeler')), sel),
    h('div', { class: 'row' }, h('div', {}, h('b', {}, 'Hareketi azalt'), h('br'), h('small', {}, 'Animasyonları sakinleştirir')), h('label', { class: 'switch' }, chk, h('i'))),
    h('div', { class: 'note' }, 'Ses, dil ve gizlilik ayarları henüz eklenmedi (ses dosyası yok).'));
}

function renderNotifications() {
  const list = h('div', {});
  const draw = () => list.replaceChildren(...(notifs.length ? notifs.map((n) => h('div', { class: `nitem${n.read ? '' : ' unread'}` }, h('div', {}, n.text), h('small', {}, n.time))) : [h('p', { class: 'empty' }, 'Bildirim yok.')]));
  draw();
  return h('div', {}, list, h('button', { class: 'btn-p', onclick: () => { notifs.forEach((n) => { n.read = true; }); saveNotifs(); draw(); renderBadge(); } }, 'Tümünü okundu say'));
}
const soon = (icon, text) => () => h('div', { class: 'soon' }, h('div', { class: 'big' }, icon), h('div', { class: 'note' }, text));

/* ============================================================
   Panel / modal yönetimi
   ============================================================ */
const modal = $('#modal'), mTitle = $('#modalTitle'), mBody = $('#modalBody');
let lastFocus = null, curPanel = '';
const playCtx = () => ({ setTitle: (t) => { mTitle.textContent = t; }, close: () => closePanel(), isOpen: () => !modal.hidden });

const PANELS = {
  play: { title: 'Oyun Modu Seç', wide: true, render: () => renderPlay(playCtx()) },
  servers: { title: 'Sunucular', wide: true, render: () => renderPlay(playCtx(), 'find') },
  profile: { title: 'Profil', render: renderProfile },
  character: { title: 'Karakter', render: () => h('div', { class: 'apanel' }, renderProfile(), isStreamer() ? renderCosmetics() : h('div', { class: 'note' }, 'Özel çerçeve, isim rengi ve rozetler yayıncı hesaplarına açıktır.')) },
  quests: { title: 'Görevler', render: renderQuests },
  shop: { title: 'Mağaza', wide: true, render: renderShop },
  leaderboard: { title: 'Liderlik Tablosu', render: renderLeaderboard },
  world: { title: 'Dünya Sıralaması', render: renderLeaderboard },
  friends: { title: 'Arkadaşlar', render: renderFriends },
  notifications: { title: 'Bildirimler', render: renderNotifications },
  settings: { title: 'Ayarlar', render: renderSettings },
  achievements: { title: 'Başarımlar', render: renderAchievements },
  events: { title: 'Etkinlikler', render: renderEvents },
  daily: { title: 'Günlük Meydan Okuma', render: () => renderDaily(playCtx()) },
  premium: { title: 'Premium Pass', render: soon('👑', 'Premium Pass henüz yayında değil. Şu an hiçbir ödeme alınmaz.') },
  account: { title: 'Hesap ve Giriş', render: renderAccount },
  cosmetics: { title: 'Yayıncı Kozmetikleri', need: 'streamer', render: renderCosmetics },
  streamroom: { title: 'Yayıncı Odası', wide: true, render: () => renderStreamRoom(playCtx()) },
  admin: { title: 'Yönetici Paneli', wide: true, need: 'admin', render: renderAdmin },
};

function openPanel(id) {
  const p = PANELS[id];
  if (!p) { console.warn('Bilinmeyen panel:', id); return; }
  if (p.need === 'admin' && !isAdmin()) { ui.toast('Bu bölüm yalnızca yöneticilere açıktır.'); return; }
  if (p.need === 'streamer' && !isStreamer()) { ui.toast('Bu bölüm yalnızca yayıncılara açıktır.'); return; }
  if ((id === 'play' || id === 'daily') && banned) { ui.toast('Hesabın askıya alınmış. Oynayamazsın.'); return; }
  closeDrawer();
  lastFocus = document.activeElement; curPanel = id;
  mTitle.textContent = p.title;
  $('.sheet').classList.toggle('wide', !!p.wide);
  mBody.replaceChildren(p.render());
  modal.hidden = false;
  $('#modalClose').focus();
}
function closePanel() { modal.hidden = true; curPanel = ''; mBody.replaceChildren(); lastFocus?.focus?.(); }
ui.openPanel = openPanel; ui.closePanel = closePanel;

$('#modalClose').addEventListener('click', closePanel);
modal.addEventListener('click', (e) => { if (e.target === modal) closePanel(); });
addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (!modal.hidden) closePanel(); else closeDrawer(); } });
document.addEventListener('click', (e) => { const b = e.target.closest('[data-panel]'); if (b) openPanel(b.dataset.panel); });

/* Çekmece (mobil / düşük yükseklik) */
function closeDrawer() { document.body.classList.remove('drawer-open'); $('#drawerToggle').setAttribute('aria-expanded', 'false'); }
$('#drawerToggle').addEventListener('click', () => { const open = document.body.classList.toggle('drawer-open'); $('#drawerToggle').setAttribute('aria-expanded', String(open)); });
$('#drawerBackdrop').addEventListener('click', closeDrawer);

/* ============================================================
   Başlat
   ============================================================ */
document.body.classList.toggle('reduce-motion', settings.reduceMotion);
const loading = $('#loading');
const hideLoading = () => loading.classList.add('done');
setTimeout(hideLoading, 6000);

registerStreamerModes();
mergeCustomQuestions(LS('ba_cq', []), LS('ba_delq', []));   // yerel özel sorular (çevrimdışı da çalışır)
subscribe(renderHud);
ensureRoleButtons(); applyVisibility(); renderBadge(); renderServers(); startDailyTimer();
setInterval(renderServers, 5000);

/* Firebase: arka planda bağlanır; başarısız olursa oyun yerel modda sorunsuz çalışır. */
(async () => {
  try {
    await initFirebase();
    onStatusChange(() => { refreshRole(); renderServers(); });
    await refreshRole();
    if (isOnline()) {
      const p = await loadProfile().catch(() => null);
      if (p && p.id !== 'local' && (p.score || 0) > myScore()) applyCloudProfile(p);   // bulut daha ilerideyse al
      else saveState();                                                                   // yerel daha ilerideyse buluta yaz
      mergeCustomQuestions(await listCustomQuestions().catch(() => []), await listDeletedQuestions().catch(() => []));
      LSS('ba_evt', (await getEventFlag().catch(() => eventActive())) ? 1 : 0);
      (await listAnnouncements().catch(() => [])).slice(0, 3).reverse().forEach((a) => ui.notify(`${a.title}${a.body ? ' — ' + a.body : ''}`));
      remoteRooms = (await listStreamRooms().catch(() => [])).map((r) => ({ ...r, owner: r.ownerName || r.owner, status: r.status || 'Bekliyor', stream: 1 }));
    }
  } catch (e) { console.warn('Firebase başlangıcı atlandı:', e); }
  renderServers(); renderHud();
})();

/* 3D sahne ayrı yüklenir: Three.js/WebGL açılamasa bile menü çalışır (gradyan arka plan kalır). */
import('./arena3d.js').then((m) => {
  resolveQuality = m.resolveQuality;
  arena = m.createArena({ canvas: $('#stage'), quality: m.resolveQuality(settings.quality), reduceMotion: settings.reduceMotion,
    onCharacter: ({ kind }) => { $('#phTag').hidden = kind !== 'placeholder'; } });
  window.__arena = arena;                      // game.js 3D arenayı buradan kullanır
  if (arena) arena.ready.then(hideLoading); else hideLoading();
}).catch((err) => { console.error('3D sahne başlatılamadı:', err); hideLoading(); });
