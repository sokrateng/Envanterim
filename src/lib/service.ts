import { sumMinor } from "@/lib/money";

/**
 * Yetkili servis kaydı — saf ve testli.
 *
 * Zaman çizelgesindeki olay tek bir ana ait; servis ise süren bir iş:
 * gönderildi → bekliyor → döndü. Ücret bu kayıtta duruyor ve sahip olma
 * maliyetine buradan giriyor; aynı gideri iki yere yazmıyoruz.
 */

export type ServiceJob = {
  sentAt: Date;
  returnedAt: Date | null;
  costMinor: number | null;
  paid: boolean;
  underWarranty: boolean;
};

export type ServiceState = "open" | "closed";

export function serviceState(job: Pick<ServiceJob, "returnedAt">): ServiceState {
  return job.returnedAt === null ? "open" : "closed";
}

/** Serviste geçen gün. Açık işte bugüne, kapalıda dönüş gününe kadar. */
export function daysAtService(
  job: Pick<ServiceJob, "sentAt" | "returnedAt">,
  now: Date = new Date(),
): number {
  const end = job.returnedAt ?? now;
  const ms = end.getTime() - job.sentAt.getTime();
  if (ms <= 0) return 0;
  return Math.floor(ms / 86_400_000);
}

/** Durum rozetinin metni: kaç gündür serviste, ne zaman döndü. */
export function serviceLabel(
  job: Pick<ServiceJob, "sentAt" | "returnedAt">,
  now: Date = new Date(),
): string {
  const days = daysAtService(job, now);
  if (serviceState(job) === "open") {
    return days === 0 ? "Bugün gönderildi" : `${days} gündür serviste`;
  }
  return days === 0 ? "Aynı gün döndü" : `${days} günde döndü`;
}

/**
 * Ödeme durumu. Garanti kapsamındaki iş için ücret sorusu sorulmuyor:
 * "ödenmedi" demek yanlış bir borç izlenimi bırakırdı.
 */
export function paymentLabel(
  job: Pick<ServiceJob, "returnedAt" | "costMinor" | "paid" | "underWarranty">,
): string | null {
  if (job.underWarranty) return "Garanti kapsamında";
  if (job.costMinor == null) return job.returnedAt ? "Ücret girilmedi" : null;
  return job.paid ? "Ödendi" : "Ödenmedi";
}

/** Sahip olma maliyetine giren servis ücretleri: garanti kapsamındakiler hariç. */
export function serviceCostMinor(
  jobs: Array<Pick<ServiceJob, "costMinor" | "underWarranty">>,
): number {
  return sumMinor(
    jobs.filter((job) => !job.underWarranty).map((job) => job.costMinor),
  );
}

/** Açık servis işi var mı: ekipmanın durumu buna bağlı. */
export function hasOpenJob(jobs: Array<Pick<ServiceJob, "returnedAt">>): boolean {
  return jobs.some((job) => serviceState(job) === "open");
}

/**
 * Servis kapanınca ekipman hangi duruma dönmeli.
 *
 * Emekli ya da satılmış ekipman kullanıma dönmüyor: onu yaşam döngüsünden
 * çıkaran karar servis kaydından daha yeni ve daha bilinçli.
 */
export function statusAfterService(
  current: string,
  jobs: Array<Pick<ServiceJob, "returnedAt">>,
): string {
  if (current === "RETIRED" || current === "SOLD") return current;
  return hasOpenJob(jobs) ? "IN_REPAIR" : "IN_USE";
}
