import type { AttachmentKind } from "@/lib/constants";

/**
 * Yükleme kuralları — saf ve testli. Sunucusuz istek gövdesi ~4,5 MB
 * (TUZAKLAR #31); istemci fotoğrafı küçültse de sunucu kendi sınırını
 * kendisi uygular.
 */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
] as const;

export const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "application/pdf": "pdf",
};

export function isAllowedType(type: string): boolean {
  return (ALLOWED_TYPES as readonly string[]).includes(type);
}

/** Fatura PDF'i görsel değil; boru hattı baştan ayrılır (TUZAKLAR #30). */
export function isImage(type: string): boolean {
  return type.startsWith("image/");
}

export type UploadCheck =
  | { ok: true; kind: AttachmentKind }
  | { ok: false; message: string };

export function checkUpload(
  file: { type: string; size: number },
  kind: string,
  allowedKinds: readonly string[],
): UploadCheck {
  if (!isAllowedType(file.type)) {
    return { ok: false, message: "Yalnız JPG, PNG, WebP, HEIC ve PDF yüklenir" };
  }
  if (file.size <= 0) {
    return { ok: false, message: "Dosya boş" };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, message: "Dosya 4 MB'dan büyük olamaz" };
  }
  if (!allowedKinds.includes(kind)) {
    return { ok: false, message: "Geçersiz belge türü" };
  }
  if (kind === "PHOTO" && !isImage(file.type)) {
    return { ok: false, message: "Fotoğraf olarak yalnız görsel yüklenir" };
  }
  return { ok: true, kind: kind as AttachmentKind };
}

/**
 * Depolama yolu. Kullanıcının verdiği ad yola karışmaz: uzantı MIME'dan
 * gelir, gövde rastgele kimlikten. Ad yalnız görünen etiket olarak saklanır.
 */
export function storagePath(
  itemId: string,
  fileId: string,
  mimeType: string,
): string {
  const extension = EXTENSIONS[mimeType] ?? "bin";
  return `ekipman/${itemId}/${fileId}.${extension}`;
}

/** Görünen dosya adı: yol ayracı ve kontrol karakteri barındırmaz. */
export function safeDisplayName(name: string, fallback = "dosya"): string {
  const cleaned = name
    .split("")
    .map((char) => (char < " " || char === "/" || char === "\\" ? " " : char))
    .join("")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return cleaned || fallback;
}
