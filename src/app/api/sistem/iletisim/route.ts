import { NextResponse } from "next/server";
import { z } from "zod";
import { READONLY, apiError, guard, parseBody } from "@/lib/api";
import { currentAdmin } from "@/lib/admin";
import {
  SETTING_KEYS,
  deleteSetting,
  resolvePushContact,
  setSetting,
} from "@/lib/app-settings";
import { normalizeVapidSubject } from "@/lib/vapid";

const bodySchema = z.object({ adres: z.string().max(200, "Adres çok uzun") });

/**
 * Push servislerine bildirilen iletişim adresi. Sır değil: her bildirimde
 * Apple/Google/Mozilla'ya gidiyor, sorun çıkarsa sunucunun sahibine
 * ulaşabilsinler diye. Düz e-posta yazılabiliyor, `mailto:` kendiliğinden
 * ekleniyor.
 */
export async function PUT(request: Request) {
  return guard("push-iletisim", async () => {
    const admin = await currentAdmin();
    if (!admin) return READONLY();

    const parsed = await parseBody(request, bodySchema);
    if ("response" in parsed) return parsed.response;

    const subject = normalizeVapidSubject(parsed.data.adres);
    if (!subject) {
      return apiError(
        "Geçerli bir e-posta adresi (ya da https:// ile başlayan bir bağlantı) yaz",
        422,
      );
    }

    await setSetting(SETTING_KEYS.pushContact, subject);
    return NextResponse.json(await resolvePushContact());
  });
}

/** Ekrandaki değeri siler; `.env`'deki (yoksa örnek) adrese dönülür. */
export async function DELETE() {
  return guard("push-iletisim-sil", async () => {
    const admin = await currentAdmin();
    if (!admin) return READONLY();

    await deleteSetting(SETTING_KEYS.pushContact);
    return NextResponse.json(await resolvePushContact());
  });
}
