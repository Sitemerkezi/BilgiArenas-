/* ============================================================
   js/admin.js — Yönetici Paneli (yalnızca yetkili hesaplar)

   GÜVENLİK: Buradaki rol kontrolü yalnızca arayüzü gizler. Asıl koruma
   Firestore güvenlik kurallarıdır (js/firebase.js sonundaki kurallar):
   istemci "admin" gibi görünse bile sunucu yetkisiz yazmayı reddeder.
   ============================================================ */
import { CATS, STREAM_CATS, DIFFS, QUESTIONS, mergeCustomQuestions, avatarSrc } from './data.js';
import { h, fmt, LS, state, isAdmin, ROLE_L, ui, eventActive } from './game.js';
import {
  isOnline, status, trError, adminListUsers, adminSetRole, adminBan, adminHide, adminUpdateUser, adminAddQuestion, adminDeleteQuestion,
  adminPostAnnouncement, adminSetEvent, listAnnouncements, listStreamerRequests, resolveStreamerRequest,
} from './firebase.js';

const msgBox = () => h('div', { class: 'msg', role: 'status' });
const say = (el, text, ok = true) => { el.className = `msg ${ok ? 'ok' : 'err'}`; el.textContent = text; };
const fail = (el, e) => say(el, e?.userMessage || trError(e), false);
const norm = (u) => ({ ...u, id: u.id || u.name, av: u.av || u.avatar || 'a10', score: u.score ?? u.xp ?? 0, coins: u.coins ?? 0, gems: u.gems ?? 0, role: u.role || 'user' });
const numIn = (v, onSet) => h('input', { type: 'number', min: '0', value: v, style: 'width:92px', 'aria-label': 'Sayı', onchange: (e) => onSet(Math.max(0, Number(e.target.value) || 0)) });

export function renderAdmin() {
  if (!isAdmin()) return h('p', { class: 'empty' }, '🔒 Bu panel yalnızca yetkili yönetici hesaplarına açıktır.');
  const body = h('div', {}), tabs = h('div', { class: 'tabs', role: 'tablist' });
  let tab = 'Kullanıcılar';

  /* ---------- Kullanıcılar: bakiye, ban, rol ---------- */
  async function usersTab() {
    const wrap = h('div', { class: 'apanel' }), msg = msgBox(), box = h('div', { class: 'tbl-wrap' });
    const find = h('input', { type: 'search', placeholder: 'Kullanıcı ara…', 'aria-label': 'Kullanıcı ara' });
    let all = [];
    const draw = () => {
      const t = find.value.trim().toLocaleLowerCase('tr');
      const rows = all.filter((u) => !t || u.name?.toLocaleLowerCase('tr').includes(t)).slice(0, 60);
      box.replaceChildren(h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, ['Oyuncu', 'Altın', 'Elmas', 'Puan', 'Rol', 'Durum'].map((x) => h('th', {}, x)))),
        h('tbody', {}, rows.map((u) => {
          const self = u.name === state.name;
          return h('tr', {}, h('td', {}, h('img', { src: avatarSrc(u.av), alt: '', width: '26', height: '26', style: 'border-radius:50%;vertical-align:middle;margin-right:6px' }), u.name, self ? ' (Sen)' : ''),
            h('td', {}, numIn(u.coins, (v) => act(() => adminUpdateUser(u.id, { coins: v }), 'Altın güncellendi ✓'))),
            h('td', {}, numIn(u.gems, (v) => act(() => adminUpdateUser(u.id, { gems: v }), 'Elmas güncellendi ✓'))),
            h('td', {}, numIn(u.score, (v) => act(() => adminUpdateUser(u.id, { score: v }), 'Puan güncellendi ✓'))),
            h('td', {}, h('select', { 'aria-label': 'Rol', disabled: self, onchange: (e) => act(() => adminSetRole(u.id, e.target.value), `${u.name} → ${ROLE_L[e.target.value]} ✓`) },
              Object.entries(ROLE_L).map(([v, l]) => h('option', { value: v, selected: u.role === v }, l)))),
            h('td', {}, u.banned ? h('span', { class: 'tag banned' }, 'Banlı') : h('span', { class: 'tag ok' }, 'Aktif'), ' ',
              h('button', { class: `btn-s${u.banned ? '' : ' danger'}`, disabled: self, onclick: () => act(() => adminBan(u.id, !u.banned), u.banned ? 'Ban kaldırıldı ✓' : 'Kullanıcı banlandı ✓') }, u.banned ? 'Banı Kaldır' : 'Banla')));
        }))));
    };
    const load = async () => { try { all = (await adminListUsers()).map(norm); draw(); } catch (e) { fail(msg, e); } };
    async function act(fn, ok) { try { await fn(); say(msg, ok); await load(); } catch (e) { fail(msg, e); } }
    find.addEventListener('input', draw);
    wrap.append(h('div', { class: 'fb-status off' }, status()), find, msg, box, h('div', { class: 'note' }, 'Değişiklikler kutudan çıkınca (Enter/odak kaybı) kaydedilir. Kendi rolünü ve banını değiştiremezsin.'));
    await load();
    return wrap;
  }

  /* ---------- Yayıncı başvuruları ---------- */
  async function requestsTab() {
    const wrap = h('div', { class: 'apanel' }), msg = msgBox(), list = h('div', { class: 'rooms' });
    const load = async () => {
      try {
        const rs = await listStreamerRequests();
        list.replaceChildren(...(rs.length ? rs.map((r) => h('div', { class: 'room' }, h('div', { class: 'rinfo' }, h('b', {}, `Başvuru: ${String(r.id).slice(0, 8)}`), h('small', {}, r.note || '(not yok)')),
          h('button', { class: 'btn-y', onclick: () => act(r.id, true) }, 'Onayla'), h('button', { class: 'btn-s danger', onclick: () => act(r.id, false) }, 'Reddet'))) : [h('p', { class: 'empty' }, 'Bekleyen başvuru yok.')]));
      } catch (e) { fail(msg, e); }
    };
    async function act(id, ok) { try { await resolveStreamerRequest(id, ok); say(msg, ok ? 'Yayıncı rolü verildi ✓' : 'Başvuru reddedildi.'); await load(); } catch (e) { fail(msg, e); } }
    wrap.append(msg, list); await load(); return wrap;
  }

  /* ---------- Sorular: ekle / sil ---------- */
  function questionsTab() {
    const wrap = h('div', { class: 'apanel' }), msg = msgBox();
    const cat = h('select', { 'aria-label': 'Kategori' }, [...CATS, ...STREAM_CATS].map((c) => h('option', { value: c }, c)));
    const d = h('select', { 'aria-label': 'Zorluk' }, DIFFS.map((x) => h('option', { value: x.id }, x.label)));
    const q = h('input', { placeholder: 'Soru metni', 'aria-label': 'Soru metni' });
    const os = [1, 2, 3, 4].map((i) => h('input', { placeholder: i === 1 ? '1. şık (DOĞRU cevap)' : `${i}. şık`, 'aria-label': `${i}. şık` }));
    const find = h('input', { type: 'search', placeholder: 'Silmek için soru ara…', 'aria-label': 'Soru ara' }), list = h('div', { class: 'rooms' });
    const drawL = () => {
      const t = find.value.trim().toLocaleLowerCase('tr');
      list.replaceChildren(...(t ? QUESTIONS.filter((x) => x.q.toLocaleLowerCase('tr').includes(t)).slice(0, 8).map((x) => h('div', { class: 'room' },
        h('div', { class: 'rinfo' }, h('b', {}, x.q), h('small', {}, `${x.cat} • ${x.d}`)),
        h('button', { class: 'btn-s danger', onclick: async () => { try { await adminDeleteQuestion(x.q); mergeCustomQuestions([], [x.q]); say(msg, 'Soru silindi ✓'); drawL(); } catch (e) { fail(msg, e); } } }, 'Sil'))) : []));
    };
    find.addEventListener('input', drawL);
    const add = async () => {
      const opts = os.map((o) => o.value.trim());
      if (!q.value.trim() || opts.some((o) => !o) || new Set(opts).size < 4) { say(msg, 'Soru ve 4 farklı şık gerekli.', false); return; }
      try {
        const nq = await adminAddQuestion({ cat: cat.value, d: d.value, q: q.value, opts, a: 0 });
        mergeCustomQuestions([nq]); say(msg, `Soru eklendi ✓ (toplam ${fmt(QUESTIONS.length)})`); q.value = ''; os.forEach((o) => { o.value = ''; });
      } catch (e) { fail(msg, e); }
    };
    wrap.append(h('div', { class: 'box' }, h('b', {}, 'Yeni soru'), h('div', { class: 'row2' }, cat, d), q, ...os, h('button', { class: 'btn-y', onclick: add }, 'Soru Ekle'),
      h('small', {}, '6 şıklı yayın odaları ek şıkları soru bankasından otomatik tamamlar.')), h('div', { class: 'box' }, h('b', {}, 'Soru sil'), find, list), msg);
    return wrap;
  }

  /* ---------- Duyuru ve etkinlik ---------- */
  async function announceTab() {
    const wrap = h('div', { class: 'apanel' }), msg = msgBox(), hist = h('div', { class: 'rooms' });
    const t = h('input', { maxlength: '80', placeholder: 'Duyuru başlığı', 'aria-label': 'Duyuru başlığı' });
    const b = h('textarea', { rows: '2', maxlength: '400', placeholder: 'Duyuru metni', 'aria-label': 'Duyuru metni' });
    const evt = h('input', { type: 'checkbox', checked: eventActive(), 'aria-label': 'Çift XP etkinliği', onchange: async (e) => {
      try { await adminSetEvent(e.target.checked); ui.notify?.(e.target.checked ? '🎉 Etkinlik başladı: Çift XP!' : 'Çift XP etkinliği sona erdi.'); say(msg, e.target.checked ? 'Etkinlik açıldı ✓' : 'Etkinlik kapatıldı.'); }
      catch (er) { fail(msg, er); e.target.checked = !e.target.checked; }
    } });
    const loadH = async () => { try { const l = await listAnnouncements(); hist.replaceChildren(...l.slice(0, 5).map((a) => h('div', { class: 'room' }, h('div', { class: 'rinfo' }, h('b', {}, a.title), h('small', {}, a.body))))); } catch { /* sessiz */ } };
    wrap.append(h('div', { class: 'box' }, h('b', {}, 'Genel duyuru'), t, b, h('button', { class: 'btn-p', onclick: async () => {
      if (!t.value.trim()) { say(msg, 'Başlık gerekli.', false); return; }
      try { const a = await adminPostAnnouncement(t.value, b.value); ui.notify?.(`${a.title}${a.body ? ' — ' + a.body : ''}`); say(msg, 'Duyuru yayınlandı ✓'); t.value = ''; b.value = ''; loadH(); } catch (e) { fail(msg, e); }
    } }, 'Duyur')),
    h('div', { class: 'box' }, h('div', { class: 'row' }, h('b', {}, 'Çift XP etkinliği'), h('label', { class: 'switch' }, evt, h('i')))),
    h('div', { class: 'box' }, h('b', {}, 'Son duyurular'), hist), msg);
    await loadH(); return wrap;
  }

  /* ---------- Liderlik moderasyonu: gizle / banla / puan sıfırla ---------- */
  async function boardTab() {
    const wrap = h('div', { class: 'apanel' }), msg = msgBox(), list = h('div', { class: 'lb' });
    let all = [];
    const draw = () => list.replaceChildren(...all.sort((a, b) => b.score - a.score).slice(0, 50).map((u, i) => h('div', { class: `lbrow${u.hidden || u.banned ? ' hid' : ''}` },
      h('span', { class: 'rk' }, i + 1), h('img', { src: avatarSrc(u.av), alt: '', class: 'av' }), h('span', { class: 'nm' }, `${u.name}${u.hidden ? ' 🙈' : ''}${u.banned ? ' 🚫' : ''}`), h('b', {}, fmt(u.score)),
      h('button', { class: 'btn-s', onclick: () => act(() => adminHide(u.id, !u.hidden), u.hidden ? 'Tabloda tekrar görünür ✓' : 'Tablodan gizlendi ✓') }, u.hidden ? 'Göster' : 'Gizle'),
      h('button', { class: 'btn-s', onclick: () => act(() => adminUpdateUser(u.id, { score: 0 }), 'Puan sıfırlandı ✓') }, 'Sıfırla'),
      h('button', { class: 'btn-s danger', disabled: u.name === state.name, onclick: () => act(() => adminBan(u.id, !u.banned), u.banned ? 'Ban kaldırıldı ✓' : 'Banlandı ✓') }, u.banned ? 'Banı Kaldır' : 'Banla'))));
    const load = async () => { try { all = (await adminListUsers()).map(norm); draw(); } catch (e) { fail(msg, e); } };
    async function act(fn, ok) { try { await fn(); say(msg, ok); await load(); } catch (e) { fail(msg, e); } }
    wrap.append(msg, list, h('div', { class: 'note' }, 'Gizlenen ve banlı oyuncular herkese açık liderlik tablosunda görünmez.')); await load(); return wrap;
  }

  const T = { 'Kullanıcılar': usersTab, 'Yayıncı Başvuruları': requestsTab, 'Sorular': async () => questionsTab(), 'Duyuru ve Etkinlik': announceTab, 'Liderlik Moderasyonu': boardTab };
  const show = async () => {
    tabs.replaceChildren(...Object.keys(T).map((k) => h('button', { class: `tab${k === tab ? ' on' : ''}`, role: 'tab', 'aria-selected': String(k === tab), onclick: () => { tab = k; show(); } }, k)));
    body.replaceChildren(h('p', { class: 'empty' }, 'Yükleniyor…'));
    const mine = tab; const node = await T[tab]();
    if (mine === tab) body.replaceChildren(node);
  };
  show();
  return h('div', {}, tabs, body, h('div', { class: 'note' }, isOnline() ? 'Firebase bağlı: işlemler sunucu kurallarıyla doğrulanır.' : 'Yerel yedek mod: işlemler yalnızca bu cihazda geçerlidir.'));
}
