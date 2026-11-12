#!/usr/bin/env bash
# SQLite dosyasının tutarlı bir kopyasını ~/envanterim-yedek/ içine alır ve
# yüklenen dosyaları (.uploads) arşivler. Yazma sürerken düz `cp` bozuk dosya
# verebilir; bu yüzden SQLite'ın kendi yedekleme API'si (Python) kullanılıyor.
#
# Sonucu OUT_DIR/durum.json'a yazar: uygulamadaki Hesap → Sistem ekranı bunu
# okuyup yedek durumunu gösteriyor. Hem cron'dan hem ekrandaki "Şimdi yedekle"
# düğmesinden aynı betik çalışır.
set -euo pipefail

APP_DIR="${APP_DIR:-/home/enginc/envanterim}"
OUT_DIR="${OUT_DIR:-/home/enginc/envanterim-yedek}"
# Saklama yaşa göre (yaklaşık 2 ay); ne olursa olsun en yeni MIN_KEEP yedek
# silinmez: zamanlayıcı uzun süre çalışmazsa elde hiç yedek kalmasın.
RETENTION_DAYS="${RETENTION_DAYS:-60}"
MIN_KEEP="${MIN_KEEP:-3}"
STAMP="$(date +%Y%m%d-%H%M%S)"
DB_FILE="envanterim-$STAMP.db"

mkdir -p "$OUT_DIR"

write_status() {
  # $1 = ok|error, $2 = ileti, $3 = db dosyası (boşsa null), $4 = boyut
  local state="$1" message="${2//\"/\'}" db="${3:-}" size="${4:-}"
  local db_json="null" size_json="null"
  [ -z "$db" ] || db_json="\"$db\""
  [ -z "$size" ] || size_json="$size"
  # Geçici dosyaya yazıp yeniden adlandır: ekran yarım dosya okumasın.
  printf '{"state":"%s","finishedAt":"%s","message":"%s","db":%s,"dbSize":%s}\n' \
    "$state" "$(date -Iseconds)" "$message" "$db_json" "$size_json" \
    > "$OUT_DIR/durum.json.tmp"
  mv "$OUT_DIR/durum.json.tmp" "$OUT_DIR/durum.json"
}

# Beklenmeyen bir hatada ekran "yedek güncel" demeye devam etmesin.
trap 'write_status error "Yedek alınamadı (betik satır $LINENO). Ayrıntı: yedek.log"' ERR

python3 - "$APP_DIR/data/envanterim.db" "$OUT_DIR/$DB_FILE" <<'PY'
import sqlite3, sys
src, dst = sys.argv[1], sys.argv[2]
with sqlite3.connect(f"file:{src}?mode=ro", uri=True) as a, sqlite3.connect(dst) as b:
    a.backup(b)
PY

if [ -d "$APP_DIR/.uploads" ]; then
  tar -czf "$OUT_DIR/dosyalar-$STAMP.tar.gz" -C "$APP_DIR" .uploads
fi

# Eskileri temizle: en yeni MIN_KEEP dışındakilerden RETENTION_DAYS günden
# eski olanlar silinir.
for pattern in 'envanterim-*.db' 'dosyalar-*.tar.gz'; do
  # Eşleşen dosya yoksa (ör. henüz .uploads yok) ls hata verir; pipefail
  # yüzünden betik düşmesin diye `|| true`.
  { ls -1t "$OUT_DIR"/$pattern 2>/dev/null || true; } | tail -n +"$((MIN_KEEP + 1))" |
    while IFS= read -r old; do
      find "$old" -maxdepth 0 -mtime +"$RETENTION_DAYS" -delete
    done
done

write_status ok "Yedek alındı." "$DB_FILE" "$(stat -c %s "$OUT_DIR/$DB_FILE")"
echo "Yedek alındı: $OUT_DIR ($STAMP)"
