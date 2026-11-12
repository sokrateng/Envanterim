#!/usr/bin/env bash
# Güncelleme: yeni sürümü çek, göçleri uygula, derle, yeniden başlat.
# Proje klasöründen çalıştırılır:  bash deploy/pi/update.sh
# Yedek alınır; sağlık denetimi başarısızsa servis çalışır durumda bırakılmaz
# ama eski derleme .next.onceki içinde durur (elle geri alınır).
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

say "Göçler"
set -a; . ./.env; set +a
node node_modules/prisma/build/index.js migrate deploy

say "Derleme"
rm -rf .next.onceki
[ -d .next ] && mv .next .next.onceki
npm run build

say "Yeniden başlatma"
sudo systemctl restart envanterim.service
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
