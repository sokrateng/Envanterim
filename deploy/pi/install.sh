#!/usr/bin/env bash
# Envanterim: Raspberry Pi kurulumu (Debian/Raspberry Pi OS 64-bit, Node 20+).
# Proje klasöründen çalıştırılır:  bash deploy/pi/install.sh
# Tekrar çalıştırmak güvenli: .env varsa sırlara dokunmaz.
set -euo pipefail

say() { printf '\n==> %s\n' "$*"; }
die() { printf 'HATA: %s\n' "$*" >&2; exit 1; }

cd "$(dirname "$0")/../.."
APP_DIR="$(pwd)"
[ "$(id -u)" -ne 0 ] || die "root olarak çalıştırmayın; sudo gerekeni kendisi ister."

say "1/7 Ön kontroller"
command -v node >/dev/null || die "node kurulu değil"
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 20 ] || die "Node 20+ gerekli (var: $(node -v))"
command -v openssl >/dev/null || die "openssl kurulu değil"
command -v curl >/dev/null || die "curl kurulu değil"
[ "$APP_DIR" = "/home/enginc/envanterim" ] || \
  echo "UYARI: servis dosyaları /home/enginc/envanterim yolunu bekliyor (şu an: $APP_DIR)"

say "2/7 Bağımlılıklar"
# Pi'de derleme sırasında bellek taşmasın.
export NODE_OPTIONS="--max-old-space-size=1536"
npm ci --no-audit --no-fund

say "3/7 .env"
mkdir -p data
if [ ! -f .env ]; then
  cp deploy/pi/env.pi.example .env
  chmod 600 .env
  NEW_ENV=1
else
  NEW_ENV=0
fi

# Boş olan sırları üret (dolu olana dokunma).
set_if_empty() {
  local key="$1" value="$2"
  if grep -qE "^${key}=\"?\"?$" .env; then
    # '|' ayracı: base64 değerlerinde '/' olabilir.
    sed -i -E "s|^${key}=.*$|${key}=\"${value}\"|" .env
    echo "  $key üretildi"
  fi
}
set_if_empty NEXTAUTH_SECRET "$(openssl rand -base64 32)"
set_if_empty CRON_SECRET "$(openssl rand -hex 24)"
if grep -qE '^NEXT_PUBLIC_VAPID_PUBLIC_KEY=""$' .env; then
  VAPID_JSON="$(node -e 'console.log(JSON.stringify(require("web-push").generateVAPIDKeys()))')"
  set_if_empty NEXT_PUBLIC_VAPID_PUBLIC_KEY "$(node -p "JSON.parse(process.argv[1]).publicKey" "$VAPID_JSON")"
  set_if_empty VAPID_PRIVATE_KEY "$(node -p "JSON.parse(process.argv[1]).privateKey" "$VAPID_JSON")"
fi
[ "$NEW_ENV" -eq 0 ] || echo "  .env oluşturuldu. VAPID_SUBJECT ve (isterseniz) SMTP/model anahtarlarını düzenleyin."

say "4/7 Veritabanı göçleri"
set -a; . ./.env; set +a
node node_modules/prisma/build/index.js migrate deploy

say "5/7 Derleme (Pi'de birkaç dakika sürebilir)"
npm run build

say "6/7 systemd servisleri"
# sudo parola istiyorsa ve terminal yoksa (ör. ssh ile komut) buraya giremeyiz:
# komutları yazdırıp çıkıyoruz, kullanıcı kendi terminalinde çalıştırır.
if sudo -n true 2>/dev/null || [ -t 0 ]; then
  sudo cp deploy/pi/envanterim.service deploy/pi/envanterim-cron.service deploy/pi/envanterim-cron.timer /etc/systemd/system/
  sudo systemctl daemon-reload
  sudo systemctl enable --now envanterim.service envanterim-cron.timer
else
  cat <<'MANUEL'
  sudo parolası gerektiği için bu adım atlandı. Pi'nin kendi terminalinde çalıştırın:

    cd /home/enginc/envanterim
    sudo cp deploy/pi/envanterim.service deploy/pi/envanterim-cron.service deploy/pi/envanterim-cron.timer /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable --now envanterim.service envanterim-cron.timer
    sudo tailscale funnel --bg --https=8443 3000

  Sonra: npm run create-admin
MANUEL
  exit 0
fi

say "7/7 Sağlık denetimi"
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS -o /dev/null http://127.0.0.1:3000/giris; then
    echo "  Uygulama 127.0.0.1:3000 üzerinde yanıt veriyor."
    break
  fi
  [ "$i" -lt 10 ] || die "Uygulama yanıt vermiyor: journalctl -u envanterim -n 50"
  sleep 2
done

cat <<'SON'

Kurulum tamam. Kalan adımlar (elle):
  1) İlk hesap:      npm run create-admin
  2) İnternete aç:   sudo tailscale funnel --bg --https=8443 3000
     (mevcut kamera paneli adresine ve kök yola dokunmaz)
  3) Yedek:          bash deploy/pi/backup.sh
SON
