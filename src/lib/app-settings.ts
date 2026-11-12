import "server-only";

import { prisma } from "@/lib/prisma";
import { isValidVapidSubject } from "@/lib/vapid";

/**
 * Uygulama genelinde ekrandan değiştirilen ayarlar (AppSetting tablosu).
 * Sır burada tutulmaz: VAPID özel anahtarı, SMTP şifresi, model anahtarı
 * `.env`'de kalır.
 */
export const SETTING_KEYS = {
  /** Push servislerine (Apple/Google/Mozilla) bildirilen iletişim adresi. */
  pushContact: "push.iletisim",
} as const;

const DEFAULT_PUSH_CONTACT = "mailto:envanter@example.com";

export async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

export async function deleteSetting(key: string): Promise<void> {
  await prisma.appSetting.deleteMany({ where: { key } });
}

export type PushContact = {
  subject: string;
  /** Değerin nereden geldiği: ekran > .env > varsayılan örnek adres. */
  source: "ekran" | "env" | "varsayilan";
};

/**
 * Önce ekrandaki ayar, sonra `VAPID_SUBJECT`, en son örnek adres. Ekrandaki
 * değer bozuksa (elle veritabanına yazılmış olabilir) sessizce bir alttakine
 * düşülür: bildirim bozuk adres yüzünden kapanmasın.
 */
export async function resolvePushContact(): Promise<PushContact> {
  const stored = await getSetting(SETTING_KEYS.pushContact);
  if (stored && isValidVapidSubject(stored)) {
    return { subject: stored, source: "ekran" };
  }

  const fromEnv = process.env.VAPID_SUBJECT;
  if (fromEnv && isValidVapidSubject(fromEnv)) {
    return { subject: fromEnv, source: "env" };
  }
  return { subject: DEFAULT_PUSH_CONTACT, source: "varsayilan" };
}
