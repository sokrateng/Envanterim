/**
 * İkon önerileri — saf ve testli.
 *
 * Tek bir emoji kutusu yerine hazır bir liste veriyoruz; yazılan ada göre
 * ilgili olanlar öne çıkıyor. Amaç seçenek yığmak değil: telefonda emoji
 * klavyesini açıp aramak yavaş, üç dokunuşta biten bir liste hızlı.
 */

export type EmojiSet = "location" | "category";

/** Lokasyonlar: ev, iş, depo, araç… */
export const LOCATION_EMOJI = [
  "🏠", "🏡", "🏢", "🏬", "🏭", "🏫", "🏥", "🏨",
  "🚗", "🚚", "⛵", "🏕", "🏖", "🗄", "📦", "🔧",
  "🛏", "🍽", "🛋", "🚿", "🌳", "📍",
];

/** Kategoriler: cihaz, eşya, araç, alet… */
export const CATEGORY_EMOJI = [
  "💻", "🖥", "📱", "⌚", "🎧", "📷", "🖨", "🖱",
  "🧊", "🧺", "🍳", "☕", "🔌", "❄️", "🔥", "💡",
  "🛋", "🛏", "🪑", "🚪", "🪟", "🧹",
  "🚗", "🏍", "🚲", "🛴", "🔧", "🪛", "🪜", "⚙️",
  "🎸", "⚽", "🏋", "🎮", "📚", "🧸", "🌱", "🏷",
];

export function emojiSet(set: EmojiSet): string[] {
  return set === "location" ? LOCATION_EMOJI : CATEGORY_EMOJI;
}

/**
 * Anahtar kelime → emoji. Türkçe yazımlar ve yaygın kısaltmalar burada;
 * liste kısa tutuluyor, tahmin etmeye çalışmıyor.
 */
const KEYWORDS: Array<[string, string]> = [
  ["ev", "🏠"], ["daire", "🏠"], ["yazlik", "🏖"], ["ofis", "🏢"], ["is", "🏢"],
  ["sirket", "🏢"], ["dukkan", "🏬"], ["magaza", "🏬"], ["fabrika", "🏭"],
  ["depo", "📦"], ["ambar", "📦"], ["arac", "🚗"], ["araba", "🚗"],
  ["kamyon", "🚚"], ["tekne", "⛵"], ["bahce", "🌳"], ["mutfak", "🍽"],
  ["salon", "🛋"], ["yatak", "🛏"], ["banyo", "🚿"], ["atolye", "🔧"],

  ["bilgisayar", "💻"], ["laptop", "💻"], ["dizustu", "💻"], ["masaustu", "🖥"],
  ["monitor", "🖥"], ["ekran", "🖥"], ["telefon", "📱"], ["tablet", "📱"],
  ["saat", "⌚"], ["kulaklik", "🎧"], ["airpod", "🎧"], ["kamera", "📷"],
  ["fotograf", "📷"], ["yazici", "🖨"], ["printer", "🖨"], ["mouse", "🖱"],
  ["klavye", "⌨"], ["lisans", "🏷"], ["abonelik", "🏷"],

  ["beyaz esya", "🧊"], ["buzdolabi", "🧊"], ["dondurucu", "🧊"],
  ["camasir", "🧺"], ["bulasik", "🍽"], ["firin", "🍳"], ["ocak", "🔥"],
  ["kahve", "☕"], ["supurge", "🧹"], ["klima", "❄️"], ["isitici", "🔥"],
  ["kombi", "🔥"], ["lamba", "💡"], ["priz", "🔌"],

  ["mobilya", "🪑"], ["koltuk", "🛋"], ["masa", "🪑"], ["sandalye", "🪑"],
  ["dolap", "🚪"], ["pencere", "🪟"],

  ["motosiklet", "🏍"], ["bisiklet", "🚲"], ["scooter", "🛴"],
  ["alet", "🔧"], ["takim", "🪛"], ["merdiven", "🪜"], ["makine", "⚙️"],

  ["muzik", "🎸"], ["gitar", "🎸"], ["spor", "⚽"], ["oyun", "🎮"],
  ["kitap", "📚"], ["oyuncak", "🧸"], ["bitki", "🌱"],
];

/**
 * Türkçe karşılaştırma için sadeleştirme. `toLowerCase()` "İ"yi bozuyor
 * (TUZAKLAR #41), bu yüzden harfler elle eşleniyor.
 */
export function fold(text: string): string {
  const map: Record<string, string> = {
    İ: "i", I: "i", ı: "i", Ş: "s", ş: "s", Ğ: "g", ğ: "g",
    Ü: "u", ü: "u", Ö: "o", ö: "o", Ç: "c", ç: "c",
  };
  return [...text]
    .map((ch) => map[ch] ?? ch.toLowerCase())
    .join("")
    .trim();
}

/**
 * Ada göre sıralanmış öneri listesi. Eşleşen emoji başa gelir, kalanlar
 * kümedeki sırayı korur — liste her yazışta baştan karışmasın.
 */
export function suggestEmoji(name: string, set: EmojiSet): string[] {
  const base = emojiSet(set);
  const text = fold(name);
  if (!text) return base;

  const hits: string[] = [];
  for (const [keyword, emoji] of KEYWORDS) {
    if (!text.includes(keyword)) continue;
    if (!hits.includes(emoji)) hits.push(emoji);
  }

  return [...hits, ...base.filter((emoji) => !hits.includes(emoji))];
}
