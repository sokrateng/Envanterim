import { MAX_COMPONENT_DEPTH } from "@/lib/constants";

/**
 * Alt ekipman (bileşen) kuralları — saf ve testli.
 *
 * Alt ekipman tam bir ekipmandır: kendi garantisi, faturası, QR'ı ve maliyeti
 * olur. Ana ekipmana bağlanması yalnız "bunlar birlikte gezer" demek —
 * iPhone'un Claude aboneliği, bilgisayarın klavyesi. Bu yüzden ayrı bir tablo
 * değil, `Item.parentId`.
 */

export type Node = { id: string; parentId: string | null; locationId: string };

export type LinkProblem =
  | "self"
  | "cycle"
  | "depth"
  | "other-location"
  | "already-child";

export const LINK_PROBLEM_TEXT: Record<LinkProblem, string> = {
  self: "Ekipman kendi bileşeni olamaz",
  cycle: "Bu ekipman zaten seçilenin üstünde",
  depth: `Bileşen zinciri en çok ${MAX_COMPONENT_DEPTH} kademe olabilir`,
  "other-location": "Bileşen ana ekipmanla aynı lokasyonda olmalı",
  "already-child": "Bu ekipman başka bir ekipmanın bileşeni",
};

function ancestors(nodes: Map<string, Node>, startId: string): string[] {
  const chain: string[] = [];
  let current = nodes.get(startId)?.parentId ?? null;

  // Veri bozulsa bile sonsuz döngüye girme.
  while (current && chain.length <= MAX_COMPONENT_DEPTH + 2) {
    chain.push(current);
    current = nodes.get(current)?.parentId ?? null;
  }
  return chain;
}

/** Bir ekipmanın altındaki en derin zincirin kademe sayısı (kendisi dahil). */
export function subtreeDepth(nodes: Node[], rootId: string): number {
  const children = new Map<string, string[]>();
  for (const node of nodes) {
    if (!node.parentId) continue;
    const list = children.get(node.parentId) ?? [];
    list.push(node.id);
    children.set(node.parentId, list);
  }

  // Görülen düğüm ikinci kez açılmıyor: bozuk veri sonsuz özyineleme yapmasın.
  const seen = new Set<string>();
  const walk = (id: string): number => {
    if (seen.has(id)) return 1;
    seen.add(id);

    const kids = children.get(id) ?? [];
    if (!kids.length) return 1;
    return 1 + Math.max(...kids.map(walk));
  };

  return walk(rootId);
}

function nodeMap(all: Node[]): Map<string, Node> {
  return new Map(all.map((node) => [node.id, node]));
}

/**
 * Hazır haritayla tek bağ denetimi.
 *
 * Harita dışarıda kuruluyor: liste üretenler (aşağıdaki iki işlev) her aday
 * için baştan kurunca lokasyondaki ekipman sayısının küpüyle büyüyen bir iş
 * çıkıyordu — 287 ekipmanlı bir lokasyonda ekipman sayfası dört saniye
 * bekletiyordu (TUZAKLAR #72).
 */
function linkProblem(
  all: Node[],
  nodes: Map<string, Node>,
  childId: string,
  parentId: string,
): LinkProblem | null {
  if (childId === parentId) return "self";

  const child = nodes.get(childId);
  const parent = nodes.get(parentId);
  if (!child || !parent) return "self";

  if (child.locationId !== parent.locationId) return "other-location";
  if (child.parentId && child.parentId !== parentId) return "already-child";

  const ustundekiler = ancestors(nodes, parentId);
  // Ana ekipman, bağlanacak ekipmanın altındaysa çember oluşur.
  if (ustundekiler.includes(childId)) return "cycle";

  // Üstteki kademe sayısı + bağlanacak alt ağacın derinliği sınırı aşmasın.
  if (ustundekiler.length + 1 + subtreeDepth(all, childId) > MAX_COMPONENT_DEPTH) {
    return "depth";
  }

  return null;
}

/**
 * `child` ekipmanı `parent`ın bileşeni yapılabilir mi?
 * Döngü, derinlik, lokasyon ve "zaten bağlı" durumlarına bakar.
 */
export function checkLink(
  all: Node[],
  childId: string,
  parentId: string,
): LinkProblem | null {
  return linkProblem(all, nodeMap(all), childId, parentId);
}

/** Ana ekipman seçenekleri: bu ekipmanın bağlanabileceği ekipmanlar. */
export function linkableParents<T extends Node & { name: string }>(
  all: T[],
  childId: string,
): T[] {
  const nodes = nodeMap(all);
  return all.filter(
    (candidate) => linkProblem(all, nodes, childId, candidate.id) === null,
  );
}

/** Bileşen seçenekleri: bu ekipmanın altına bağlanabilecek ekipmanlar. */
export function linkableChildren<T extends Node & { name: string }>(
  all: T[],
  parentId: string,
): T[] {
  const nodes = nodeMap(all);
  return all.filter(
    (candidate) => linkProblem(all, nodes, candidate.id, parentId) === null,
  );
}

/**
 * Bileşenlerle birlikte sahip olma maliyeti. Lokasyon toplamı her ekipmanı
 * kendi satırında bir kez sayıyor; bu toplam yalnız ekipman sayfasında
 * "yanındakilerle birlikte ne tuttu" sorusuna cevap veriyor.
 */
export function totalWithComponents(
  own: number,
  componentCosts: number[],
): number {
  return componentCosts.reduce((sum, cost) => sum + cost, own);
}
