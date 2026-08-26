import { formatMoney, sumMinor } from "@/lib/money";
import type { EventKind } from "@/lib/constants";

/**
 * Ürün zaman çizelgesi. Dört olay türü de aynı tabloda (MIMARI §3): bir
 * tarihte olan, ekipmana bağlı bir kayıt. Buradaki her şey saf ve testli;
 * veritabanına dokunan yok.
 */

export const EVENT_KIND_LABELS: Record<EventKind, string> = {
  SERVICE: "Servis",
  READING: "Sayaç",
  LOG: "Günlük",
  ASSIGNMENT: "Zimmet",
};

export type TimelineEvent = {
  id: string;
  kind: EventKind;
  date: Date;
  note: string | null;
  costMinor: number | null;
  readingValue: number | null;
  readingUnit: string | null;
  vendorName: string | null;
  assignedToName: string | null;
  assignedPlace: string | null;
};

/** Satırın altındaki tek satırlık özet. Boş alanlar sessizce atlanır. */
export function eventSummary(event: TimelineEvent, currency = "TRY"): string {
  const parts: string[] = [];

  switch (event.kind) {
    case "SERVICE":
      if (event.vendorName) parts.push(event.vendorName);
      if (event.costMinor != null) parts.push(formatMoney(event.costMinor, currency));
      break;
    case "READING":
      if (event.readingValue != null) {
        parts.push(
          `${event.readingValue.toLocaleString("tr-TR")}${
            event.readingUnit ? ` ${event.readingUnit}` : ""
          }`,
        );
      }
      break;
    case "ASSIGNMENT":
      if (event.assignedToName) parts.push(event.assignedToName);
      if (event.assignedPlace) parts.push(event.assignedPlace);
      break;
    case "LOG":
      break;
  }

  if (event.note) parts.push(event.note);
  return parts.join(" · ");
}

/**
 * Sahip olma maliyeti: alış + servis (+ yedek parça, listesi geldiğinde).
 * Türetilmiş değer saklanmaz, hesaplanır (CLAUDE.md).
 */
export function ownershipCostMinor(
  purchasePriceMinor: number | null | undefined,
  events: Array<Pick<TimelineEvent, "kind" | "costMinor">>,
  partsMinor: Array<number | null | undefined> = [],
): number {
  const service = events
    .filter((event) => event.kind === "SERVICE")
    .map((event) => event.costMinor);

  return sumMinor([purchasePriceMinor, ...service, ...partsMinor]);
}

/** Son sayaç okuması — bakım kuralı buna bakacak (MIMARI §3). */
export function latestReading(
  events: TimelineEvent[],
): { value: number; unit: string | null; date: Date } | null {
  const readings = events
    .filter((event) => event.kind === "READING" && event.readingValue != null)
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  const last = readings[0];
  if (!last || last.readingValue == null) return null;
  return { value: last.readingValue, unit: last.readingUnit, date: last.date };
}

/** Zaman çizelgesi: en yeni üstte, aynı gün içinde eklenme sırası korunur. */
export function sortTimeline(events: TimelineEvent[]): TimelineEvent[] {
  return [...events].sort((a, b) => b.date.getTime() - a.date.getTime());
}

export function filterByKind(
  events: TimelineEvent[],
  kind: EventKind | null,
): TimelineEvent[] {
  return kind ? events.filter((event) => event.kind === kind) : events;
}

/** Türe göre sayım — filtre çubuğunda rozet olarak gösteriliyor. */
export function countByKind(events: TimelineEvent[]): Record<EventKind, number> {
  const counts: Record<EventKind, number> = {
    SERVICE: 0,
    READING: 0,
    LOG: 0,
    ASSIGNMENT: 0,
  };
  for (const event of events) counts[event.kind] += 1;
  return counts;
}
