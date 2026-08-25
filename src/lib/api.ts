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
