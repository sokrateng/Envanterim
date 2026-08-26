/**
 * SMTP ayarını dağıtmadan önce sınar.
 *
 *   npm run mail:test -- sen@ornek.com
 *
 * `.env` içindeki `SMTP_URL` ve `SMTP_FROM` ile bir deneme postası gönderir.
 * Hata alırsan sebebini Türkçe yazar: e-posta ayarında en çok vakit kaybettiren
 * şey, hatanın dağıtımdan sonra ve sessizce ortaya çıkması.
 */
import nodemailer from "nodemailer";

const alici = process.argv[2];

if (!alici) {
  console.error("Kullanım: npm run mail:test -- alici@ornek.com");
  process.exit(1);
}

const url = process.env.SMTP_URL;
const from = process.env.SMTP_FROM;

if (!url || !from) {
  console.error(
    "SMTP_URL ve SMTP_FROM tanımlı değil. .env dosyasına ekle:\n" +
      '  SMTP_URL="smtps://kullanici%40gmail.com:uygulama-sifresi@smtp.gmail.com:465"\n' +
      '  SMTP_FROM="Envanterim <kullanici@gmail.com>"',
  );
  process.exit(1);
}

/** Yaygın hataların Türkçe karşılığı; kod olmadan tahmin etmek zor. */
function acikla(error: { code?: string; responseCode?: number; message?: string }): string {
  const kod = error.code ?? "";
  if (kod === "EAUTH" || error.responseCode === 535) {
    return (
      "Kimlik doğrulanamadı. Gmail kullanıyorsan: hesapta iki adımlı doğrulama " +
      "açık olmalı ve normal şifre değil **uygulama şifresi** kullanılmalı. " +
      "Kullanıcı adındaki @ işareti adreste %40 olarak yazılmalı."
    );
  }
  if (kod === "ESOCKET" || kod === "ECONNECTION" || kod === "ETIMEDOUT") {
    return (
      "Sunucuya bağlanılamadı. Adres ve port doğru mu? 465 için şema `smtps://`, " +
      "587 için `smtp://` olmalı."
    );
  }
  if (error.responseCode === 550 || error.responseCode === 553) {
    return (
      "Gönderen adresi reddedildi. Gmail yalnız kendi hesabının adresinden " +
      "(ya da doğrulanmış takma adından) göndertir: SMTP_FROM ile SMTP_URL'deki " +
      "kullanıcı aynı adres olmalı."
    );
  }
  return error.message ?? "Bilinmeyen hata";
}

async function main() {
  const transport = nodemailer.createTransport(url as string);
  const options = transport.options as {
    host?: string;
    port?: number;
    secure?: boolean;
    auth?: { user?: string };
  };

  console.log(
    `Sunucu: ${options.host}:${options.port} (TLS: ${options.secure ? "465 doğrudan" : "STARTTLS"})`,
  );
  console.log(`Kullanıcı: ${options.auth?.user}`);
  console.log(`Gönderen: ${from}`);
  console.log(`Alıcı: ${alici}\n`);

  try {
    await transport.verify();
    console.log("Bağlantı ve kimlik doğrulama tamam.");
  } catch (error) {
    console.error("Bağlanılamadı:", acikla(error as Error));
    process.exit(1);
  }

  try {
    const sonuc = await transport.sendMail({
      from,
      to: alici,
      subject: "Envanterim deneme postası",
      text:
        "Bu posta SMTP ayarını sınamak için gönderildi.\n\n" +
        "Bunu görüyorsan garanti, bakım ve zimmet bildirimleri de gidecek.\n\n—\nEnvanterim",
    });
    console.log("Gönderildi:", sonuc.messageId);
    console.log("Gelen kutusunu (ve spam klasörünü) kontrol et.");
  } catch (error) {
    console.error("Gönderilemedi:", acikla(error as Error));
    process.exit(1);
  }
}

main().finally(() => process.exit(process.exitCode ?? 0));
