import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";

/**
 * Dosya depolama. Supabase Storage'a düz `fetch` ile yazılır, SDK
 * eklenmez — soğuk başlangıç hafif kalsın (MIMARI §5).
 *
 * Ortam değişkenleri tanımsızsa yerel diske düşer; böylece Supabase
 * kurmadan geliştirme çalışır. **Yerel disk yalnız geliştirme içindir:**
 * sunucusuz dağıtımda dosya sistemi kalıcı değil, DEPLOY.md bunu söylüyor.
 */
const BUCKET = process.env.SUPABASE_BUCKET ?? "ekler";
const LOCAL_DIR = path.join(process.cwd(), ".uploads");

function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ""), key };
}

export function isRemoteStorage(): boolean {
  return supabaseConfig() !== null;
}

export type StoredFile = { url: string; storagePath: string };

export async function storeFile(
  objectPath: string,
  body: ArrayBuffer,
  contentType: string,
): Promise<StoredFile> {
  const config = supabaseConfig();

  if (!config) {
    const target = path.join(LOCAL_DIR, objectPath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, Buffer.from(body));
    // Yerel dosyalar kimlik doğrulamalı bir uçtan sunulur.
    return { url: `/api/dosya/${objectPath}`, storagePath: objectPath };
  }

  const response = await fetch(
    `${config.url}/storage/v1/object/${BUCKET}/${objectPath}`,
    {
      method: "POST",
      headers: {
        // Yalnız Authorization yetmiyor; Supabase ayrıca apikey bekliyor,
        // eksikse 401 döner (TUZAKLAR #5).
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        "Content-Type": contentType,
        "x-upsert": "true",
      },
      body,
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Supabase yükleme hatası ${response.status}: ${detail}`);
  }

  return {
    url: `${config.url}/storage/v1/object/public/${BUCKET}/${objectPath}`,
    storagePath: objectPath,
  };
}

export async function removeFile(objectPath: string): Promise<void> {
  const config = supabaseConfig();

  if (!config) {
    await unlink(path.join(LOCAL_DIR, objectPath)).catch(() => {
      // Dosya yoksa sorun değil: kayıt zaten siliniyor.
    });
    return;
  }

  await fetch(`${config.url}/storage/v1/object/${BUCKET}/${objectPath}`, {
    method: "DELETE",
    headers: { apikey: config.key, Authorization: `Bearer ${config.key}` },
  }).catch(() => {
    // Depolamada kalan artık dosya, kaydı silmemek için sebep değil.
  });
}

/** Depolanan dosyayı sunucuda okur — faturadan veri çıkarma bunu kullanır. */
export async function fetchFile(objectPath: string): Promise<ArrayBuffer | null> {
  const config = supabaseConfig();

  if (!config) {
    try {
      const buffer = await readFile(localFilePath(objectPath));
      return buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength,
      ) as ArrayBuffer;
    } catch {
      return null;
    }
  }

  const response = await fetch(
    `${config.url}/storage/v1/object/${BUCKET}/${objectPath}`,
    { headers: { apikey: config.key, Authorization: `Bearer ${config.key}` } },
  );
  if (!response.ok) return null;
  return response.arrayBuffer();
}

/** Yerel yedek için okuma yolu; uç dosyayı buradan sunar. */
export function localFilePath(objectPath: string): string {
  return path.join(LOCAL_DIR, objectPath);
}
