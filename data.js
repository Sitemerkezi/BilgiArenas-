/* ============================================================
   js/data.js — Bilgi Arenası veri katmanı (ES modülü)
   Avatarlar, kozmetikler, kategoriler, zorluklar, mağaza, görevler,
   soru bankası ve yayın odası (6 şık) yardımcıları.
   ============================================================ */

import { AVATAR_DATA } from './avatars.js';

/* ---------- küçük yardımcılar ---------- */
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/* ---------- Avatarlar ---------- */
export const AVATARS = [
  { id: 'a01', name: 'Elf Bilge' }, { id: 'a02', name: 'Siber Gazi' }, { id: 'a03', name: 'Orman Okçusu' },
  { id: 'a04', name: 'Genç Kaşif' }, { id: 'a05', name: 'Rün Savaşçısı' }, { id: 'a06', name: 'Saat Baronu' },
  { id: 'a07', name: 'Pamuk Kedi' }, { id: 'a08', name: 'Çark Robot' }, { id: 'a09', name: 'Foto Muhabir' },
  { id: 'a10', name: 'Maceracı' }, { id: 'a11', name: 'Gölge Avcı' }, { id: 'a12', name: 'Büyücü Çırak' },
  { id: 'a13', name: 'Aslan Kral' }, { id: 'a14', name: 'Bonsai Ustası' }, { id: 'a15', name: 'Sokak Sanatçısı' },
];
export const avatarSrc = (id) => AVATAR_DATA[id] || AVATAR_DATA.a10;
export function avatarEl(id, cls = 'av') {
  const i = document.createElement('img');
  i.src = avatarSrc(AVATARS.some((a) => a.id === id) ? id : 'a10');
  i.alt = ''; i.className = cls; i.decoding = 'async';
  return i;
}

/* ---------- Yayıncı kozmetikleri (yalnızca streamer/admin rolü kullanır) ----------
   type: frame (avatar çerçevesi) | nameColor (isim rengi) | badge (rozet) | effect (oda efekti)
   cls : css/style.css içindeki karşılık gelen sınıf */
export const STREAMER_COSMETICS = [
  { id: 'sf_gold',    type: 'frame',     name: 'Altın Çerçeve',     icon: '🖼️', cls: 'cos-frame-gold' },
  { id: 'sf_neon',    type: 'frame',     name: 'Neon Çerçeve',      icon: '💠', cls: 'cos-frame-neon' },
  { id: 'sf_fire',    type: 'frame',     name: 'Alev Çerçeve',      icon: '🔥', cls: 'cos-frame-fire' },
  { id: 'sn_rainbow', type: 'nameColor', name: 'Gökkuşağı İsim',    icon: '🌈', cls: 'cos-name-rainbow' },
  { id: 'sn_gold',    type: 'nameColor', name: 'Altın İsim',        icon: '✨', cls: 'cos-name-gold' },
  { id: 'sn_ice',     type: 'nameColor', name: 'Buz Mavisi İsim',   icon: '❄️', cls: 'cos-name-ice' },
  { id: 'sb_live',    type: 'badge',     name: 'CANLI Rozeti',      icon: '🔴', cls: 'cos-badge-live' },
  { id: 'sb_star',    type: 'badge',     name: 'Yıldız Yayıncı',    icon: '⭐', cls: 'cos-badge-star' },
  { id: 'sb_crown',   type: 'badge',     name: 'Taç Rozeti',        icon: '👑', cls: 'cos-badge-crown' },
  { id: 'se_confetti', type: 'effect',   name: 'Konfeti Yağmuru',   icon: '🎊', cls: 'cos-fx-confetti' },
  { id: 'se_spot',    type: 'effect',    name: 'Spot Işığı',        icon: '🔦', cls: 'cos-fx-spot' },
];
export const cosmeticById = (id) => STREAMER_COSMETICS.find((c) => c.id === id) || null;

/* ---------- Kategoriler ---------- */
export const CATS = ['Tarih', 'Coğrafya', 'Bilim', 'Spor', 'Müzik', 'Film ve Diziler', 'Teknoloji', 'Video Oyunları',
  'Edebiyat', 'Sanat', 'İnternet Kültürü', 'Mantık ve Zeka', 'Genel Kültür',
  'Hayvanlar ve Doğa', 'Yemek ve Mutfak', 'Mitoloji'];
export const STREAM_CATS = ['Yayıncı Özel', 'Bilim İnsanları', 'Sanatçılar'];
export const CAT_ICON = {
  'Tarih': '🏛️', 'Coğrafya': '🌍', 'Bilim': '🔬', 'Spor': '⚽', 'Müzik': '🎵', 'Film ve Diziler': '🎬',
  'Teknoloji': '💻', 'Video Oyunları': '🎮', 'Edebiyat': '📚', 'Sanat': '🎨', 'İnternet Kültürü': '🌐',
  'Mantık ve Zeka': '🧩', 'Genel Kültür': '💡', 'Hayvanlar ve Doğa': '🦁', 'Yemek ve Mutfak': '🍲', 'Mitoloji': '⚡',
  'Yayıncı Özel': '📡', 'Bilim İnsanları': '🧑‍🔬', 'Sanatçılar': '🎭',
};

/* ---------- Zorluklar (acc: botların temel isabet oranı) ---------- */
export const DIFFS = [
  { id: 'k', label: 'Kolay', pts: 10, acc: 0.85 }, { id: 'o', label: 'Orta', pts: 10, acc: 0.7 },
  { id: 'z', label: 'Zor', pts: 10, acc: 0.55 }, { id: 'u', label: 'Uzman', pts: 10, acc: 0.4 },
  { id: 'e', label: 'Efsane', pts: 10, acc: 0.28 },
];
export const DIFF = Object.fromEntries(DIFFS.map((d) => [d.id, d]));

/* ---------- Mağaza ürünleri ----------
   kind: avatar | boost | chest | title ; cur: coins | gems ; stock yok (sınırsız) */
export const SHOP_ITEMS = [
  { id: 'xp_boost_1', kind: 'boost', icon: '⚡', name: '2x XP (3 maç)',   desc: 'Sonraki 3 maçta XP ikiye katlanır.', price: 600,  cur: 'coins', data: { xpMul: 2, matches: 3 } },
  { id: 'coin_boost_1', kind: 'boost', icon: '🪙', name: '2x Altın (3 maç)', desc: 'Sonraki 3 maçta altın ödülü ikiye katlanır.', price: 40, cur: 'gems', data: { coinMul: 2, matches: 3 } },
  { id: 'hint_pack', kind: 'boost', icon: '🔎', name: 'İpucu Paketi (5)', desc: 'Yanlış şıkları eleyen 5 ipucu hakkı.', price: 900, cur: 'coins', data: { hints: 5 } },
  { id: 'chest_bronze', kind: 'chest', icon: '🧰', name: 'Bronz Sandık',   desc: '200–600 altın arası ödül.', price: 500,  cur: 'coins', data: { min: 200, max: 600 } },
  { id: 'chest_gold', kind: 'chest', icon: '🎁', name: 'Altın Sandık',     desc: '1.000–3.000 altın ve şansa elmas.', price: 60, cur: 'gems', data: { min: 1000, max: 3000, gemChance: 0.35 } },
  { id: 'title_scholar', kind: 'title', icon: '🎓', name: 'Unvan: Bilge',  desc: 'Profilinde “Bilge” unvanı görünür.', price: 2500, cur: 'coins', data: { title: 'Bilge' } },
  { id: 'title_legend', kind: 'title', icon: '🏆', name: 'Unvan: Efsane', desc: 'Profilinde “Efsane” unvanı görünür.', price: 120, cur: 'gems', data: { title: 'Efsane' } },
  ...AVATARS.slice(10).map((a, i) => ({ id: 'av_' + a.id, kind: 'avatar', icon: '🧑‍🎤', name: `Avatar: ${a.name}`, desc: 'Özel avatar kilidini açar.', price: 1500 + i * 500, cur: 'coins', data: { avatar: a.id } })),
];
export const shopItemById = (id) => SHOP_ITEMS.find((s) => s.id === id) || null;

/* ---------- Görevler ----------
   metric: stats alanı (played, won, correct, answered) | 'streamPlayed' ; reset: daily | weekly */
export const QUESTS = [
  { id: 'd_play3',   reset: 'daily',  icon: '🎮', title: '3 maç oyna',            metric: 'played',  goal: 3,   reward: { coins: 300, xp: 40 } },
  { id: 'd_correct10', reset: 'daily', icon: '✅', title: '10 doğru cevap ver',    metric: 'correct', goal: 10,  reward: { coins: 250, xp: 30 } },
  { id: 'd_win1',    reset: 'daily',  icon: '🥇', title: '1 maç kazan',            metric: 'won',     goal: 1,   reward: { coins: 400, gems: 5, xp: 50 } },
  { id: 'w_play15',  reset: 'weekly', icon: '🔥', title: 'Hafta boyunca 15 maç oyna', metric: 'played', goal: 15, reward: { coins: 1500, gems: 20, xp: 200 } },
  { id: 'w_correct100', reset: 'weekly', icon: '🧠', title: '100 doğru cevap ver', metric: 'correct', goal: 100, reward: { coins: 2000, gems: 25, xp: 250 } },
  { id: 'w_win7',    reset: 'weekly', icon: '👑', title: '7 maç kazan',            metric: 'won',     goal: 7,   reward: { coins: 2500, gems: 40, xp: 300 } },
  { id: 'w_stream1', reset: 'weekly', icon: '📡', title: 'Bir yayın odasına katıl', metric: 'streamPlayed', goal: 1, reward: { coins: 800, gems: 10, xp: 100 } },
];

/* ---------- Soru bankası ----------
   [kategori, zorluk, soru, [seçenekler], doğru indeks] */
const BASE_RAW = [
  ['Tarih', 'k', 'Türkiye Cumhuriyeti hangi yıl ilan edildi?', ['1920', '1923', '1919', '1938'], 1],
  ['Tarih', 'k', "İstanbul'u 1453'te fetheden Osmanlı padişahı kimdir?", ['Yavuz Sultan Selim', 'Kanuni Sultan Süleyman', 'Fatih Sultan Mehmet', 'II. Abdülhamid'], 2],
  ['Tarih', 'o', 'Fransız Devrimi hangi yıl başladı?', ['1789', '1776', '1815', '1848'], 0],
  ['Tarih', 'z', 'Malazgirt Savaşı hangi yıl yapıldı?', ['1071', '1176', '1243', '1299'], 0],
  ['Tarih', 'u', 'Vestfalya Barışı (1648) hangi savaşı sona erdirdi?', ['Yüz Yıl Savaşları', 'Otuz Yıl Savaşları', 'Yedi Yıl Savaşları', 'Napolyon Savaşları'], 1],

  ['Coğrafya', 'k', "Türkiye'nin başkenti neresidir?", ['İstanbul', 'İzmir', 'Ankara', 'Bursa'], 2],
  ['Coğrafya', 'k', 'Dünyanın en büyük okyanusu hangisidir?', ['Atlas', 'Hint', 'Pasifik', 'Arktik'], 2],
  ['Coğrafya', 'o', "Avustralya'nın başkenti neresidir?", ['Sidney', 'Melbourne', 'Canberra', 'Perth'], 2],
  ['Coğrafya', 'z', 'Victoria Şelalesi hangi iki ülkenin sınırındadır?', ['Kenya - Tanzanya', 'Zambiya - Zimbabve', 'Angola - Namibya', 'Uganda - Ruanda'], 1],
  ['Coğrafya', 'u', 'Dünyanın en derin gölü hangisidir?', ['Tanganika', 'Baykal', 'Superior', 'Van'], 1],

  ['Bilim', 'k', 'Suyun kimyasal formülü nedir?', ['CO2', 'H2O', 'O2', 'NaCl'], 1],
  ['Bilim', 'k', 'Güneş Sistemi\'ndeki en büyük gezegen hangisidir?', ['Satürn', 'Neptün', 'Jüpiter', 'Dünya'], 2],
  ['Bilim', 'o', 'İnsan vücudundaki en büyük organ hangisidir?', ['Karaciğer', 'Deri', 'Akciğer', 'Kalın bağırsak'], 1],
  ['Bilim', 'z', "DNA'nın çift sarmal yapısını 1953'te öneren bilim insanları kimlerdir?", ['Mendel ve Darwin', 'Watson ve Crick', 'Pasteur ve Koch', 'Curie ve Bohr'], 1],
  ['Bilim', 'u', 'Periyodik tabloda atom numarası 79 olan element hangisidir?', ['Gümüş', 'Platin', 'Altın', 'Cıva'], 2],

  ['Spor', 'k', 'Futbolda bir takım sahada kaç oyuncuyla yer alır?', ['9', '10', '11', '12'], 2],
  ['Spor', 'k', 'Olimpiyat bayrağında kaç halka vardır?', ['4', '5', '6', '7'], 1],
  ['Spor', 'o', '2022 FIFA Dünya Kupası\'nı hangi ülke kazandı?', ['Fransa', 'Brezilya', 'Arjantin', 'Hırvatistan'], 2],
  ['Spor', 'z', 'Maratonun resmi mesafesi yaklaşık kaç kilometredir?', ['21,097', '42,195', '35,000', '50,000'], 1],
  ['Spor', 'u', 'NBA\'de 6 şampiyonluk ve 6 Finaller MVP\'si ile anılan oyuncu kimdir?', ['Michael Jordan', 'LeBron James', 'Kobe Bryant', 'Magic Johnson'], 0],

  ['Müzik', 'k', 'Standart bir piyanoda kaç tuş vardır?', ['66', '76', '88', '98'], 2],
  ['Müzik', 'k', 'Do-re-mi-fa-sol dizisinde "sol"dan sonra hangi nota gelir?', ['Fa', 'La', 'Si', 'Re'], 1],
  ['Müzik', 'o', 'Beethoven\'ın 9. Senfonisi\'nin finalinde hangi ezgi yer alır?', ['Ay Işığı Sonatı', 'Neşeye Övgü', 'Dört Mevsim', 'Türk Marşı'], 1],
  ['Müzik', 'z', '"Dört Mevsim" adlı keman konçertoları kime aittir?', ['Bach', 'Vivaldi', 'Mozart', 'Haydn'], 1],
  ['Müzik', 'u', 'Queen\'in "Bohemian Rhapsody" şarkısı hangi albümde yer alır?', ['A Night at the Opera', 'News of the World', 'Sheer Heart Attack', 'Jazz'], 0],

  ['Film ve Diziler', 'k', '"Simba" karakteri hangi animasyon filminde yer alır?', ['Aslan Kral', 'Madagaskar', 'Tarzan', 'Kung Fu Panda'], 0],
  ['Film ve Diziler', 'o', '"Titanic" filmi hangi yıl vizyona girdi?', ['1995', '1997', '1999', '2001'], 1],
  ['Film ve Diziler', 'o', 'Walter White karakteri hangi dizide yer alır?', ['Breaking Bad', 'Dark', 'Lost', 'Narcos'], 0],
  ['Film ve Diziler', 'z', 'Oscar\'da En İyi Film ödülünü kazanan ilk Güney Kore yapımı hangisidir?', ['Oldboy', 'Parazit', 'Train to Busan', 'Minari'], 1],
  ['Film ve Diziler', 'u', '"Vertigo" filminin yönetmeni kimdir?', ['Stanley Kubrick', 'Alfred Hitchcock', 'Orson Welles', 'Akira Kurosawa'], 1],

  ['Teknoloji', 'k', '"WWW" kısaltması neyin açılımıdır?', ['World Wide Web', 'Wide World Network', 'Web World Wire', 'Wireless World Web'], 0],
  ['Teknoloji', 'o', '1 bayt kaç bitten oluşur?', ['4', '8', '16', '32'], 1],
  ['Teknoloji', 'o', '"İlk giren ilk çıkar" (FIFO) kuralıyla çalışan veri yapısı hangisidir?', ['Yığın', 'Kuyruk', 'Ağaç', 'Çizge'], 1],
  ['Teknoloji', 'z', 'Linux çekirdeğini ilk geliştiren kişi kimdir?', ['Richard Stallman', 'Linus Torvalds', 'Dennis Ritchie', 'Ken Thompson'], 1],
  ['Teknoloji', 'u', 'RSA şifrelemesinin güvenliği hangi probleme dayanır?', ['Büyük sayıları asal çarpanlarına ayırma', 'Hash çakışması bulma', 'Fourier dönüşümü', 'Matris tersi alma'], 0],

  ['Video Oyunları', 'k', 'Super Mario\'nun kardeşinin adı nedir?', ['Wario', 'Luigi', 'Toad', 'Yoshi'], 1],
  ['Video Oyunları', 'k', 'Minecraft\'ta oyuncuya yaklaşıp patlayan yeşil yaratık hangisidir?', ['Zombi', 'Creeper', 'Enderman', 'İskelet'], 1],
  ['Video Oyunları', 'o', 'The Legend of Zelda serisinin ana kahramanı kimdir?', ['Zelda', 'Link', 'Ganon', 'Epona'], 1],
  ['Video Oyunları', 'z', 'Pac-Man hangi yıl çıkış yaptı?', ['1978', '1980', '1983', '1985'], 1],
  ['Video Oyunları', 'u', 'Half-Life serisinin kahramanı Gordon Freeman\'ın mesleği nedir?', ['Mühendis', 'Teorik fizikçi', 'Asker', 'Doktor'], 1],

  ['Edebiyat', 'k', '"Çalıkuşu" romanının yazarı kimdir?', ['Halide Edib Adıvar', 'Reşat Nuri Güntekin', 'Yakup Kadri', 'Peyami Safa'], 1],
  ['Edebiyat', 'k', '"Don Kişot" romanının yazarı kimdir?', ['Cervantes', 'Dante', 'Shakespeare', 'Goethe'], 0],
  ['Edebiyat', 'o', '"Suç ve Ceza" romanının yazarı kimdir?', ['Tolstoy', 'Dostoyevski', 'Çehov', 'Gogol'], 1],
  ['Edebiyat', 'z', 'Nobel Edebiyat Ödülü\'nü kazanan ilk Türk yazar kimdir?', ['Yaşar Kemal', 'Orhan Pamuk', 'Nazım Hikmet', 'Elif Şafak'], 1],
  ['Edebiyat', 'u', '"Ulysses" romanının yazarı kimdir?', ['Virginia Woolf', 'James Joyce', 'Samuel Beckett', 'Marcel Proust'], 1],

  ['Sanat', 'k', '"Mona Lisa" tablosunun ressamı kimdir?', ['Michelangelo', 'Leonardo da Vinci', 'Raphael', 'Botticelli'], 1],
  ['Sanat', 'o', '"Yıldızlı Gece" tablosunun ressamı kimdir?', ['Monet', 'Van Gogh', 'Cézanne', 'Gauguin'], 1],
  ['Sanat', 'o', 'Picasso hangi sanat akımının kurucularından biridir?', ['Empresyonizm', 'Kübizm', 'Sürrealizm', 'Barok'], 1],
  ['Sanat', 'z', '"Çığlık" tablosunun ressamı kimdir?', ['Edvard Munch', 'Gustav Klimt', 'Egon Schiele', 'Paul Klee'], 0],
  ['Sanat', 'u', '"Las Meninas" tablosunun ressamı kimdir?', ['Goya', 'Velázquez', 'El Greco', 'Murillo'], 1],

  ['İnternet Kültürü', 'k', '"Emoji" sözcüğü hangi dilden gelir?', ['Çince', 'Japonca', 'Korece', 'İngilizce'], 1],
  ['İnternet Kültürü', 'k', 'Twitter 2023\'te hangi adı aldı?', ['X', 'Threads', 'Meta', 'Bluesky'], 0],
  ['İnternet Kültürü', 'o', 'YouTube hangi yıl kuruldu?', ['2003', '2005', '2007', '2009'], 1],
  ['İnternet Kültürü', 'z', 'YouTube\'daki ilk video "Me at the zoo" hangi hayvanların önünde çekilmiştir?', ['Filler', 'Zürafalar', 'Penguenler', 'Aslanlar'], 0],
  ['İnternet Kültürü', 'u', '"Meme" kavramını Bencil Gen kitabında ortaya atan bilim insanı kimdir?', ['Richard Dawkins', 'Stephen Hawking', 'Carl Sagan', 'Steven Pinker'], 0],

  ['Mantık ve Zeka', 'k', '2, 4, 6, 8 dizisinde sıradaki sayı kaçtır?', ['9', '10', '12', '14'], 1],
  ['Mantık ve Zeka', 'k', 'Bir düzinenin yarısı kaçtır?', ['4', '5', '6', '8'], 2],
  ['Mantık ve Zeka', 'o', '1, 1, 2, 3, 5, 8 dizisinde sıradaki sayı kaçtır?', ['11', '12', '13', '15'], 2],
  ['Mantık ve Zeka', 'z', '5 makine 5 dakikada 5 ürün üretiyor. 100 makine 100 ürünü kaç dakikada üretir?', ['5', '20', '50', '100'], 0],
  ['Mantık ve Zeka', 'u', 'Aşağıdakilerden hangisi asal sayıdır?', ['51', '57', '59', '63'], 2],

  ['Genel Kültür', 'k', 'Gökkuşağında kaç renk vardır?', ['5', '6', '7', '8'], 2],
  ['Genel Kültür', 'k', 'Dünyanın en kalabalık kıtası hangisidir?', ['Afrika', 'Asya', 'Avrupa', 'Güney Amerika'], 1],
  ['Genel Kültür', 'o', 'Nobel Ödülleri (Barış hariç) hangi ülkede verilir?', ['Norveç', 'İsveç', 'Danimarka', 'Finlandiya'], 1],
  ['Genel Kültür', 'z', 'Dünyada en çok kişinin ana dili olarak konuştuğu dil hangisidir?', ['İngilizce', 'İspanyolca', 'Mandarin Çincesi', 'Hintçe'], 2],
  ['Genel Kültür', 'u', 'Hangi ülkenin bayrağı kare biçimindedir (Vatikan hariç)?', ['İsviçre', 'Avusturya', 'Danimarka', 'Polonya'], 0],
];
/*GEN*/
const GEN = (() => {
  let sd = 20261120;
  const rnd = () => { sd = (sd + 0x6D2B79F5) | 0; let t = Math.imul(sd ^ (sd >>> 15), 1 | sd); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const out = [], seen = new Set();
  const add = (cat, d, q, ans, wr) => { if (seen.has(q)) return false; seen.add(q); out.push([cat, d, q, [String(ans), ...wr.map(String)], 0]); return true; };
  const pickW = (pool, ans) => { const w = new Set(); while (w.size < 3) { const x = pool[ri(0, pool.length - 1)]; if (x !== ans) w.add(x); } return [...w]; };
  const numW = (ans, steps) => { const w = new Set(); while (w.size < 3) { const x = ans + steps[ri(0, steps.length - 1)] * ri(1, 3) * (rnd() < 0.5 ? -1 : 1); if (x !== ans && x > 0) w.add(x); } return [...w]; };
  const fill = (n, fn) => { let c = 0, g = 0; while (c < n && g++ < 20000) if (fn()) c++; };
  /* 100 ülke-başkent → 200 soru */
  const CAP = 'Fransa:Paris,Almanya:Berlin,İtalya:Roma,İspanya:Madrid,Japonya:Tokyo,Rusya:Moskova,Çin:Pekin,Hindistan:Yeni Delhi,Brezilya:Brasilia,Kanada:Ottawa,Mısır:Kahire,Yunanistan:Atina,Portekiz:Lizbon,Hollanda:Amsterdam,Belçika:Brüksel,İsviçre:Bern,Avusturya:Viyana,İsveç:Stockholm,Norveç:Oslo,Danimarka:Kopenhag,Finlandiya:Helsinki,Polonya:Varşova,Macaristan:Budapeşte,Çekya:Prag,Romanya:Bükreş,Bulgaristan:Sofya,Sırbistan:Belgrad,Hırvatistan:Zagreb,Ukrayna:Kiev,İrlanda:Dublin,İngiltere:Londra,Meksika:Meksiko,Arjantin:Buenos Aires,Şili:Santiago,Peru:Lima,Kolombiya:Bogota,Venezuela:Karakas,Küba:Havana,Güney Kore:Seul,Tayland:Bangkok,Vietnam:Hanoi,Endonezya:Cakarta,Filipinler:Manila,Malezya:Kuala Lumpur,Pakistan:İslamabad,Bangladeş:Dakka,İran:Tahran,Irak:Bağdat,Suudi Arabistan:Riyad,İsrail:Kudüs,Ürdün:Amman,Lübnan:Beyrut,Suriye:Şam,Azerbaycan:Bakü,Gürcistan:Tiflis,Ermenistan:Erivan,Kazakistan:Astana,Özbekistan:Taşkent,Afganistan:Kabil,Nepal:Katmandu,Moğolistan:Ulan Batur,Etiyopya:Addis Ababa,Kenya:Nairobi,Nijerya:Abuja,Fas:Rabat,Libya:Trablus,Sudan:Hartum,Gana:Akra,Senegal:Dakar,Tanzanya:Dodoma,Uganda:Kampala,Angola:Luanda,Zimbabve:Harare,Zambiya:Lusaka,Yeni Zelanda:Wellington,İzlanda:Reykjavik,Estonya:Talin,Letonya:Riga,Litvanya:Vilnius,Slovakya:Bratislava,Slovenya:Ljubljana,Bosna Hersek:Saraybosna,Arnavutluk:Tiran,Kuzey Makedonya:Üsküp,Karadağ:Podgorica,Moldova:Kişinev,Belarus:Minsk,Malta:Valletta,Kıbrıs:Lefkoşa,Katar:Doha,Umman:Maskat,Yemen:Sana,Bahreyn:Manama,Birleşik Arap Emirlikleri:Abu Dabi,Türkmenistan:Aşkabat,Kırgızistan:Bişkek,Tacikistan:Duşanbe,Kamboçya:Phnom Penh,Laos:Vientiane,Ekvador:Quito'.split(',').map((x) => x.split(':')).slice(0, 100);
  const caps = CAP.map((x) => x[1]), lands = CAP.map((x) => x[0]);
  CAP.forEach(([c, k], i) => {
    const d = i < 25 ? 'k' : i < 55 ? 'o' : i < 80 ? 'z' : 'u';
    add('Coğrafya', d, `${c} ülkesinin başkenti hangisidir?`, k, pickW(caps, k));
    add('Coğrafya', d, `Başkenti ${k} olan ülke hangisidir?`, c, pickW(lands, c));
  });
  /* 81 il-plaka → 162 soru */
  const PL = 'Adana,Adıyaman,Afyonkarahisar,Ağrı,Amasya,Ankara,Antalya,Artvin,Aydın,Balıkesir,Bilecik,Bingöl,Bitlis,Bolu,Burdur,Bursa,Çanakkale,Çankırı,Çorum,Denizli,Diyarbakır,Edirne,Elazığ,Erzincan,Erzurum,Eskişehir,Gaziantep,Giresun,Gümüşhane,Hakkari,Hatay,Isparta,Mersin,İstanbul,İzmir,Kars,Kastamonu,Kayseri,Kırklareli,Kırşehir,Kocaeli,Konya,Kütahya,Malatya,Manisa,Kahramanmaraş,Mardin,Muğla,Muş,Nevşehir,Niğde,Ordu,Rize,Sakarya,Samsun,Siirt,Sinop,Sivas,Tekirdağ,Tokat,Trabzon,Tunceli,Şanlıurfa,Uşak,Van,Yozgat,Zonguldak,Aksaray,Bayburt,Karaman,Kırıkkale,Batman,Şırnak,Bartın,Ardahan,Iğdır,Yalova,Karabük,Kilis,Osmaniye,Düzce'.split(','), plates = PL.map((_, i) => String(i + 1));
  PL.forEach((n, i) => {
    const d = [6, 34, 35, 16, 7, 1, 42, 27, 26, 55, 61].includes(i + 1) ? 'k' : 'ozu'[i % 3];
    add('Genel Kültür', d, `Plaka kodu ${i + 1} olan il hangisidir?`, n, pickW(PL, n));
    add('Genel Kültür', d, `${n} ilinin plaka kodu kaçtır?`, i + 1, pickW(plates, String(i + 1)));
  });
  /* 40 element → 110 soru */
  const EL = 'H:Hidrojen,He:Helyum,Li:Lityum,Be:Berilyum,B:Bor,C:Karbon,N:Azot,O:Oksijen,F:Flor,Ne:Neon,Na:Sodyum,Mg:Magnezyum,Al:Alüminyum,Si:Silisyum,P:Fosfor,S:Kükürt,Cl:Klor,Ar:Argon,K:Potasyum,Ca:Kalsiyum,Sc:Skandiyum,Ti:Titanyum,V:Vanadyum,Cr:Krom,Mn:Mangan,Fe:Demir,Co:Kobalt,Ni:Nikel,Cu:Bakır,Zn:Çinko,Ga:Galyum,Ge:Germanyum,As:Arsenik,Se:Selenyum,Br:Brom,Kr:Kripton,Ag:Gümüş,Sn:Kalay,I:İyot,Au:Altın'.split(',').map((x) => x.split(':')), syms = EL.map((x) => x[0]), nms = EL.map((x) => x[1]);
  EL.forEach(([y, n], i) => {
    const d = i < 8 ? 'k' : i < 20 ? 'o' : i < 32 ? 'z' : 'u';
    add('Bilim', d, `Kimyasal sembolü ${y} olan element hangisidir?`, n, pickW(nms, n));
    add('Bilim', d, `${n} elementinin kimyasal sembolü hangisidir?`, y, pickW(syms, y));
  });
  EL.slice(0, 30).forEach(([, n], i) => add('Bilim', i < 10 ? 'o' : 'z', `Atom numarası ${i + 1} olan element hangisidir?`, n, pickW(nms, n)));
  /* 528 matematik / zeka sorusu */
  const M = 'Mantık ve Zeka';
  fill(150, () => { const a = ri(7, 24), b = ri(7, 24), k = `${Math.min(a, b)}x${Math.max(a, b)}`, m = Math.max(a, b); if (seen.has(k)) return false; seen.add(k);
    return add(M, m < 12 ? 'k' : m < 16 ? 'o' : m < 21 ? 'z' : 'u', `${a} × ${b} işleminin sonucu kaçtır?`, a * b, numW(a * b, [1, 10, a, b])); });
  fill(120, () => { const a = ri(100, 999), b = ri(100, 999); return add(M, 'o', `${a} + ${b} işleminin sonucu kaçtır?`, a + b, numW(a + b, [1, 10, 100])); });
  fill(80, () => { const a = ri(300, 999), b = ri(100, a - 1); return add(M, 'o', `${a} − ${b} işleminin sonucu kaçtır?`, a - b, numW(a - b, [1, 10, 100])); });
  for (let n = 11; n <= 40; n++) add(M, n < 16 ? 'k' : n < 26 ? 'o' : 'z', `${n} sayısının karesi kaçtır?`, n * n, numW(n * n, [1, n, 10]));
  for (let n = 12; n <= 31; n++) add(M, 'o', `${n * n} sayısının karekökü kaçtır?`, n, numW(n, [1, 2]));
  fill(60, () => { const p = [10, 20, 25, 30, 40, 50, 60, 75][ri(0, 7)], b = ri(2, 100) * 20, a = b * p / 100; return add(M, 'o', `${b} sayısının %${p} kadarı kaçtır?`, a, numW(a, [1, 5, 10])); });
  fill(40, () => { const s0 = ri(1, 20), d = ri(2, 12), t = [0, 1, 2, 3].map((i) => s0 + i * d), a = s0 + 4 * d; return add(M, d < 6 ? 'k' : 'o', `Sıradaki sayı kaçtır? ${t.join(', ')}, ?`, a, numW(a, [d, 1, 2])); });
  fill(28, () => { const s0 = ri(1, 9), r = ri(2, 5), t = [0, 1, 2, 3].map((i) => s0 * r ** i), a = s0 * r ** 4; return add(M, 'z', `Sıradaki sayı kaçtır? ${t.join(', ')}, ?`, a, numW(a, [r, s0, 2])); });
  return out;
})();
/*ENDGEN*/

/* Yeni kategoriler + "Efsane" zorluk için ek sorular */
const EXTRA_RAW = [
  ['Hayvanlar ve Doğa', 'k', 'Dünyanın en büyük kara hayvanı hangisidir?', ['Zürafa', 'Afrika fili', 'Gergedan', 'Su aygırı'], 1],
  ['Hayvanlar ve Doğa', 'k', 'Arılar bal yapmak için neyi toplar?', ['Polen', 'Nektar', 'Yaprak', 'Su'], 1],
  ['Hayvanlar ve Doğa', 'o', 'Hangi hayvan memeli olduğu halde yumurta yapar?', ['Yarasa', 'Ornitorenk', 'Yunus', 'Fok'], 1],
  ['Hayvanlar ve Doğa', 'o', 'Dünyanın en hızlı kara hayvanı hangisidir?', ['Aslan', 'Çita', 'Antilop', 'At'], 1],
  ['Hayvanlar ve Doğa', 'z', 'Ahtapotun kaç kalbi vardır?', ['1', '2', '3', '8'], 2],
  ['Hayvanlar ve Doğa', 'u', 'Hangi canlı biyolojik olarak “ölümsüz” kabul edilir?', ['Turritopsis dohrnii denizanası', 'Galapagos kaplumbağası', 'Grönland köpekbalığı', 'Mercan'], 0],
  ['Hayvanlar ve Doğa', 'e', 'Tardigradlar (su ayıları) hangi koşulda kurutulmuş halde yıllarca canlı kalabilir?', ['Kriptobiyoz', 'Hibernasyon', 'Estivasyon', 'Metamorfoz'], 0],
  ['Yemek ve Mutfak', 'k', 'Baklavanın temel hamur türü hangisidir?', ['Yufka', 'Pide hamuru', 'Mayalı hamur', 'Kadayıf'], 0],
  ['Yemek ve Mutfak', 'k', 'Türk kahvesi hangi kapta pişirilir?', ['Cezve', 'Demlik', 'Güveç', 'Tencere'], 0],
  ['Yemek ve Mutfak', 'o', 'Sushi’de pirinci tatlandırmak için hangi sirke kullanılır?', ['Pirinç sirkesi', 'Elma sirkesi', 'Üzüm sirkesi', 'Balsamik'], 0],
  ['Yemek ve Mutfak', 'o', 'İtalyan pizzası “Margherita” hangi üç rengi taşır?', ['Kırmızı-beyaz-yeşil', 'Sarı-kırmızı-mor', 'Beyaz-mavi-kırmızı', 'Yeşil-sarı-kırmızı'], 0],
  ['Yemek ve Mutfak', 'z', 'Safran hangi bitkinin kurutulmuş tepecik kısmıdır?', ['Crocus sativus', 'Curcuma longa', 'Capsicum annuum', 'Piper nigrum'], 0],
  ['Yemek ve Mutfak', 'u', 'Fransız mutfağında “mirepoix” hangi üçlüdür?', ['Soğan, havuç, kereviz', 'Sarımsak, domates, fesleğen', 'Pırasa, patates, tereyağı', 'Maydanoz, dereotu, nane'], 0],
  ['Mitoloji', 'k', 'Yunan mitolojisinde şimşek tanrısı kimdir?', ['Zeus', 'Poseidon', 'Hades', 'Apollon'], 0],
  ['Mitoloji', 'k', 'Truva Savaşı’nı bitiren ünlü hile nedir?', ['Tahta at', 'Zehirli su', 'Gece baskını', 'Sahte barış'], 0],
  ['Mitoloji', 'o', 'Norse mitolojisinde Thor’un silahı nedir?', ['Mjölnir', 'Gungnir', 'Excalibur', 'Gram'], 0],
  ['Mitoloji', 'o', 'Mısır mitolojisinde ölüler dünyasının tanrısı kimdir?', ['Osiris', 'Ra', 'Horus', 'Anubis'], 0],
  ['Mitoloji', 'z', 'Medusa’yı öldüren kahraman kimdir?', ['Perseus', 'Herakles', 'Theseus', 'Odysseus'], 0],
  ['Mitoloji', 'u', 'Türk mitolojisinde yeraltı dünyasının hükümdarı kimdir?', ['Erlik Han', 'Ülgen', 'Umay', 'Kayra Han'], 0],
  ['Tarih', 'e', 'Kadeş Antlaşması hangi iki devlet arasında yapılmıştır?', ['Mısır ve Hitit', 'Asur ve Babil', 'Roma ve Kartaca', 'Pers ve Yunan'], 0],
  ['Bilim', 'e', 'Hangi parçacık Higgs alanıyla etkileşerek kütle kazanmayı açıklar?', ['Higgs bozonu', 'Gluon', 'Foton', 'Nötrino'], 0],
  ['Coğrafya', 'e', 'Dünyanın en derin gölü hangisidir?', ['Baykal Gölü', 'Tanganyika Gölü', 'Hazar Denizi', 'Superior Gölü'], 0],
  ['Teknoloji', 'e', 'TCP/IP modelinde “taşıma” katmanında çalışan protokol hangisidir?', ['TCP', 'HTTP', 'IP', 'ARP'], 0],
  ['Mantık ve Zeka', 'e', '2, 6, 12, 20, 30, ? dizisinde sıradaki sayı kaçtır?', ['42', '40', '36', '44'], 0],
  ['Edebiyat', 'e', '“Kürk Mantolu Madonna” romanının yazarı kimdir?', ['Sabahattin Ali', 'Yaşar Kemal', 'Orhan Pamuk', 'Reşat Nuri Güntekin'], 0],
  ['Sanat', 'e', 'Guernica tablosu hangi sanatçıya aittir?', ['Pablo Picasso', 'Salvador Dalí', 'Joan Miró', 'Francisco Goya'], 0],
  ['Spor', 'e', 'Futbolda “ofsayt” kuralı ilk hangi yıl kural kitabına girmiştir?', ['1863', '1900', '1924', '1950'], 0],
  ['Müzik', 'e', 'Senfoni orkestrasında standart olarak kaç telli çalgı grubu bulunur?', ['4 (keman, viyola, çello, kontrbas)', '2', '3', '6'], 0],
  ['Film ve Diziler', 'e', 'İlk sesli uzun metrajlı film olarak kabul edilen yapım hangisidir?', ['The Jazz Singer', 'Metropolis', 'Modern Times', 'Sunrise'], 0],
  ['Video Oyunları', 'e', 'Pong oyununu 1972’de hangi şirket piyasaya sürdü?', ['Atari', 'Nintendo', 'Sega', 'Namco'], 0],
  ['İnternet Kültürü', 'e', 'İlk web sitesini 1991’de yayınlayan kurum hangisidir?', ['CERN', 'MIT', 'Stanford', 'NASA'], 0],
  ['Genel Kültür', 'e', 'Uluslararası Tarih Değiştirme Çizgisi yaklaşık hangi boylam boyunca uzanır?', ['180°', '0°', '90°', '45°'], 0],
];
export const RAW = [...BASE_RAW, ...EXTRA_RAW];

/* ---------- Yayıncı/bilim insanı/sanatçı özel soruları ---------- */
const XQ = `Bilim|k|Isaac Newton hangi kanunlarıyla tanınır?|Hareket ve yerçekimi kanunları|Elektrik akımı kanunları|Gaz kanunları|Işık kırılması kanunu
Bilim|o|Isaac Newton'un 1687'de yayımladığı ünlü eseri hangisidir?|Principia Mathematica|Opticks|Origin of Species|Almagest
Bilim|o|Newton'a göre kuvvet neye eşittir?|Kütle × ivme|Kütle ÷ hız|Hız × zaman|Enerji × yol
Bilim|k|Görelilik kuramını kim geliştirmiştir?|Albert Einstein|Niels Bohr|Galileo Galilei|Nikola Tesla
Bilim|o|Radyoaktiviteyi inceleyen ve iki Nobel kazanan bilim insanı kimdir?|Marie Curie|Rosalind Franklin|Ada Lovelace|Lise Meitner
Bilim|o|Evrim kuramını "Türlerin Kökeni" kitabıyla açıklayan kimdir?|Charles Darwin|Gregor Mendel|Louis Pasteur|Alfred Wallace
Bilim|z|Heliosentrik (Güneş merkezli) modeli ileri süren Rönesans astronomu kimdir?|Kopernik|Ptolemaios|Tycho Brahe|Kepler
Tarih|k|Fransız Devrimi hangi yılda başlamıştır?|1789|1815|1776|1848
Tarih|o|II. Dünya Savaşı hangi yılda sona ermiştir?|1945|1939|1918|1950
Tarih|o|Roma İmparatorluğu'nun ilk imparatoru kimdir?|Augustus|Jül Sezar|Neron|Konstantin
Tarih|z|Berlin Duvarı hangi yıl yıkılmıştır?|1989|1961|1991|1975
Tarih|o|Amerika'ya 1492'de ulaşan denizci kimdir?|Kristof Kolomb|Vasco da Gama|Macellan|Amerigo Vespucci
Tarih|z|Mısır'daki Rosetta Taşı hangi dilin çözülmesini sağlamıştır?|Hiyeroglif|Çivi yazısı|Latince|Fenike yazısı
Coğrafya|k|Avustralya'nın başkenti neresidir?|Canberra|Sidney|Melbourne|Perth
Coğrafya|k|Dünyanın en uzun nehirlerinden biri olan Nil hangi kıtadadır?|Afrika|Asya|Güney Amerika|Avrupa
Coğrafya|o|Kanada'nın en kalabalık şehri hangisidir?|Toronto|Ottawa|Vancouver|Montreal
Coğrafya|o|Dünyanın en yüksek dağı hangisidir?|Everest|K2|Kilimanjaro|Mont Blanc
Coğrafya|z|Arjantin'in başkenti neresidir?|Buenos Aires|Santiago|Montevideo|Lima
Coğrafya|z|Güney Kore'nin başkenti neresidir?|Seul|Busan|Pekin|Tokyo
Coğrafya|o|Amazon Nehri hangi kıtadadır?|Güney Amerika|Afrika|Asya|Kuzey Amerika
Film ve Diziler|k|"Titanik" filminin yönetmeni kimdir?|James Cameron|Steven Spielberg|Christopher Nolan|Ridley Scott
Film ve Diziler|o|"Inception" filminin yönetmeni kimdir?|Christopher Nolan|Quentin Tarantino|Denis Villeneuve|David Fincher
Film ve Diziler|o|"Game of Thrones" dizisi hangi yazarın kitaplarından uyarlanmıştır?|George R. R. Martin|J. R. R. Tolkien|Stephen King|Brandon Sanderson
Film ve Diziler|k|"Breaking Bad" dizisinin ana karakteri kimdir?|Walter White|Tony Soprano|Don Draper|Jon Snow
Edebiyat|k|"Harry Potter" serisinin yazarı kimdir?|J. K. Rowling|Suzanne Collins|Roald Dahl|C. S. Lewis
Edebiyat|o|"1984" romanının yazarı kimdir?|George Orwell|Aldous Huxley|Ray Bradbury|Franz Kafka
Edebiyat|o|"Savaş ve Barış" romanının yazarı kimdir?|Lev Tolstoy|Dostoyevski|Çehov|Gogol
Edebiyat|z|"Don Kişot" hangi ülkenin yazarı Cervantes'e aittir?|İspanya|İtalya|Portekiz|Fransa
Sanat|k|Mona Lisa tablosunu kim yapmıştır?|Leonardo da Vinci|Michelangelo|Raphael|Van Gogh
Sanat|o|"Yıldızlı Gece" tablosunun ressamı kimdir?|Vincent van Gogh|Claude Monet|Pablo Picasso|Salvador Dalí
Sanat|o|"Guernica" tablosu kime aittir?|Pablo Picasso|Salvador Dalí|Joan Miró|Goya
Müzik|o|"Dört Mevsim" eserinin bestecisi kimdir?|Antonio Vivaldi|Mozart|Beethoven|Bach
Müzik|k|Beatles grubu hangi ülkelidir?|İngiltere|ABD|İrlanda|Avustralya
Video Oyunları|k|Super Mario karakteri hangi şirkete aittir?|Nintendo|Sega|Sony|Microsoft
Video Oyunları|o|"The Legend of Zelda" oyununun kahramanı kimdir?|Link|Zelda|Ganondorf|Mario
Video Oyunları|o|Minecraft oyununu ilk geliştiren kişi kimdir?|Markus "Notch" Persson|Hideo Kojima|Gabe Newell|Shigeru Miyamoto
Yayıncı Özel|k|Canlı yayın platformu Twitch'in sahibi hangi şirkettir?|Amazon|Google|Meta|Microsoft
Yayıncı Özel|k|Yayıncılar izleyicilerle yazılı sohbet ettiği alana ne denir?|Chat|Lobi|Arena|Sunucu
Yayıncı Özel|o|Canlı yayında izleyicilerin yayıncıya yaptığı destek bağışına ne denir?|Donate|Spawn|Respawn|Patch
Bilim İnsanları|o|Alternatif akım sistemini geliştiren mucit kimdir?|Nikola Tesla|Thomas Edison|Alexander Bell|James Watt
Bilim İnsanları|z|Cisimlerin düşme hızının kütleden bağımsız olduğunu deneyle savunan kimdir?|Galileo Galilei|Aristoteles|Arşimet|Kepler
Bilim İnsanları|o|Bilgisayar biliminin öncülerinden "Enigma"yı çözen kişi kimdir?|Alan Turing|Charles Babbage|John von Neumann|Tim Berners-Lee
Sanatçılar|o|"Bohemian Rhapsody" şarkısı hangi gruba aittir?|Queen|The Beatles|Led Zeppelin|Pink Floyd
Sanatçılar|k|"Thriller" albümüyle tanınan sanatçı kimdir?|Michael Jackson|Prince|Elvis Presley|Freddie Mercury
Sanatçılar|z|"Ay Işığı Sonatı"nı kim bestelemiştir?|Beethoven|Chopin|Liszt|Schubert`.split('\n').map((l) => { const [cat, d, q, ...opts] = l.split('|'); return { cat, d, q, opts, a: 0 }; });

/* ---------- QUESTIONS: tek düz liste ---------- */
export const QUESTIONS = [...RAW, ...GEN].map(([cat, d, q, opts, a], i) => ({ id: i, cat, d, q, opts, a }));
XQ.forEach((x) => QUESTIONS.push({ id: QUESTIONS.length, ...x }));

/** Yönetici/yerel/Firestore'dan gelen özel soruları ekler, silinenleri çıkarır. */
export function mergeCustomQuestions(custom = [], deletedTexts = []) {
  const have = new Set(QUESTIONS.map((x) => x.q));
  custom.forEach((x) => { if (x && x.q && Array.isArray(x.opts) && !have.has(x.q)) { QUESTIONS.push({ id: QUESTIONS.length, cat: x.cat, d: x.d || 'o', q: x.q, opts: x.opts, a: x.a ?? 0 }); have.add(x.q); } });
  const del = new Set(deletedTexts);
  for (let i = QUESTIONS.length; i--;) if (del.has(QUESTIONS[i].q)) QUESTIONS.splice(i, 1);
  return QUESTIONS.length;
}
export const poolSize = (cat, diff) => QUESTIONS.filter((q) => (cat === 'all' || q.cat === cat) && (diff === 'all' || q.d === diff)).length;

/** Soru seçimi: önce görülmeyenler, sonra karışık. seen = daha önce görülen soru id'leri. */
export function pickQuestions({ cat = 'all', diff = 'all', count = 10, seen = [] }) {
  const ok = QUESTIONS.filter((q) => (cat === 'all' || q.cat === cat) && (diff === 'all' || q.d === diff));
  const seenSet = new Set(seen);
  const fresh = shuffle(ok.filter((q) => !seenSet.has(q.id))), old = shuffle(ok.filter((q) => seenSet.has(q.id)));
  return [...fresh, ...old].slice(0, count);
}

/* ============================================================
   YAYIN ODASI: katılımcı sayısına göre şık sayısı ve puanlama
   • Standart odalar: 4 şık.
   • 500+ katılımcı: 6 şık  (şans payı düşer, bilgi/refleks farkı belirginleşir)
   • 1.000+ katılımcı: 6 şık + "mega" tempo (ilk 10 listesi, sık güncellenen sıralama)
   • Doğru: hıza göre +100…+1.000 (50'lik kademe) • Yanlış: −100…−1.000
   • Kalabalıkta herkes tek tek çizilmez; yalnızca ilk 10 + oyuncunun sırası gösterilir.
   ============================================================ */
export const STREAM = {
  SIX_AT: 500, MEGA_AT: 1000, TOP: 10,
  CAPS: [10, 50, 100, 500, 1000, 2500, 5000, 10000],
  MAX_POINTS: 1000, MIN_POINTS: 100,
};
export const optionCountFor = (viewers) => (viewers >= STREAM.SIX_AT ? 6 : 4);
export function streamTier(viewers) {
  if (viewers >= STREAM.MEGA_AT) return { id: 'mega', label: 'Mega Yayın', opts: 6 };
  if (viewers >= STREAM.SIX_AT) return { id: 'kalabalik', label: 'Kalabalık Yayın', opts: 6 };
  return { id: 'standart', label: 'Standart Yayın', opts: 4 };
}
/** f: kullanılan süre oranı (0 = anında, 1 = süre dolmak üzere) */
export function streamPoints(correct, f) {
  const x = clamp(f, 0, 1);
  return correct ? Math.round((STREAM.MAX_POINTS - 900 * x) / 50) * 50 : -100 * Math.max(1, Math.round(10 - 9 * x));
}

/** Yardımcı: soruyu `count` şıklı hale getirir (4 → 6). Doğru şık işaretlenir; karışık sırada DEĞİL döner. */
export function makeOptions(q, count = 4) {
  const o = q.opts.map((t, i) => ({ t, ok: i === q.a }));
  if (count <= o.length) return o;
  const num = /^[\d.,\s%-]+$/, isNum = num.test(String(q.opts[q.a]));
  const have = new Set(q.opts.map(String));
  const take = (list) => {
    for (const t of shuffle([...new Set(list.map(String))])) {
      if (o.length >= count) break;
      if (have.has(t) || num.test(t) !== isNum) continue;
      have.add(t); o.push({ t, ok: false });
    }
  };
  take(QUESTIONS.filter((x) => x.cat === q.cat && x.id !== q.id).flatMap((x) => x.opts));      // önce aynı kategori
  if (o.length < count) take(QUESTIONS.filter((x) => x.id !== q.id).flatMap((x) => x.opts));    // yetmezse tüm banka
  if (isNum) while (o.length < count) { // sayısal sorularda son çare: doğru cevaba yakın uydurma değer
    const base = Number(String(q.opts[q.a]).replace(/[^\d.-]/g, '')) || 10, t = String(base + Math.round(rand(-9, 9)) || base + 7);
    if (!have.has(t)) { have.add(t); o.push({ t, ok: false }); }
  }
  return o;
}
/** Mevcut oyun koduyla uyumlu kısayol: optsFor(q, six) */
export const optsFor = (q, six) => makeOptions(q, six ? STREAM.SIX_AT && 6 : 4);
/** Karıştırılmış şık listesi: viewers'a göre 4 ya da 6 şık */
export const buildOptions = (q, viewers = 0) => shuffle(makeOptions(q, optionCountFor(viewers)));
