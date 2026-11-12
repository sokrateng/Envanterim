#!/usr/bin/env bash
# SQLite dosyasının tutarlı bir kopyasını ~/envanterim-yedek/ içine alır ve
# yüklenen dosyaları (.uploads) arşivler. Yazma sürerken düz `cp` bozuk dosya
# verebilir; bu yüzden SQLite'ın kendi yedekleme API'si (Python) kullanılıyor.
set -euo pipefail

APP_DIR="${APP_DIR:-/home/enginc/envanterim}"
OUT_DIR="${OUT_DIR:-/home/enginc/envanterim-yedek}"
KEEP="${KEEP:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$OUT_DIR"
python3 - "$APP_DIR/data/envanterim.db" "$OUT_DIR/envanterim-$STAMP.db" <<'PY'
import sqlite3, sys
src, dst = sys.argv[1], sys.argv[2]
with sqlite3.connect(f"file:{src}?mode=ro", uri=True) as a, sqlite3.connect(dst) as b:
    a.backup(b)
PY

if [ -d "$APP_DIR/.uploads" ]; then
  tar -czf "$OUT_DIR/dosyalar-$STAMP.tar.gz" -C "$APP_DIR" .uploads
fi

# Eskileri temizle: son $KEEP yedek kalsın.
for pattern in 'envanterim-*.db' 'dosyalar-*.tar.gz'; do
  ls -1t "$OUT_DIR"/$pattern 2>/dev/null | tail -n +"$((KEEP + 1))" | xargs -r rm -f
done
echo "Yedek alındı: $OUT_DIR ($STAMP)"
