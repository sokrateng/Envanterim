/**
 * Giriş denemesi sınırı. Uygulama internete (Tailscale Funnel) açık olduğunda
 * şifre denemesini yavaşlatmak için.
 *
 * Sayaçlar bellekte durur: uygulama tek süreç olarak çalışıyor (Raspberry Pi,
 * systemd). Süreç yeniden başlarsa sayaçlar sıfırlanır — kilidi aşmak için
 * süreci yeniden başlatmak saldırganın elinde değil, bu yüzden kabul edilebilir.
 *
 * Süren (henüz sonuçlanmamış) denemeler de sayılıyor: bcrypt karşılaştırması
 * yüzlerce ms sürüyor, saldırgan aynı anda yüzlerce istek yollarsa hepsi
 * "kilitli değil" görüp içeri girerdi.
 */

export type FailureRule = {
  /** Pencere içinde izin verilen başarısız deneme sayısı. */
  maxFailures: number;
  /** Başarısızların sayıldığı pencere. */
  windowMs: number;
  /** Sınır aşılınca anahtarın kilitli kaldığı süre. */
  lockMs: number;
};

type Entry = { failures: number[]; lockedUntil: number };

const MAX_TRACKED_KEYS = 5000;

export function createFailureLimiter(
  rule: FailureRule,
  now: () => number = Date.now,
) {
  const entries = new Map<string, Entry>();
  const inFlight = new Map<string, number>();

  function liveFailures(entry: Entry | undefined, at: number): number {
    return entry ? entry.failures.filter((t) => at - t < rule.windowMs).length : 0;
  }

  /** Hafıza şişmesin: süresi dolmuşları, yetmezse en eskileri siler. */
  function prune(at: number) {
    if (entries.size < MAX_TRACKED_KEYS) return;
    for (const [key, entry] of entries) {
      if (liveFailures(entry, at) === 0 && entry.lockedUntil <= at) {
        entries.delete(key);
      }
    }
    // Hâlâ doluysa (adres döndüren saldırgan) en eski kayıtları at.
    for (const key of entries.keys()) {
      if (entries.size < MAX_TRACKED_KEYS) break;
      entries.delete(key);
    }
  }

  return {
    isBlocked(key: string): boolean {
      const at = now();
      const entry = entries.get(key);
      if (entry && entry.lockedUntil > at) return true;
      return liveFailures(entry, at) + (inFlight.get(key) ?? 0) >= rule.maxFailures;
    },

    /** Deneme başlıyor: sonuçlanana kadar sınıra sayılır. */
    begin(key: string): void {
      inFlight.set(key, (inFlight.get(key) ?? 0) + 1);
    },

    /** Deneme sonuçlandı (başarılı ya da başarısız). */
    end(key: string): void {
      const left = (inFlight.get(key) ?? 1) - 1;
      if (left <= 0) inFlight.delete(key);
      else inFlight.set(key, left);
    },

    recordFailure(key: string): void {
      const at = now();
      prune(at);
      const previous = entries.get(key) ?? { failures: [], lockedUntil: 0 };
      const failures = [
        ...previous.failures.filter((t) => at - t < rule.windowMs),
        at,
      ];
      const lockedUntil =
        failures.length >= rule.maxFailures ? at + rule.lockMs : previous.lockedUntil;
      entries.set(key, { failures, lockedUntil });
    },

    recordSuccess(key: string): void {
      entries.delete(key);
    },
  };
}

type HeaderBag = Record<string, string | string[] | undefined> | undefined;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * İstemci adresi. Arkada Tailscale Funnel var: bağlantı hep 127.0.0.1'den
 * geliyor, gerçek adres `X-Forwarded-For` içinde. Başlığı istemci de
 * gönderebilir; önündeki vekilin eklediği **son** değere güveniliyor, baştakiler
 * sahtelenebilir. Bu yüzden uygulama yalnız 127.0.0.1'i dinlemeli (systemd
 * servisi `-H 127.0.0.1` ile başlatıyor); yerel ağdan doğrudan erişilebilseydi
 * başlık serbestçe değiştirilip adres sınırları aşılırdı.
 */
export function clientAddress(headers: HeaderBag): string {
  const forwarded = firstValue(headers?.["x-forwarded-for"]);
  if (forwarded) {
    const last = forwarded.split(",").pop()?.trim();
    if (last) return last;
  }
  const real = firstValue(headers?.["x-real-ip"])?.trim();
  return real || "bilinmiyor";
}

// Bir kullanıcı adını başka adresten kilitlemek zor olsun diye asıl sayaç
// "kullanıcı + adres" çiftine bağlı. Adres tek başına ve kullanıcı adı tek
// başına (dağıtık denemeye karşı) gevşek üst sınırlar. Kullanıcı başına sınır
// bilerek yüksek: düşük olsa saldırgan adres döndürüp gerçek sahibi kilitlerdi.
const WINDOW = 15 * 60_000;
const perUserAndAddress = createFailureLimiter({
  maxFailures: 5,
  windowMs: WINDOW,
  lockMs: WINDOW,
});
const perAddress = createFailureLimiter({
  maxFailures: 20,
  windowMs: WINDOW,
  lockMs: WINDOW,
});
const perUser = createFailureLimiter({
  maxFailures: 100,
  windowMs: WINDOW,
  lockMs: WINDOW,
});

export type LoginAttempt = {
  /** Deneme başarısız oldu. */
  fail(): void;
  /** Deneme başarılı oldu. */
  succeed(): void;
};

export type BlockReason = "kullanici-adres" | "adres" | "kullanici";

/**
 * Hangi sınır giriş denemesini durduruyor? Kilitli değilse null. Kayıt satırında
 * "neden kilitli" görünsün diye ayrı; karar mantığı `startLoginAttempt` ile aynı.
 */
export function loginBlockReason(
  username: string,
  address: string,
): BlockReason | null {
  if (perUserAndAddress.isBlocked(`${username}|${address}`)) return "kullanici-adres";
  if (perAddress.isBlocked(address)) return "adres";
  if (perUser.isBlocked(username)) return "kullanici";
  return null;
}

/**
 * Giriş denemesi başlatır. Kilitliyse null döner. Dönen nesne **mutlaka**
 * `fail()` ya da `succeed()` ile kapatılmalı: süren deneme sınıra sayılıyor.
 */
export function startLoginAttempt(
  username: string,
  address: string,
): LoginAttempt | null {
  const pairKey = `${username}|${address}`;
  if (loginBlockReason(username, address)) return null;

  perUserAndAddress.begin(pairKey);
  perAddress.begin(address);
  perUser.begin(username);

  let finished = false;
  function finish(): boolean {
    if (finished) return false;
    finished = true;
    perUserAndAddress.end(pairKey);
    perAddress.end(address);
    perUser.end(username);
    return true;
  }

  return {
    fail() {
      if (!finish()) return;
      perUserAndAddress.recordFailure(pairKey);
      perAddress.recordFailure(address);
      perUser.recordFailure(username);
    },
    succeed() {
      if (!finish()) return;
      perUserAndAddress.recordSuccess(pairKey);
      perUser.recordSuccess(username);
    },
  };
}
