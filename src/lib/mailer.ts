import "server-only";

import nodemailer, { type Transporter } from "nodemailer";
import type { Mail } from "@/lib/email-message";

/**
 * E-posta gönderimi (docs/MIMARI.md §4). SMTP tanımsızsa özellik kapalı ve
 * arayüzde hiç görünmüyor — push ve faturadan okumadaki kuralın aynısı.
 *
 * Gönderim `await` ediliyor: sunucusuz fonksiyon yanıttan sonra iş yapmıyor
 * (TUZAKLAR #1).
 */
let cached: Transporter | null = null;
let checked = false;

function transport(): Transporter | null {
  if (checked) return cached;
  checked = true;

  const url = process.env.SMTP_URL;
  if (!url) {
    cached = null;
    return null;
  }

  cached = nodemailer.createTransport(url);
  return cached;
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.SMTP_URL && process.env.SMTP_FROM);
}

export type SendResult = { ok: boolean; error?: string };

export async function sendMail(to: string, mail: Mail): Promise<SendResult> {
  const sender = transport();
  const from = process.env.SMTP_FROM;
  if (!sender || !from) {
    return { ok: false, error: "E-posta kapalı: SMTP tanımlı değil" };
  }

  try {
    await sender.sendMail({ from, to, subject: mail.subject, text: mail.text });
    return { ok: true };
  } catch (error) {
    // Tek bir adresin başarısız olması cron'un kalanını durdurmasın.
    console.error("e-posta gönderilemedi", (error as Error).message);
    return { ok: false, error: "E-posta gönderilemedi" };
  }
}

/** Birden çok adrese; kaç tanesinin gittiğini döner. */
export async function sendMailToMany(
  recipients: string[],
  mail: Mail,
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  for (const to of recipients) {
    const result = await sendMail(to, mail);
    if (result.ok) sent += 1;
    else failed += 1;
  }

  return { sent, failed };
}
