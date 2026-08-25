"use client";

/**
 * Fotoğrafı yüklemeden önce istemcide küçültür. Telefon fotoğrafı 5-10 MB
 * olabiliyor; sunucusuz istek gövdesi ~4,5 MB (TUZAKLAR #31). Küçültme ilk
 * savunma: hem sınırın altına iner hem yükleme hızlanır.
 *
 * PDF ve HEIC'e dokunulmaz: PDF görsel değil (TUZAKLAR #30), HEIC'i tarayıcı
 * canvas'a çizemeyebilir — ikisi de olduğu gibi gider.
 */
const MAX_EDGE = 2000;
const QUALITY = 0.85;

export async function shrinkImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  if (file.type === "image/heic") return file;
  if (typeof createImageBitmap !== "function") return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // Tarayıcı bu biçimi çözemedi; dosyayı olduğu gibi gönder.
    return file;
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size <= 1_500_000) {
    bitmap.close();
    return file;
  }

  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return file;
  }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", QUALITY),
  );
  if (!blob || blob.size >= file.size) return file;

  const name = file.name.replace(/\.[^.]+$/, "") || "fotograf";
  return new File([blob], `${name}.jpg`, { type: "image/jpeg" });
}
