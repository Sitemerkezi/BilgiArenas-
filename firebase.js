/* ============================================================
   js/firebase.js — Auth + Firestore katmanı (ES modülü)

   • Firebase yapılandırılmamışsa veya çevrimdışıysa TÜM fonksiyonlar
     localStorage tabanlı "yerel yedek" ile aynı arayüzle çalışır.
   • Firebase SDK, index.html içindeki importmap'ten dinamik yüklenir
     ('firebase/app', 'firebase/auth', 'firebase/firestore'); yüklenemezse
     oyun bozulmaz, yerel moda düşer.
   • GÜVENLİK: rol/ban gibi yetkili alanlar istemciden değil Firestore
     kurallarıyla korunmalıdır (dosyanın sonundaki örnek kurallara bakın).
   ============================================================ */

/* ------------------------------------------------------------
   1) FIREBASE AYARLARI — BURAYI KENDİ PROJENİZLE DOLDURUN
   Firebase Console → Proje Ayarları → Genel → "Web uygulaması" → SDK yapılandırması.
   Aşağıdaki "BURAYA_..." değerlerini kopyaladıklarınızla değiştirin.
   (Web apiKey gizli bir anahtar değildir; asıl koruma Firestore kurallarıdır.)
   Ayrıca Authentication → Sign-in method bölümünden "Anonim" ve "E-posta/Şifre"
   yöntemlerini etkinleştirmeyi unutmayın.
   ------------------------------------------------------------ */
export const firebaseConfig = {
  apiKey: 'BURAYA_API_KEY',
  authDomain: 'BURAYA_PROJE_ID.firebaseapp.com',
  projectId: 'BURAYA_PROJE_ID',
  storageBucket: 'BURAYA_PROJE_ID.appspot.com',
  messagingSenderId: 'BURAYA_GONDEREN_ID',
  appId: 'BURAYA_APP_ID',
};
const configReady = () => !!firebaseConfig.apiKey && !/BURAYA_/.test(firebaseConfig.apiKey) && !/BURAYA_/.test(firebaseConfig.projectId);

/* ------------------------------------------------------------
   2) Yerel yedek yardımcıları (original oyundaki anahtarlarla uyumlu)
   ------------------------------------------------------------ */
const LS = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } };
const LSS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
const uid8 = () => Math.random().toString(36).slice(2, 10);
const now = () => Date.now();

export const ROLES = { user: 'Oyuncu', streamer: 'Yayıncı', admin: 'Yönetici' };
const SEED_USERS = [['Ayşe', 9120], ['Mert', 7800], ['Elif', 6400], ['Can', 5200], ['Deniz', 4100], ['Kerem', 3000], ['Selin', 2200], ['Burak', 900]];

/* ------------------------------------------------------------
   3) Türkçe hata çevirisi
   ------------------------------------------------------------ */
const ERR_TR = {
  'auth/invalid-email': 'E-posta adresi geçersiz.',
  'auth/user-disabled': 'Bu hesap devre dışı bırakılmış.',
  'auth/user-not-found': 'Bu e-posta ile kayıtlı hesap bulunamadı.',
  'auth/wrong-password': 'Şifre hatalı.',
  'auth/invalid-credential': 'E-posta veya şifre hatalı.',
  'auth/email-already-in-use': 'Bu e-posta zaten kullanımda.',
  'auth/weak-password': 'Şifre çok zayıf (en az 6 karakter olmalı).',
  'auth/too-many-requests': 'Çok fazla deneme yapıldı. Lütfen biraz bekleyip tekrar deneyin.',
  'auth/network-request-failed': 'Ağ bağlantısı kurulamadı. İnternetinizi kontrol edin.',
  'auth/operation-not-allowed': 'Bu giriş yöntemi Firebase Console’da etkinleştirilmemiş.',
  'permission-denied': 'Bu işlem için yetkiniz yok.',
  'unavailable': 'Sunucuya ulaşılamıyor; yerel yedek kullanılıyor.',
  'not-found': 'İstenen kayıt bulunamadı.',
  'already-exists': 'Bu kayıt zaten var.',
  'resource-exhausted': 'Kullanım sınırına ulaşıldı. Lütfen daha sonra tekrar deneyin.',
  'unauthenticated': 'Önce giriş yapmalısınız.',
  'failed-precondition': 'İşlem şu anda yapılamıyor (eksik dizin veya koşul).',
};
/** Her tür hatayı kullanıcıya gösterilebilir Türkçe metne çevirir. */
export function trError(e) {
  const code = String(e?.code || '').replace(/^firestore\//, '');
  if (ERR_TR[code]) return ERR_TR[code];
  if (e?.message === 'OFFLINE') return 'Çevrimdışısınız; yerel yedek kullanılıyor.';
  if (e?.userMessage) return e.userMessage;
  return 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.';
}
const userError = (msg) => Object.assign(new Error(msg), { userMessage: msg });

/* ------------------------------------------------------------
   4) Durum
   ------------------------------------------------------------ */
const F = { ok: false, app: null, auth: null, db: null, m: null, user: null, lastError: '', listeners: new Set(), syncT: 0 };

export const isOnline = () => F.ok;
export const currentUser = () => F.user; // { uid, email, anonymous } | null
export const lastError = () => F.lastError;
export function status() {
  if (F.ok) return 'Firebase bağlı (Auth + Firestore).';
  if (!configReady()) return 'Yerel yedek mod: firebaseConfig henüz doldurulmamış.';
  if (!navigator.onLine) return 'Yerel yedek mod: çevrimdışı.';
  return 'Yerel yedek mod: Firebase’e bağlanılamadı' + (F.lastError ? ` (${F.lastError})` : '.');
}
export const onStatusChange = (fn) => { F.listeners.add(fn); return () => F.listeners.delete(fn); };
const emit = () => F.listeners.forEach((fn) => { try { fn({ online: F.ok, user: F.user, status: status() }); } catch { /* dinleyici hatası */ } });

/** Firebase işlemini dener; hata/çevrimdışıysa yerel yedeği çalıştırır. Hatayı Türkçe saklar. */
async function run(remote, local) {
  if (F.ok && navigator.onLine) {
    try { const r = await remote(F.m, F.db); F.lastError = ''; return r; }
    catch (e) {
      F.lastError = trError(e);
      console.warn('[firebase] uzak işlem başarısız, yerel yedek:', e);
      if (e?.userMessage) throw e; // bilinçli kullanıcı hatası: yedeğe düşme
      if (e?.code === 'permission-denied' || e?.code === 'auth/requires-recent-login') throw userError(F.lastError);
    }
  }
  return local();
}

/* ------------------------------------------------------------
   5) Başlatma
   ------------------------------------------------------------ */
/** Oyun açılışında bir kez çağrın. Asla fırlatmaz; başarıyla bağlanırsa true döner. */
export async function initFirebase({ anonymous = true } = {}) {
  F.ok = false;
  if (!configReady()) { F.lastError = 'firebaseConfig doldurulmamış'; emit(); return false; }
  if (!navigator.onLine) { F.lastError = 'çevrimdışı'; emit(); return false; }
  try {
    const [appM, authM, fsM] = await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore')]);
    F.m = { ...appM, ...authM, ...fsM };
    F.app = F.m.initializeApp(firebaseConfig);
    F.auth = F.m.getAuth(F.app);
    F.db = F.m.getFirestore(F.app);
    F.ok = true;
    F.m.onAuthStateChanged(F.auth, (u) => { F.user = u ? { uid: u.uid, email: u.email || '', anonymous: u.isAnonymous } : null; emit(); });
    await new Promise((res) => { const un = F.m.onAuthStateChanged(F.auth, () => { un(); res(); }); });
    if (!F.auth.currentUser && anonymous) await F.m.signInAnonymously(F.auth);
    emit();
    return true;
  } catch (e) {
    F.ok = false; F.lastError = trError(e);
    console.warn('[firebase] başlatılamadı, yerel mod:', e);
    emit();
    return false;
  }
}

/* ============================================================
   6) KİMLİK DOĞRULAMA
   ============================================================ */
const needOnline = () => { throw userError('Bu özellik için Firebase bağlantısı gerekir (şu an yerel yedek moddasınız).'); };

export async function registerEmail(email, password, name) {
  if (!F.ok) needOnline();
  try {
    const { createUserWithEmailAndPassword, EmailAuthProvider, linkWithCredential, updateProfile } = F.m;
    const cur = F.auth.currentUser;
    let cred;
    if (cur?.isAnonymous) cred = await linkWithCredential(cur, EmailAuthProvider.credential(email, password)); // misafir ilerlemesi korunur
    else cred = await createUserWithEmailAndPassword(F.auth, email, password);
    if (name) await updateProfile(cred.user, { displayName: name });
    F.user = { uid: cred.user.uid, email: cred.user.email || '', anonymous: false }; emit();
    return F.user;
  } catch (e) { throw userError(trError(e)); }
}
export async function loginEmail(email, password) {
  if (!F.ok) needOnline();
  try { const c = await F.m.signInWithEmailAndPassword(F.auth, email, password); F.user = { uid: c.user.uid, email: c.user.email || '', anonymous: false }; emit(); return F.user; }
  catch (e) { throw userError(trError(e)); }
}
export async function loginAnonymous() {
  if (!F.ok) return null;
  try { const c = await F.m.signInAnonymously(F.auth); return { uid: c.user.uid, anonymous: true }; } catch (e) { throw userError(trError(e)); }
}
export async function logout() {
  if (!F.ok) return;
  try { await F.m.signOut(F.auth); } catch (e) { throw userError(trError(e)); }
}
export async function resetPassword(email) {
  if (!F.ok) needOnline();
  try { await F.m.sendPasswordResetEmail(F.auth, email); } catch (e) { throw userError(trError(e)); }
}

/* ============================================================
   7) PROFİL / ROL / ENVANTER
   users/{uid}: { name, avatar, role, level, xp, coins, gems, title, score, banned, hidden,
                  inventory: [itemId], equipped: { frame, nameColor, badge, effect }, updatedAt }
   ============================================================ */
const uref = (uid) => F.m.doc(F.db, 'users', uid);
const myUid = () => F.user?.uid || null;

function localUsers() {
  let u = LS('ba_users', null);
  if (!u) { u = SEED_USERS.map(([name, xp], i) => ({ id: 'seed' + i, name, xp, score: xp, coins: 1000 + i * 250, role: 'user', banned: false, hidden: false, av: 'a' + String(i + 1).padStart(2, '0') })); LSS('ba_users', u); }
  return u;
}
const localMe = () => LS('ba_me', { inventory: [], equipped: {}, friends: [], requests: [], role: 'user' });

/** Oyuncu durumunu buluta yazar (1.5 sn birleştirme). Yerelde zaten saklanıyor; hata sessizdir. */
export function syncProfile(state) {
  const me = localMe(); LSS('ba_me', { ...me, role: state.role || me.role });
  if (!F.ok || !myUid()) return;
  clearTimeout(F.syncT);
  F.syncT = setTimeout(() => {
    const { setDoc, serverTimestamp } = F.m;
    // role/banned alanlarını İSTEMCİ yazmaz (kurallar engeller); yalnızca oyun verisi gönderilir.
    setDoc(uref(myUid()), { name: state.name, avatar: state.avatar, level: state.level, xp: state.xp, coins: state.coins, gems: state.gems,
      score: state.level * 100 + state.xp, updatedAt: serverTimestamp() }, { merge: true }).catch((e) => { F.lastError = trError(e); });
  }, 1500);
}

/** Bulut profilini okur; yoksa/çevrimdışıysa null. Rol burada sunucudan gelir. */
export async function loadProfile() {
  return run(async ({ getDoc }) => { const s = await getDoc(uref(myUid())); return s.exists() ? { id: s.id, ...s.data() } : null; }, () => ({ ...localMe(), id: 'local' }));
}
/** Güvenilir rol: sunucudaki users/{uid}.role; yerelde state/ba_me. */
export async function getRole() {
  const p = await loadProfile().catch(() => null);
  return p?.role && ROLES[p.role] ? p.role : 'user';
}

/* ---- Envanter ---- */
export async function getInventory() {
  return run(async () => { const p = await loadProfile(); return { items: p?.inventory || [], equipped: p?.equipped || {} }; },
    () => { const m = localMe(); return { items: m.inventory || [], equipped: m.equipped || {} }; });
}
export async function addToInventory(itemId) {
  return run(async ({ updateDoc, arrayUnion }) => { await updateDoc(uref(myUid()), { inventory: arrayUnion(itemId) }); return true; },
    () => { const m = localMe(); if (!m.inventory.includes(itemId)) m.inventory.push(itemId); LSS('ba_me', m); return true; });
}
/** slot: 'frame' | 'nameColor' | 'badge' | 'effect' (null = çıkar) */
export async function equipItem(slot, itemId) {
  if (!['frame', 'nameColor', 'badge', 'effect'].includes(slot)) throw userError('Geçersiz kozmetik türü.');
  return run(async ({ updateDoc }) => { await updateDoc(uref(myUid()), { [`equipped.${slot}`]: itemId || null }); return true; },
    () => { const m = localMe(); m.equipped = { ...m.equipped, [slot]: itemId || null }; LSS('ba_me', m); return true; });
}

/* ============================================================
   8) ARKADAŞLAR
   friends/{uid}/list/{friendUid}: { name, avatar, status: 'pending-out' | 'pending-in' | 'accepted', at }
   ============================================================ */
export async function listFriends() {
  return run(async ({ collection, getDocs }) => { const s = await getDocs(collection(F.db, 'friends', myUid(), 'list')); return s.docs.map((d) => ({ id: d.id, ...d.data() })); },
    () => localMe().friends || []);
}
/** Kullanıcı adına göre arkadaş isteği gönderir. */
export async function sendFriendRequest(name) {
  const nm = String(name || '').trim();
  if (nm.length < 2) throw userError('Geçerli bir kullanıcı adı girin.');
  return run(async ({ collection, query, where, getDocs, setDoc, doc, limit }) => {
    const q = await getDocs(query(collection(F.db, 'users'), where('name', '==', nm), limit(1)));
    if (q.empty) throw userError('Bu isimde bir oyuncu bulunamadı.');
    const t = q.docs[0]; if (t.id === myUid()) throw userError('Kendinize istek gönderemezsiniz.');
    await setDoc(doc(F.db, 'friends', myUid(), 'list', t.id), { name: t.data().name, avatar: t.data().avatar || 'a10', status: 'pending-out', at: now() });
    await setDoc(doc(F.db, 'friends', t.id, 'list', myUid()), { name: F.auth.currentUser?.displayName || 'Oyuncu', avatar: 'a10', status: 'pending-in', at: now() });
    return true;
  }, () => {
    const m = localMe(); if ((m.friends || []).some((f) => f.name === nm)) throw userError('Bu oyuncu zaten listenizde.');
    const u = localUsers().find((x) => x.name.toLowerCase() === nm.toLowerCase());
    if (!u) throw userError('Bu isimde bir oyuncu bulunamadı.');
    m.friends = [...(m.friends || []), { id: u.id || uid8(), name: u.name, avatar: u.av || 'a10', status: 'accepted', at: now() }]; LSS('ba_me', m); return true;
  });
}
export async function acceptFriend(friendId) {
  return run(async ({ updateDoc, doc }) => {
    await updateDoc(doc(F.db, 'friends', myUid(), 'list', friendId), { status: 'accepted' });
    await updateDoc(doc(F.db, 'friends', friendId, 'list', myUid()), { status: 'accepted' }); return true;
  }, () => { const m = localMe(); m.friends = (m.friends || []).map((f) => (f.id === friendId ? { ...f, status: 'accepted' } : f)); LSS('ba_me', m); return true; });
}
export async function removeFriend(friendId) {
  return run(async ({ deleteDoc, doc }) => { await deleteDoc(doc(F.db, 'friends', myUid(), 'list', friendId)); await deleteDoc(doc(F.db, 'friends', friendId, 'list', myUid())).catch(() => {}); return true; },
    () => { const m = localMe(); m.friends = (m.friends || []).filter((f) => f.id !== friendId); LSS('ba_me', m); return true; });
}

/* ============================================================
   9) LİDERLİK TABLOSU
   ============================================================ */
/** period: 'all' (users.score alanı). Banlı/gizli oyuncular listelenmez. */
export async function getLeaderboard(top = 50) {
  return run(async ({ collection, query, orderBy, limit, getDocs }) => {
    const s = await getDocs(query(collection(F.db, 'users'), orderBy('score', 'desc'), limit(top + 20)));
    return s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((u) => !u.banned && !u.hidden).slice(0, top)
      .map((u) => ({ id: u.id, name: u.name || 'Oyuncu', av: u.avatar || 'a10', xp: u.score || 0, role: u.role || 'user', me: u.id === myUid() }));
  }, () => localUsers().filter((u) => !u.banned && !u.hidden).sort((a, b) => (b.score ?? b.xp) - (a.score ?? a.xp)).slice(0, top)
    .map((u) => ({ id: u.id, name: u.name, av: u.av || 'a10', xp: u.score ?? u.xp, role: u.role || 'user', me: false })));
}

/* ============================================================
   10) YAYINCI İŞLEMLERİ
   rooms/{roomId}: { owner, ownerName, name, cat, diff, count, time, max, status, createdAt }
   ============================================================ */
const localRooms = () => LS('ba_rooms', []);
export async function requestStreamerRole(note = '') {
  return run(async ({ setDoc, doc }) => { await setDoc(doc(F.db, 'streamerRequests', myUid()), { note: String(note).slice(0, 300), at: now(), status: 'pending' }); return true; },
    () => { const r = LS('ba_sreq', []); r.push({ id: uid8(), note, at: now(), status: 'pending' }); LSS('ba_sreq', r); return true; });
}
export async function createStreamRoom(cfg) {
  const room = { name: String(cfg.name || 'Yayın Odası').slice(0, 40), cat: cfg.cat || 'all', diff: cfg.diff || 'all', count: cfg.count || 15, time: cfg.time || 15,
    max: cfg.max || 1000, n: 1, status: 'Bekliyor', stream: 1, hard: cfg.hard || 1, createdAt: now(),
    code: cfg.code || '', oav: cfg.oav || 'a10', ownerName: String(cfg.ownerName || '').slice(0, 24) };
  return run(async ({ addDoc, collection }) => {
    const r = await addDoc(collection(F.db, 'rooms'), { ...room, owner: myUid(), ownerName: room.ownerName || F.auth.currentUser?.displayName || 'Yayıncı' }); return { id: r.id, ...room };
  }, () => { const r = { id: uid8(), ...room, owner: room.ownerName || 'Yayıncı' }; const all = localRooms(); all.push(r); LSS('ba_rooms', all); return r; });
}
export async function listStreamRooms() {
  return run(async ({ collection, query, orderBy, limit, getDocs }) => { const s = await getDocs(query(collection(F.db, 'rooms'), orderBy('createdAt', 'desc'), limit(40))); return s.docs.map((d) => ({ id: d.id, ...d.data() })); }, localRooms);
}
export async function closeStreamRoom(id) {
  return run(async ({ deleteDoc, doc }) => { await deleteDoc(doc(F.db, 'rooms', id)); return true; }, () => { LSS('ba_rooms', localRooms().filter((r) => r.id !== id)); return true; });
}

/* ============================================================
   11) YÖNETİCİ İŞLEMLERİ (kurallar rolü sunucuda doğrular)
   ============================================================ */
export async function adminListUsers() {
  return run(async ({ collection, query, orderBy, limit, getDocs }) => { const s = await getDocs(query(collection(F.db, 'users'), orderBy('score', 'desc'), limit(200))); return s.docs.map((d) => ({ id: d.id, ...d.data() })); }, localUsers);
}
async function patchUser(id, patch) {
  return run(async ({ updateDoc }) => { await updateDoc(uref(id), patch); return true; },
    () => { const u = localUsers(); const t = u.find((x) => (x.id || x.name) === id); if (t) Object.assign(t, patch); LSS('ba_users', u); return true; });
}
export const adminSetRole = (id, role) => (ROLES[role] ? patchUser(id, { role }) : Promise.reject(userError('Geçersiz rol.')));
export const adminBan = (id, banned = true) => patchUser(id, { banned: !!banned });
export const adminHide = (id, hidden = true) => patchUser(id, { hidden: !!hidden });

/* ---- Özel sorular (QUESTIONS'a js/data.js mergeCustomQuestions ile eklenir) ---- */
export async function listCustomQuestions() {
  return run(async ({ collection, getDocs }) => (await getDocs(collection(F.db, 'questions'))).docs.map((d) => ({ id: d.id, ...d.data() })), () => LS('ba_cq', []));
}
export async function adminAddQuestion(x) {
  if (!x?.q || !Array.isArray(x.opts) || x.opts.length < 4) throw userError('Soru metni ve en az 4 şık gerekli.');
  const q = { cat: x.cat, d: x.d || 'o', q: String(x.q).trim(), opts: x.opts.map(String), a: x.a ?? 0, createdAt: now() };
  return run(async ({ addDoc, collection }) => { await addDoc(collection(F.db, 'questions'), q); return q; }, () => { const l = LS('ba_cq', []); l.push(q); LSS('ba_cq', l); return q; });
}
export async function adminDeleteQuestion(text) {
  return run(async ({ addDoc, collection }) => { await addDoc(collection(F.db, 'deletedQuestions'), { q: text, at: now() }); return true; },
    () => { const l = LS('ba_delq', []); if (!l.includes(text)) l.push(text); LSS('ba_delq', l); return true; });
}
export async function listDeletedQuestions() {
  return run(async ({ collection, getDocs }) => (await getDocs(collection(F.db, 'deletedQuestions'))).docs.map((d) => d.data().q), () => LS('ba_delq', []));
}

/* ---- Bakiye / puan düzenleme (yalnızca yönetici; kurallar doğrular) ---- */
export function adminUpdateUser(id, patch) {
  const ok = {}; ['coins', 'gems', 'score', 'level', 'xp'].forEach((k) => { if (patch[k] != null) ok[k] = Math.max(0, Math.round(Number(patch[k]) || 0)); });
  if (patch.score != null) ok.xp = ok.score; // yerel liderlik satırları xp alanını da okur
  return patchUser(id, ok);
}

/* ---- Etkinlik (çift XP) bayrağı: config/event ---- */
export async function getEventFlag() {
  return run(async ({ doc, getDoc }) => { const s = await getDoc(doc(F.db, 'config', 'event')); return !!(s.exists() && s.data().doubleXp); }, () => !!LS('ba_evt', 0));
}
export async function adminSetEvent(on) {
  LSS('ba_evt', on ? 1 : 0);
  return run(async ({ doc, setDoc }) => { await setDoc(doc(F.db, 'config', 'event'), { doubleXp: !!on, at: now() }); return true; }, () => true);
}

/* ---- Yayıncı başvuruları ---- */
export async function listStreamerRequests() {
  return run(async ({ collection, getDocs }) => (await getDocs(collection(F.db, 'streamerRequests'))).docs.map((d) => ({ id: d.id, ...d.data() })).filter((r) => r.status === 'pending'),
    () => LS('ba_sreq', []).filter((r) => r.status === 'pending'));
}
export async function resolveStreamerRequest(id, approve) {
  return run(async ({ doc, updateDoc }) => {
    await updateDoc(doc(F.db, 'streamerRequests', id), { status: approve ? 'approved' : 'rejected' });
    if (approve) await updateDoc(uref(id), { role: 'streamer' });
    return true;
  }, () => { const l = LS('ba_sreq', []); const r = l.find((x) => x.id === id); if (r) r.status = approve ? 'approved' : 'rejected'; LSS('ba_sreq', l); return true; });
}

/* ---- Duyurular ---- */
export async function adminPostAnnouncement(title, body) {
  const a = { title: String(title).slice(0, 80), body: String(body).slice(0, 400), at: now() };
  return run(async ({ addDoc, collection }) => { await addDoc(collection(F.db, 'announcements'), a); return a; }, () => { const l = LS('ba_ann', []); l.unshift(a); LSS('ba_ann', l); return a; });
}
export async function listAnnouncements() {
  return run(async ({ collection, query, orderBy, limit, getDocs }) => (await getDocs(query(collection(F.db, 'announcements'), orderBy('at', 'desc'), limit(20)))).docs.map((d) => d.data()), () => LS('ba_ann', []));
}

/* ============================================================
   ÖRNEK FIRESTORE KURALLARI (Console → Firestore → Kurallar'a yapıştırın)
   İlk yöneticiyi Console'dan elle atayın: users/{uid}.role = "admin"

   rules_version = '2';
   service cloud.firestore {
     match /databases/{db}/documents {
       function signed() { return request.auth != null; }
       function role() { return get(/databases/$(db)/documents/users/$(request.auth.uid)).data.role; }
       function isAdmin() { return signed() && role() == 'admin'; }
       function isStreamer() { return signed() && (role() == 'streamer' || role() == 'admin'); }

       match /users/{id} {
         allow read: if signed();
         allow create: if signed() && request.auth.uid == id && !('role' in request.resource.data) && !('banned' in request.resource.data);
         allow update: if (signed() && request.auth.uid == id
                          && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['role','banned','hidden']))
                        || isAdmin();
       }
       match /friends/{uid}/list/{fid} { allow read, write: if signed() && (request.auth.uid == uid || request.auth.uid == fid); }
       match /rooms/{id} { allow read: if signed(); allow create: if isStreamer(); allow update, delete: if isStreamer() && (resource.data.owner == request.auth.uid || isAdmin()); }
       match /streamerRequests/{id} { allow create: if signed() && request.auth.uid == id; allow read, update, delete: if isAdmin(); }
       match /questions/{id} { allow read: if signed(); allow write: if isAdmin(); }
       match /deletedQuestions/{id} { allow read: if signed(); allow write: if isAdmin(); }
       match /config/{id} { allow read: if signed(); allow write: if isAdmin(); }
       match /announcements/{id} { allow read: if signed(); allow write: if isAdmin(); }
     }
   }
   ============================================================ */
