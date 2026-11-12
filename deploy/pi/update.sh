#!/usr/bin/env bash
# Güncelleme: yedek al, yeni sürümü çek, derle, servisi durdur, göçleri uygula,
# yeniden başlat. Proje klasöründen çalıştırılır:  bash deploy/pi/update.sh
#
# Göç, servis DURMUŞKEN uygulanır: çalışan sunucu SQLite dosyasını tuttuğu için
# göç "database is locked" ile düşüyor. Derleme servis açıkken yapılır; kesinti
# yalnız durdurma ile başlatma arasındaki birkaç saniye.
set -euo pipefail

cd "$(dirname "$0")/../.."
say() { printf '\n==> %s\n' "$*"; }

say "Yedek"
bash deploy/pi/backup.sh

if [ -d .git ]; then
  say "Kod çekiliyor (yalnız ileri sarma)"
  git pull --ff-only
fi

export NODE_OPTIONS="--max-old-space-size=1536"
say "Bağımlılıklar"
npm ci --no-audit --no-fund

say "Derleme"
rm -rf .next.onceki
[ -d .next ] && mv .next .next.onceki
npm run build

say "Servis durduruluyor, göçler uygulanıyor"
sudo systemctl stop envanterim.service
set -a; . ./.env; set +a
if ! node node_modules/prisma/build/index.js migrate deploy; then
  echo "HATA: göç uygulanamadı. Eski derleme geri konuyor, servis başlatılıyor." >&2
  rm -rf .next
  [ -d .next.onceki ] && mv .next.onceki .next
  sudo systemctl start envanterim.service
  exit 1
fi

say "Başlatma"
sudo systemctl start envanterim.service
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS -o /dev/null http://127.0.0.1:3000/giris; then
    echo "Tamam: uygulama yanıt veriyor."
    exit 0
  fi
  sleep 2
done
echo "HATA: uygulama yanıt vermiyor. Kayıt: journalctl -u envanterim -n 50" >&2
echo "Eski derlemeye dönmek için: rm -rf .next && mv .next.onceki .next && sudo systemctl restart envanterim" >&2
exit 1
