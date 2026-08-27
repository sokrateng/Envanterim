import { addMonths } from "@/lib/dates";
import { daysBetween } from "@/lib/warranty";
import type { TimelineEvent } from "@/lib/events";

/**
 * Tekrarlayan bakım kuralı — saf ve testli.
 *
 * Garanti bitimi tek seferlik; oysa "6 ayda bir klima bakımı" ve "her
 * 10.000 km'de servis" sürekli (docs/URUN.md). İki tür kural var: zamana
 * bağlı ve sayaca bağlı. Sayaç okuması zaten zaman çizelgesinde duruyor,
 * kural son okumaya bakıyor (docs/MIMARI.md §3).
 *
 * Hiçbir türetilmiş değer saklanmıyor: son bakım tarihi de son okuma da
 * kayıtlardan hesaplanıyor.
 */

export type MaintenanceRule = {
  id: string;
  name: string;
  everyMonths: number | null;
  everyReading: number | null;
  readingUnit: string | null;
  leadDays: number;
};

export type RuleState = "due" | "soon" | "ok" | "unknown";

export type TimeBasedStatus = {
  kind: "time";
  state: RuleState;
  dueDate: Date | null;
  daysLeft: number | null;
  since: Date | null;
};

export type ReadingBasedStatus = {
  kind: "reading";
  state: RuleState;
  remaining: number | null;
  dueAt: number | null;
  cycle: number | null;
  latest: number | null;
};

export type RuleStatus = TimeBasedStatus | ReadingBasedStatus;

type Event = Pick<TimelineEvent, "kind" | "date" | "readingValue">;

/** Son servis tarihi; hiç servis yoksa null. */
export function lastServiceDate(events: Event[]): Date | null {
  const services = events
    .filter((event) => event.kind === "SERVICE")
    .sort((a, b) => b.date.getTime() - a.date.getTime());
  return services[0]?.date ?? null;
}

/**
 * Kuralın saydığı başlangıç okuması: son servis anındaki sayaç. O tarihte ya
 * da öncesinde yapılmış en yeni okuma alınır; servis yoksa en eski okuma —
 * kural ilk günden itibaren sayıyor demektir.
 */
export function baseReading(events: Event[]): number | null {
  const readings = events
    .filter((event) => event.kind === "READING" && event.readingValue != null)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  if (readings.length === 0) return null;

  const service = lastServiceDate(events);
  if (!service) return readings[0].readingValue ?? null;

  const beforeService = readings.filter(
    (reading) => reading.date.getTime() <= service.getTime(),
  );
  const chosen = beforeService.at(-1) ?? readings[0];
  return chosen.readingValue ?? null;
}

/** En yeni sayaç okuması. */
export function latestReadingValue(events: Event[]): number | null {
  const readings = events
    .filter((event) => event.kind === "READING" && event.readingValue != null)
    .sort((a, b) => b.date.getTime() - a.date.getTime());
  return readings[0]?.readingValue ?? null;
}

export function timeStatus(
  rule: MaintenanceRule,
  options: { events: Event[]; purchaseDate: Date | null; now?: Date },
): TimeBasedStatus {
  const now = options.now ?? new Date();
  const since = lastServiceDate(options.events) ?? options.purchaseDate;

  if (!rule.everyMonths || !since) {
    return { kind: "time", state: "unknown", dueDate: null, daysLeft: null, since };
  }

  const dueDate = addMonths(since, rule.everyMonths);
  const daysLeft = daysBetween(now, dueDate);

  return {
    kind: "time",
    state: daysLeft <= 0 ? "due" : daysLeft <= rule.leadDays ? "soon" : "ok",
    dueDate,
    daysLeft,
    since,
  };
}

export function readingStatus(
  rule: MaintenanceRule,
  options: { events: Event[]; soonRatio?: number },
): ReadingBasedStatus {
  const soonRatio = options.soonRatio ?? 0.1;
  const base = baseReading(options.events);
  const latest = latestReadingValue(options.events);

  if (!rule.everyReading || rule.everyReading <= 0 || base === null || latest === null) {
    return { kind: "reading", state: "unknown", remaining: null, dueAt: null, cycle: null, latest };
  }

  const dueAt = base + rule.everyReading;
  const remaining = Math.round((dueAt - latest) * 100) / 100;
  // Kaç kuralı geçtiğimiz: bildirim aynı tur için iki kez gitmesin diye
  // kullanılıyor.
  const cycle = Math.floor((latest - base) / rule.everyReading);

  return {
    kind: "reading",
    state:
      remaining <= 0
        ? "due"
        : remaining <= rule.everyReading * soonRatio
          ? "soon"
          : "ok",
    remaining,
    dueAt,
    cycle,
    latest,
  };
}

export function ruleStatus(
  rule: MaintenanceRule,
  options: { events: Event[]; purchaseDate: Date | null; now?: Date },
): RuleStatus {
  // Sayaç kuralı varsa o önceliklidir: "her 10.000 km" zamanı da kapsıyor.
  return rule.everyReading
    ? readingStatus(rule, { events: options.events })
    : timeStatus(rule, options);
}

/** Arayüz ve bildirim metni. */
export function statusText(rule: MaintenanceRule, status: RuleStatus): string {
  if (status.kind === "time") {
    if (status.state === "unknown") {
      return "Başlangıç tarihi yok: bir servis kaydı ya da alış tarihi gerekiyor";
    }
    if (status.daysLeft === null) return "";
    if (status.daysLeft < 0) return `${Math.abs(status.daysLeft)} gün gecikti`;
    if (status.daysLeft === 0) return "Bugün yapılmalı";
    return `${status.daysLeft} gün kaldı`;
  }

  if (status.state === "unknown") {
    return "Sayaç okuması yok: zaman çizelgesine okuma ekle";
  }
  const unit = rule.readingUnit ? ` ${rule.readingUnit}` : "";
  if (status.remaining === null) return "";
  if (status.remaining <= 0) {
    return `${Math.abs(status.remaining).toLocaleString("tr-TR")}${unit} geçildi`;
  }
  return `${status.remaining.toLocaleString("tr-TR")}${unit} kaldı`;
}

export function maintenancePushBody(
  itemName: string,
  rule: MaintenanceRule,
  status: RuleStatus,
): string {
  return `${itemName}: ${rule.name} — ${statusText(rule, status).toLocaleLowerCase("tr")}.`;
}
