import { describe, expect, it } from "vitest";
import { favoritePage } from "@/lib/favorite-page";

describe("favoritePage", () => {
  it("favori yokken hepsini kalanlardan alır", () => {
    expect(favoritePage({ offset: 0, size: 50, favoriteCount: 0 })).toEqual({
      favoriteSkip: 0,
      favoriteTake: 0,
      otherSkip: 0,
      otherTake: 50,
    });
  });

  it("ilk sayfa favorilerle başlar, kalanı doldurur", () => {
    expect(favoritePage({ offset: 0, size: 50, favoriteCount: 3 })).toEqual({
      favoriteSkip: 0,
      favoriteTake: 3,
      otherSkip: 0,
      otherTake: 47,
    });
  });

  it("favoriler sayfayı doldurunca kalanlara sıra gelmiyor", () => {
    expect(favoritePage({ offset: 0, size: 50, favoriteCount: 80 })).toEqual({
      favoriteSkip: 0,
      favoriteTake: 50,
      otherSkip: 0,
      otherTake: 0,
    });
  });

  it("sayfa sınırında liste ikiye bölünüyor", () => {
    // 60 favori var; ikinci sayfa 10 favoriyle başlayıp 40 kalanla sürüyor.
    expect(favoritePage({ offset: 50, size: 50, favoriteCount: 60 })).toEqual({
      favoriteSkip: 50,
      favoriteTake: 10,
      otherSkip: 0,
      otherTake: 40,
    });
  });

  it("favoriler bittikten sonra kalanlar kaydırılıyor", () => {
    // Üçüncü sayfa: favoriler çoktan bitti, kalanların 40'ıncısından devam.
    expect(favoritePage({ offset: 100, size: 50, favoriteCount: 60 })).toEqual({
      favoriteSkip: 60,
      favoriteTake: 0,
      otherSkip: 40,
      otherTake: 50,
    });
  });
});
