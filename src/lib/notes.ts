/**
 * Ekipman notları — saf ve testli.
 *
 * Zaman çizelgesi olan biteni tutuyor (servis, sayaç, zimmet); notlar bilgiyi:
 * dondurma tarifi, doğru ayar, "bu vidayı sıkma". Yazan ve tarih kayıtta
 * duruyor, çünkü paylaşılan bir envanterde "bunu kim yazmış" sorusu gerçek.
 */

export const NOTE_MAX = 4000;
/** Bir nota en çok kaç fotoğraf: panel de liste de bunu taşıyabiliyor. */
export const NOTE_PHOTO_LIMIT = 4;

export type NoteAccess = {
  /** Notu yazan kullanıcı; hesabı silinmişse null. */
  userId: string | null;
};

export type NoteViewer = {
  userId: string;
  role: string;
};

/**
 * Notu kim düzenleyebilir: yalnız yazarı. Başkasının sözünü değiştirmek,
 * silmekten daha kötü — silinen bellidir, değiştirilen değil.
 */
export function canEditNote(note: NoteAccess, viewer: NoteViewer): boolean {
  return note.userId !== null && note.userId === viewer.userId;
}

/**
 * Notu kim silebilir: yazarı ve lokasyon sahibi. Sahip, ortak alandaki
 * içerikten sorumlu.
 */
export function canDeleteNote(note: NoteAccess, viewer: NoteViewer): boolean {
  return canEditNote(note, viewer) || viewer.role === "OWNER";
}

/** Listede görünen tek satırlık özet. */
export function noteExcerpt(body: string, limit = 90): string {
  const flat = body.replace(/\s+/g, " ").trim();
  if (flat.length <= limit) return flat;
  return `${flat.slice(0, limit - 1).trimEnd()}…`;
}
