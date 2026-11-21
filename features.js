/* ============================================================
   js/features.js — Hesap/giriş, profil, mağaza, liderlik tablosu,
   arkadaşlar, görevler (+ günlük meydan okuma, başarımlar, etkinlikler)
   Tüm ekranlar Türkçedir; her render fonksiyonu bir DOM düğümü döndürür.
   ============================================================ */
import { AVATARS, CAT_ICON, SHOP_ITEMS, QUESTS, shopItemById } from './data.js';
import {
  h, fmt, LS, state, saveState, addXp, myScore, isStreamer, roleTag, ROLE_L, ui, avatarEl, myAvatar, nameNode,
  makeBots, startMatch, questBucket, eventActive, applyCloudProfile,
} from './game.js';
import {
  status, isOnline, currentUser, registerEmail, loginEmail, logout, resetPassword, loadProfile, trError,
  getLeaderboard, listFriends, sendFriendRequest, acceptFriend, removeFriend, addToInventory,
} from './firebase.js';

const NAME_RE = /^[\p{L}\p{N}_ ]{3,16}$/u;
const NAME_MSG = 'Kullanıcı adı 3-16 karakter olmalı (harf, rakam, boşluk, _).';
const tabsBar = (items, cur, set) => h('div', { class: 'tabs', role: 'tablist' }, items.map(([id, label]) =>
  h('button', { class: `tab${id === cur ? ' on' : ''}`, role: 'tab', 'aria-selected': String(id === cur), onclick: () => set(id) }, label)));
const msgBox = () => h('div', { class: 'ferr', role: 'alert' });

/* ============================================================
   HESAP / GİRİŞ
   ============================================================ */
export function renderAccount() {
  const wrap = h('div', { class: 'apanel' });
  const draw = () => {
    const u = currentUser(), msg = msgBox();
    const email = h('input', { type: 'email', placeholder: 'E-posta', autocomplete: 'email', 'aria-label': 'E-posta' });
    const pass = h('input', { type: 'password', placeholder: 'Şifre (en az 6 karakter)', autocomplete: 'current-password', 'aria-label': 'Şifre' });
    const run = async (fn, okText) => {
      msg.className = 'ferr'; msg.textContent = 'Lütfen bekleyin…';
      try {
        await fn();
        if (isOnline()) { const p = await loadProfile(); if (p && p.id !== 'local') applyCloudProfile(p); }
        await ui.refreshRole?.();
        msg.className = 'msg ok'; msg.textContent = okText; setTimeout(draw, 600);
      } catch (e) { msg.className = 'msg err'; msg.textContent = e.userMessage || trError(e); }
    };
    const parts = [h('div', { class: `fb-status ${isOnline() ? 'on' : 'off'}` }, status())];
    if (!isOnline()) {
      parts.push(h('div', { class: 'note' }, 'Hesap girişi için firebaseConfig doldurulmalı ve internet bağlantısı olmalı. Şu an ilerlemen yalnızca bu cihazda saklanıyor.'));
    } else if (u && !u.anonymous) {
      parts.push(h('div', { class: 'box' }, h('b', {}, '✅ Giriş yapıldı'), h('div', {}, u.email), h('div', {}, 'Rol: ', h('span', { class: `tag ${state.role}` }, ROLE_L[state.role])),
        h('div', { class: 'row2' }, h('button', { class: 'btn-s', onclick: () => run(logout, 'Çıkış yapıldı.') }, 'Çıkış Yap'),
          h('button', { class: 'btn-s', onclick: () => run(async () => { const p = await loadProfile(); if (p) applyCloudProfile(p); }, 'Profil buluttan yenilendi ✓') }, 'Buluttan Yenile'))));
    } else {
      parts.push(h('div', { class: 'box' }, h('b', {}, u ? 'Misafir hesabı' : 'Giriş yap veya kayıt ol'),
        h('small', {}, u ? 'Kayıt olursan misafir ilerlemen hesabına bağlanır.' : 'Misafir olarak da oynayabilirsin.'), email, pass,
        h('div', { class: 'row2' }, h('button', { class: 'btn-y', onclick: () => run(() => registerEmail(email.value.trim(), pass.value, state.name), 'Kayıt başarılı ✓') }, 'Kayıt Ol'),
          h('button', { class: 'btn-p', onclick: () => run(() => loginEmail(email.value.trim(), pass.value), 'Giriş başarılı ✓') }, 'Giriş Yap')),
        h('button', { class: 'btn-s', onclick: () => run(() => resetPassword(email.value.trim()), 'Şifre sıfırlama e-postası gönderildi.') }, 'Şifremi unuttum')));
    }
    parts.push(msg);
    wrap.replaceChildren(...parts);
  };
  draw();
  return wrap;
}

/* ============================================================
   PROFİL
   ============================================================ */
export function renderProfile() {
  const st = state.stats;
  const fav = Object.entries(st.cats).sort((x, y) => y[1] - x[1])[0];
  const rate = st.won + st.lost ? Math.round((st.won / (st.won + st.lost)) * 100) : 0;
  const err = msgBox();
  const nameIn = h('input', { class: 'sel', id: 'p-name', maxlength: '16', value: state.name, 'aria-label': 'Kullanıcı adı' });
  const bigAv = h('div', { class: 'pbig' }, myAvatar('avimg'));
  const grid = h('div', { class: 'avgrid', role: 'radiogroup', 'aria-label': 'Profil fotoğrafı' });
  const unlocked = (id) => AVATARS.findIndex((a) => a.id === id) < 10 || state.inv.includes('av_' + id) || state.avatar === id || isStreamer();
  const drawGrid = () => grid.replaceChildren(...AVATARS.map((a) => {
    const ok = unlocked(a.id);
    return h('button', { class: `avpick${a.id === state.avatar ? ' sel' : ''}${ok ? '' : ' locked'}`, role: 'radio', 'aria-checked': String(a.id === state.avatar),
      'aria-label': ok ? a.name : `${a.name} (kilitli, mağazada)`, title: ok ? a.name : 'Mağazadan açılır',
      onclick: () => { if (!ok) { ui.openPanel('shop'); return; } state.avatar = a.id; saveState(); bigAv.replaceChildren(myAvatar('avimg')); drawGrid(); } },
    avatarEl(a.id, 'av'), ok ? null : h('span', { class: 'lock', 'aria-hidden': 'true' }, '🔒'));
  }));
  drawGrid();
  const saveName = (e) => {
    e.preventDefault();
    const v = nameIn.value.trim();
    if (!NAME_RE.test(v)) { err.className = 'ferr'; err.textContent = NAME_MSG; return; }
    state.name = v; saveState(); err.textContent = 'Kaydedildi ✓';
  };
  const stat = (l, v) => h('div', { class: 'stat' }, h('b', {}, v), h('small', {}, l));
  const recs = Object.entries(state.records).sort((x, y) => y[1] - x[1]).slice(0, 3);
  const hist = state.history.slice(0, 5);
  return h('div', { class: 'prof' },
    h('div', { class: 'phead' }, bigAv, h('form', { onsubmit: saveName }, h('label', { for: 'p-name' }, 'Kullanıcı adı'),
      h('div', { class: 'frow' }, nameIn, h('button', { class: 'btn-p', type: 'submit' }, 'Kaydet')), err)),
    h('p', {}, h('span', { class: `tag ${state.role}` }, roleTag() + ROLE_L[state.role]), state.title ? h('span', { class: 'tag ok' }, ` 🎓 ${state.title}`) : null, ' ', h('small', {}, `Puan: ${fmt(myScore())}`)),
    h('div', { class: 'stats' }, stat('Seviye', state.level), stat('Oyun', st.played), stat('Galibiyet', st.won), stat('Mağlubiyet', st.lost), stat('Kazanma oranı', `%${rate}`), stat('Doğru cevap', st.correct)),
    h('p', { class: 'favc' }, 'Favori kategori: ', h('b', {}, fav ? `${CAT_ICON[fav[0]] || ''} ${fav[0]}` : 'Henüz yok')),
    st.streamPlayed ? h('p', { class: 'favc' }, `📡 Yayın maçı: ${st.streamPlayed} • En iyi sıra: #${fmt(st.bestStreamRank)}`) : null,
    recs.length ? h('div', { class: 'recs' }, h('b', {}, 'Kişisel rekorlar'), recs.map(([k, v]) => { const [c, , n, t] = k.split('|'); return h('small', {}, `${c === 'all' ? 'Karışık' : c} • ${n} soru • ${t} sn → ${fmt(v)} puan`); })) : null,
    hist.length ? h('div', { class: 'recs' }, h('b', {}, 'Son maçlar'), hist.map((m) => h('small', {}, `${new Date(m.t).toLocaleDateString('tr-TR')} • ${m.mode} • #${fmt(m.rank)} • ${m.correct}/${m.total} doğru • ${fmt(m.score)} puan`))) : null,
    h('b', { class: 'pick-t' }, 'Profil fotoğrafını seç'), grid,
    h('button', { class: 'btn-s', onclick: () => ui.openPanel('account') }, '🔐 Hesap ve Giriş'),
    h('div', { class: 'note' }, isOnline() ? 'Profilin hesabına bağlı olarak buluta kaydedilir.' : 'Profil bilgilerin şimdilik yalnızca bu cihazda saklanır.'));
}

/* ============================================================
   MAĞAZA
   ============================================================ */
const KIND_TABS = [['all', 'Tümü'], ['boost', '⚡ Güçlendirici'], ['chest', '🎁 Sandık'], ['avatar', '🧑‍🎤 Avatar'], ['title', '🎓 Unvan']];
const owns = (it) => (it.kind === 'avatar' ? state.inv.includes(it.id) : it.kind === 'title' ? state.inv.includes(it.id) : false);
export function renderShop() {
  const wrap = h('div', { class: 'apanel' });
  let tab = 'all', msg = '';
  const buy = async (it) => {
    const key = it.cur === 'gems' ? 'gems' : 'coins';
    if (owns(it)) { msg = 'Bu ürüne zaten sahipsin.'; return draw(); }
    if (state[key] < it.price) { msg = `Yetersiz ${key === 'gems' ? 'elmas' : 'altın'}.`; return draw(); }
    state[key] -= it.price;
    if (it.kind === 'boost') {
      const d = it.data;
      if (d.hints) state.hints += d.hints;
      else { state.boosts.xpMul = Math.max(state.boosts.xpMul, d.xpMul || 1); state.boosts.coinMul = Math.max(state.boosts.coinMul, d.coinMul || 1); state.boosts.matches += d.matches; }
      msg = `${it.name} satın alındı ✓`;
    } else if (it.kind === 'chest') {
      const win = Math.round(it.data.min + Math.random() * (it.data.max - it.data.min)), gem = Math.random() < (it.data.gemChance || 0) ? 5 + Math.floor(Math.random() * 11) : 0;
      state.coins += win; state.gems += gem; msg = `Sandıktan 🪙 ${fmt(win)}${gem ? ` ve 💎 ${gem}` : ''} çıktı!`;
    } else if (it.kind === 'title') {
      state.title = it.data.title; state.inv.push(it.id); addToInventory(it.id).catch(() => {}); msg = `Unvanın “${it.data.title}” oldu ✓`;
    } else if (it.kind === 'avatar') {
      state.inv.push(it.id); addToInventory(it.id).catch(() => {}); msg = `${it.name} açıldı. Profilden seçebilirsin ✓`;
    }
    saveState(); draw();
  };
  const draw = () => {
    const items = SHOP_ITEMS.filter((i) => tab === 'all' || i.kind === tab);
    wrap.replaceChildren(
      h('div', { class: 'row' }, h('b', {}, `🪙 ${fmt(state.coins)}  💎 ${fmt(state.gems)}`), state.hints ? h('small', {}, `💡 ${state.hints} ipucu`) : null,
        state.boosts.matches > 0 ? h('small', {}, `⚡ ${state.boosts.matches} maç güçlendirici`) : null),
      tabsBar(KIND_TABS, tab, (t) => { tab = t; msg = ''; draw(); }),
      msg ? h('div', { class: 'msg ok', role: 'status' }, msg) : null,
      h('div', { class: 'shop-grid' }, items.map((it) => {
        const have = owns(it);
        return h('div', { class: `sitem${have ? ' owned' : ''}` }, h('span', { class: 'sic', 'aria-hidden': 'true' }, it.icon), h('b', {}, it.name), h('small', {}, it.desc),
          h('span', { class: `price ${it.cur}` }, it.cur === 'gems' ? '💎' : '🪙', fmt(it.price)),
          h('button', { class: 'btn-y', disabled: have, onclick: () => buy(it) }, have ? 'Sahipsin' : 'Satın Al'));
      })),
      h('div', { class: 'note' }, 'Oyun içi ürünler yalnızca oyun parasıyla alınır; gerçek para harcaması yoktur.'));
  };
  draw();
  return wrap;
}

/* ============================================================
   LİDERLİK TABLOSU
   ============================================================ */
export function renderLeaderboard() {
  const wrap = h('div', { class: 'apanel' });
  const body = h('div', { class: 'lb' });
  let tab = 'all', rows = [], friends = new Set();
  const draw = () => {
    let list = rows.map((r) => ({ ...r }));
    if (!list.some((r) => r.me) && !list.some((r) => r.name === state.name)) list.push({ name: state.name, xp: myScore(), av: state.avatar, role: state.role, me: true });
    list.forEach((r) => { if (r.me || r.name === state.name) { r.me = true; r.xp = myScore(); r.av = state.avatar; r.role = state.role; } });
    if (tab === 'friends') list = list.filter((r) => r.me || friends.has(r.name));
    if (tab === 'streamers') list = list.filter((r) => r.role === 'streamer' || r.role === 'admin');
    list.sort((a, b) => b.xp - a.xp);
    body.replaceChildren(...(list.length ? list.slice(0, 50).map((r, i) => h('div', { class: `lbrow${r.me ? ' me' : ''}` },
      h('span', { class: 'rk' }, i + 1), r.me ? myAvatar('av') : avatarEl(r.av, 'av'),
      h('span', { class: 'nm' }, r.me ? h('span', {}, nameNode(roleTag() + r.name), ' (Sen)') : `${r.role === 'admin' ? '🛡️ ' : r.role === 'streamer' ? '📡 ' : ''}${r.name}`),
      h('b', {}, `${fmt(r.xp)} puan`))) : [h('p', { class: 'empty' }, 'Bu sekmede henüz oyuncu yok.')]));
  };
  const bar = () => tabsBar([['all', '🌍 Genel'], ['friends', '🫂 Arkadaşlar'], ['streamers', '📡 Yayıncılar']], tab, (t) => { tab = t; wrap.replaceChildren(bar(), body, note); draw(); });
  const note = h('div', { class: 'note' }, isOnline() ? 'Sıralama, hesaplardaki toplam puana göre canlı olarak alınır.' : 'Çevrimdışı mod: örnek oyuncular ve senin yerel puanın gösteriliyor.');
  wrap.replaceChildren(bar(), body, note);
  getLeaderboard(50).then((r) => { rows = r || []; draw(); }).catch(() => draw());
  listFriends().then((f) => { friends = new Set((f || []).filter((x) => x.status === 'accepted').map((x) => x.name)); if (tab === 'friends') draw(); }).catch(() => {});
  draw();
  return wrap;
}

/* ============================================================
   ARKADAŞLAR
   ============================================================ */
export function renderFriends() {
  const wrap = h('div', { class: 'prof' });
  const err = msgBox();
  const inp = h('input', { class: 'sel', maxlength: '16', placeholder: 'Arkadaşının kullanıcı adı', 'aria-label': 'Arkadaş kullanıcı adı' });
  const list = h('div', { class: 'rooms' });
  let fr = [];
  const refresh = async () => { try { fr = (await listFriends()) || []; } catch { fr = []; } draw(); };
  const act = async (fn, okText) => { try { await fn(); err.className = 'msg ok'; err.textContent = okText; } catch (e) { err.className = 'ferr'; err.textContent = e.userMessage || trError(e); } refresh(); };
  const draw = () => list.replaceChildren(...(fr.length ? fr.map((f) => h('div', { class: 'room' }, avatarEl(f.avatar || 'a10', 'av'),
    h('div', { class: 'rinfo' }, h('b', {}, f.name), h('small', {}, f.status === 'pending-in' ? '📩 İstek gönderdi' : f.status === 'pending-out' ? '⏳ İstek beklemede' : '🤝 Arkadaş')),
    f.status === 'pending-in' ? h('button', { class: 'btn-y', onclick: () => act(() => acceptFriend(f.id), `${f.name} kabul edildi ✓`) }, 'Kabul Et')
      : h('button', { class: 'btn-y', disabled: f.status !== 'accepted', onclick: () => { ui.closePanel(); startMatch({ cat: 'all', diff: 'all', count: 10, time: 15, label: 'arkadaş', bots: [{ name: f.name, avatar: f.avatar || 'a10', skill: 1 }, ...makeBots(2, 1, [f.avatar])] }, () => {}); } }, 'Maça Davet'),
    h('button', { class: 'back', 'aria-label': `${f.name} arkadaşlıktan çıkar`, onclick: () => act(() => removeFriend(f.id), 'Arkadaş silindi.') }, '✕')))
    : [h('p', { class: 'empty' }, 'Henüz arkadaşın yok. Bir kullanıcı adı yazıp istek gönder.')]));
  const add = (e) => {
    e.preventDefault();
    const v = inp.value.trim();
    if (!NAME_RE.test(v)) { err.className = 'ferr'; err.textContent = NAME_MSG; return; }
    if (v.toLocaleLowerCase('tr') === state.name.toLocaleLowerCase('tr')) { err.className = 'ferr'; err.textContent = 'Kendini arkadaş olarak ekleyemezsin.'; return; }
    if (fr.length >= 50) { err.className = 'ferr'; err.textContent = 'En fazla 50 arkadaş ekleyebilirsin.'; return; }
    inp.value = ''; act(() => sendFriendRequest(v), `${v} için istek gönderildi ✓`);
  };
  wrap.append(h('form', { onsubmit: add }, h('div', { class: 'frow' }, inp, h('button', { class: 'btn-p', type: 'submit' }, 'Ekle')), err), list,
    h('div', { class: 'note' }, isOnline() ? 'Arkadaşlık istekleri hesabına bağlı olarak saklanır.' : 'Çevrimdışı mod: arkadaşlar yalnızca bu cihazda saklanır; örnek oyuncu adlarını ekleyebilirsin (ör. Ayşe, Mert).'));
  refresh();
  return wrap;
}

/* ============================================================
   GÖREVLER
   ============================================================ */
export function renderQuests() {
  const wrap = h('div', { class: 'apanel' });
  let tab = 'daily';
  const rw = (r) => h('span', { class: 'reward' }, r.coins ? `🪙 ${fmt(r.coins)}` : null, r.gems ? ` 💎 ${r.gems}` : null, r.xp ? ` ⭐ ${r.xp} XP` : null);
  const claim = (q) => {
    const b = questBucket(q.reset);
    if ((b.p[q.metric] || 0) < q.goal || b.claimed.includes(q.id)) return;
    b.claimed.push(q.id); state.coins += q.reward.coins || 0; state.gems += q.reward.gems || 0; if (q.reward.xp) addXp(q.reward.xp);
    saveState(); ui.toast?.(`Görev ödülü alındı: ${q.title}`); draw();
  };
  const draw = () => {
    const b = questBucket(tab);
    const list = QUESTS.filter((q) => q.reset === tab);
    wrap.replaceChildren(
      tabsBar([['daily', '📅 Günlük'], ['weekly', '🗓️ Haftalık']], tab, (t) => { tab = t; draw(); }),
      h('div', { class: 'quests' }, list.map((q) => {
        const p = Math.min(q.goal, b.p[q.metric] || 0), done = p >= q.goal, got = b.claimed.includes(q.id);
        return h('div', { class: `quest${done ? ' done' : ''}` }, h('span', { class: 'qic', 'aria-hidden': 'true' }, q.icon),
          h('div', {}, h('b', {}, q.title), h('div', { class: 'qbar', role: 'progressbar', 'aria-valuenow': p, 'aria-valuemax': q.goal }, h('i', { style: `width:${(p / q.goal) * 100}%` })), h('small', {}, `${fmt(p)} / ${fmt(q.goal)} • `, rw(q.reward))),
          h('button', { class: 'btn-y', disabled: !done || got, onclick: () => claim(q) }, got ? 'Alındı' : 'Ödülü Al'));
      })),
      h('div', { class: 'note' }, tab === 'daily' ? 'Günlük görevler her gece yarısı yenilenir.' : 'Haftalık görevler her pazartesi yenilenir.'));
  };
  draw();
  return wrap;
}

/* ============================================================
   GÜNLÜK MEYDAN OKUMA, BAŞARIMLAR, ETKİNLİKLER
   ============================================================ */
export function renderDaily(ctx) {
  const today = new Date().toISOString().slice(0, 10), done = state.dailyDone === today;
  return h('div', { class: 'apanel' }, h('div', { class: 'box' }, h('h3', {}, '📅 Günlük Meydan Okuma'),
    h('p', {}, '10 karışık soru • 15 sn • Bugün ilk tamamlayışında bonus: 🪙 300 + 30 XP.'),
    done ? h('div', { class: 'msg ok' }, 'Bugünkü bonusu aldın ✓ (yine de oynayabilirsin, bonus yok).') : null,
    h('button', { class: 'btn-y go', onclick: () => { ctx.close(); startMatch({ cat: 'all', diff: 'all', count: 10, time: 15, bots: [], daily: true, label: 'günlük' }, () => {}); } }, done ? 'Tekrar Oyna' : 'Başla')));
}
export function renderAchievements() {
  const s = state.stats;
  const A = [['🥇', 'İlk Zafer', s.won, 1], ['🔟', '10 Galibiyet', s.won, 10], ['🧠', '100 Doğru Cevap', s.correct, 100], ['🎮', '50 Maç', s.played, 50],
    ['📡', 'Yayına Katıl', s.streamPlayed || 0, 1], ['⬆️', 'Seviye 20', state.level, 20], ['🛍️', '3 Ürün Sahibi', state.inv.length, 3]];
  return h('div', { class: 'quests' }, A.map(([ic, t, v, g]) => h('div', { class: `quest${v >= g ? ' done' : ''}` }, h('span', { class: 'qic' }, ic),
    h('div', {}, h('b', {}, t), h('div', { class: 'qbar' }, h('i', { style: `width:${Math.min(100, (v / g) * 100)}%` })), h('small', {}, `${fmt(Math.min(v, g))} / ${fmt(g)}`)), h('span', {}, v >= g ? '🏅' : '🔒'))));
}
export function renderEvents() {
  return h('div', { class: 'apanel' }, h('div', { class: 'box' }, eventActive() ? h('b', {}, '🎉 Çift XP etkinliği aktif! Tüm maçlarda XP iki katı.') : h('b', {}, 'Şu an aktif etkinlik yok.'),
    h('small', {}, 'Etkinlikler yönetici tarafından başlatılır ve bildirimlerde duyurulur.')));
}
