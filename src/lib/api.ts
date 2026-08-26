import { NextResponse } from "next/server";
import { ZodError, type ZodTypeAny, type output } from "zod";
import { firstError } from "@/lib/validation";

/** API hataları tek biçimde ve Türkçe döner. */
export function apiError(message: string, status = 400) {
  return NextResponse.json({ hata: message }, { status });
}

export const UNAUTHENTICATED = () => apiError("Giriş yapmalısın", 401);
export const NOT_MEMBER = () => apiError("Bu lokasyona erişimin yok", 404);
export const READONLY = () => apiError("Bu işlem için yetkin yok", 403);

/**
 * Gövdeyi şemadan geçirir. Doğrulama hatası da JSON gövdesi hatası da
 * kullanıcıya Türkçe döner.
 */
export async function parseBody<S extends ZodTypeAny>(
  request: Request,
  schema: S,
): Promise<{ data: output<S> } | { response: NextResponse }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { response: apiError("Gövde okunamadı") };
  }

  try {
    return { data: schema.parse(raw) };
  } catch (error) {
    if (error instanceof ZodError) {
      return { response: apiError(firstError(error), 422) };
    }
    throw error;
  }
}

/**
 * Beklenmeyen istisnayı JSON'a çevirir.
 *
 * Sarmalanmayan bir uçta istisna Next'in HTML hata sayfasına dönüşüyor;
 * istemci `response.json()` yapamayınca elinde yalnız genel mesaj kalıyor ve
 * kullanıcı "neden olmadı" sorusunun cevabını hiçbir yerde bulamıyor. Burada
 * hata bir kimlikle günlüğe yazılıyor, kullanıcıya da aynı kimlik gösteriliyor:
 * ekrandaki kod ile sunucu günlüğü eşleşiyor.
 */
export async function guard(
  route: string,
  handler: () => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    return await handler();
  } catch (error) {
    const id = Math.random().toString(36).slice(2, 8);
    console.error(`[${route}] ${id}`, error);

    // Hatanın **türü** ve varsa sağlayıcı kodu kullanıcıya da gidiyor: sır
    // içermiyor ama "neden olmadı" sorusunu tek bakışta cevaplıyor. Mesajın
    // kendisi yalnız günlükte kalıyor — bağlantı dizesi, tablo adı, yol
    // oradan sızabilir.
    const named = error as { name?: string; code?: string | number };
    const tur = [named?.name, named?.code].filter(Boolean).join(" ");

    return apiError(
      `Beklenmeyen bir hata oldu. Kod: ${id}${tur ? ` · ${tur}` : ""}`,
      500,
    );
  }
}
