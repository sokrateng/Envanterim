import { describe, expect, it } from "vitest";
import {
  checkLink,
  linkableChildren,
  linkableParents,
  subtreeDepth,
  totalWithComponents,
  type Node,
} from "./components";

const EV = "l-ev";
const OFIS = "l-ofis";

/** iPhone → Claude aboneliği; bilgisayar ayrı. */
const nodes: Array<Node & { name: string }> = [
  { id: "iphone", parentId: null, locationId: EV, name: "iPhone 14" },
  { id: "claude", parentId: "iphone", locationId: EV, name: "Claude aboneliği" },
  { id: "pc", parentId: null, locationId: EV, name: "Masaüstü PC" },
  { id: "klavye", parentId: null, locationId: EV, name: "Klavye" },
  { id: "yazici", parentId: null, locationId: OFIS, name: "Yazıcı" },
];

describe("checkLink", () => {
  it("serbest ekipman ana ekipmana bağlanır", () => {
    expect(checkLink(nodes, "klavye", "pc")).toBeNull();
  });

  it("ekipman kendi bileşeni olamaz", () => {
    expect(checkLink(nodes, "pc", "pc")).toBe("self");
  });

  it("çember kurulamaz", () => {
    expect(checkLink(nodes, "iphone", "claude")).toBe("cycle");
  });

  it("başka lokasyonun ekipmanı bağlanamaz", () => {
    expect(checkLink(nodes, "yazici", "pc")).toBe("other-location");
  });

  it("zaten başka ana ekipmanın bileşeni olan bağlanamaz", () => {
    expect(checkLink(nodes, "claude", "pc")).toBe("already-child");
  });

  it("aynı ana ekipmana yeniden bağlamak sorun değil", () => {
    expect(checkLink(nodes, "claude", "iphone")).toBeNull();
  });

  it("üç kademeyi aşan zincir kurulamaz", () => {
    const derin: Node[] = [
      { id: "a", parentId: null, locationId: EV },
      { id: "b", parentId: "a", locationId: EV },
      { id: "c", parentId: "b", locationId: EV },
      { id: "d", parentId: null, locationId: EV },
    ];
    // a → b → c zaten üç kademe; d dördüncü olurdu.
    expect(checkLink(derin, "d", "c")).toBe("depth");
    expect(checkLink(derin, "d", "b")).toBeNull();
  });

  it("bağlanacak ekipmanın kendi bileşenleri de derinliğe sayılır", () => {
    const agac: Node[] = [
      { id: "ana", parentId: null, locationId: EV },
      { id: "alt", parentId: null, locationId: EV },
      { id: "altin-alti", parentId: "alt", locationId: EV },
      { id: "en-alt", parentId: "altin-alti", locationId: EV },
    ];
    expect(checkLink(agac, "alt", "ana")).toBe("depth");
  });
});

describe("subtreeDepth", () => {
  it("yaprak bir kademe", () => {
    expect(subtreeDepth(nodes, "klavye")).toBe(1);
  });

  it("bileşeni olan iki kademe", () => {
    expect(subtreeDepth(nodes, "iphone")).toBe(2);
  });

  it("bozuk veride çemberde takılmaz", () => {
    const bozuk: Node[] = [
      { id: "x", parentId: "y", locationId: EV },
      { id: "y", parentId: "x", locationId: EV },
    ];
    expect(subtreeDepth(bozuk, "x")).toBeLessThanOrEqual(3);
  });
});

describe("linkableParents", () => {
  it("kendini, bileşenini ve başka lokasyonu elemez listeye koymaz", () => {
    const secenekler = linkableParents(nodes, "klavye").map((node) => node.id);
    expect(secenekler).toContain("pc");
    expect(secenekler).toContain("iphone");
    expect(secenekler).not.toContain("klavye");
    expect(secenekler).not.toContain("yazici");
  });
});

describe("totalWithComponents", () => {
  it("bileşen maliyetlerini ana ekipmanın üstüne ekler", () => {
    expect(totalWithComponents(100_00, [20_00, 5_00])).toBe(125_00);
  });

  it("bileşeni yoksa kendi maliyeti", () => {
    expect(totalWithComponents(100_00, [])).toBe(100_00);
  });
});

describe("linkableChildren", () => {
  const dugumler = [
    { id: "ana", parentId: null, locationId: "ev", name: "Bilgisayar" },
    { id: "alt", parentId: null, locationId: "ev", name: "Klavye" },
    { id: "bagli", parentId: "ana", locationId: "ev", name: "Fare" },
    { id: "uzak", parentId: null, locationId: "ofis", name: "Yazıcı" },
  ];

  it("bağlanabilecek ekipmanları verir", () => {
    const secenekler = linkableChildren(dugumler, "ana").map((n) => n.id);
    expect(secenekler).toContain("alt");
    // Kendisi, başkasına bağlı olan ve başka lokasyondaki yok.
    expect(secenekler).not.toContain("ana");
    expect(secenekler).not.toContain("uzak");
  });

  it("linkableParents'ın tersi: aynı çifte aynı cevabı verir", () => {
    // "alt", "ana"nın altına girebiliyorsa "ana" da "alt"ın seçeneklerinde.
    const cocuklar = linkableChildren(dugumler, "ana").map((n) => n.id);
    const ebeveynler = linkableParents(dugumler, "alt").map((n) => n.id);
    expect(cocuklar.includes("alt")).toBe(ebeveynler.includes("ana"));
  });

  it("büyük lokasyonda makul sürede bitiyor", () => {
    // Küpsel işten sonra 300 ekipman saniyeler sürüyordu (TUZAKLAR #72).
    const cok = Array.from({ length: 300 }, (_, i) => ({
      id: `i${i}`,
      parentId: null,
      locationId: "ev",
      name: `Ekipman ${i}`,
    }));
    const bas = performance.now();
    expect(linkableChildren(cok, "i0").length).toBe(299);
    expect(performance.now() - bas).toBeLessThan(1000);
  });
});
