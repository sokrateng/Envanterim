import { describe, expect, it } from "vitest";
import {
  activeAssignment,
  assignmentState,
  canAssign,
  canRespond,
  closeText,
  eventNote,
  holderSummary,
  holderView,
  isOverdue,
  isSelf,
  pendingDays,
  stateLabel,
  type AssignmentRecord,
} from "./assignment";

const now = new Date(2026, 2, 14);

function record(over: Partial<AssignmentRecord> = {}): AssignmentRecord {
  return {
    id: "a1",
    holderUserId: "u-eylul",
    holderName: null,
    assignedAt: new Date(2026, 2, 10),
    acceptedAt: null,
    closedAt: null,
    closedReason: null,
    ...over,
  };
}

describe("assignmentState", () => {
  it("atandı, henüz alınmadı", () => {
    expect(assignmentState(record())).toBe("PENDING");
    expect(stateLabel(record())).toBe("Teslim bekliyor");
  });

  it("üzerine alındı", () => {
    expect(assignmentState(record({ acceptedAt: now }))).toBe("HELD");
  });

  it("iade, devir ve red ayrı durumlar", () => {
    expect(
      assignmentState(record({ closedAt: now, closedReason: "RETURN" })),
    ).toBe("RETURNED");
    expect(
      assignmentState(record({ closedAt: now, closedReason: "TRANSFER" })),
    ).toBe("TRANSFERRED");
    expect(
      assignmentState(record({ closedAt: now, closedReason: "DECLINE" })),
    ).toBe("DECLINED");
  });

  it("kabul edilmiş olsa da kapanmışsa kapalıdır", () => {
    expect(
      assignmentState(
        record({ acceptedAt: new Date(2026, 2, 11), closedAt: now, closedReason: "RETURN" }),
      ),
    ).toBe("RETURNED");
  });
});

describe("activeAssignment", () => {
  it("kapanmamış kaydı bulur", () => {
    const kapali = record({ id: "eski", closedAt: now, closedReason: "TRANSFER" });
    const acik = record({ id: "yeni" });
    expect(activeAssignment([kapali, acik])?.id).toBe("yeni");
  });

  it("hiç açık kayıt yoksa null", () => {
    expect(activeAssignment([record({ closedAt: now, closedReason: "RETURN" })])).toBeNull();
  });

  it("veri bozulup iki açık kayıt kalırsa en yenisini seçer", () => {
    const eski = record({ id: "eski", assignedAt: new Date(2026, 1, 1) });
    const yeni = record({ id: "yeni", assignedAt: new Date(2026, 2, 1) });
    expect(activeAssignment([yeni, eski])?.id).toBe("yeni");
  });
});

describe("holderView", () => {
  it("hesabı olan üyeyi adıyla verir", () => {
    expect(holderView(record(), "Eylül Çoban")).toEqual({
      userId: "u-eylul",
      name: "Eylül Çoban",
      hasAccount: true,
    });
  });

  it("hesapsız kişi kendi onayını veremez", () => {
    const view = holderView(record({ holderUserId: null, holderName: "Buket Çoban" }));
    expect(view).toEqual({ userId: null, name: "Buket Çoban", hasAccount: false });
  });
});

describe("pendingDays / isOverdue", () => {
  it("bekleyen gün sayısını verir", () => {
    expect(pendingDays(record(), now)).toBe(4);
  });

  it("kabul edilmişse bekleme yok", () => {
    expect(pendingDays(record({ acceptedAt: now }), now)).toBe(0);
    expect(isOverdue(record({ acceptedAt: now }), now)).toBe(false);
  });

  it("eşikten sonrası gecikmiş", () => {
    expect(isOverdue(record({ assignedAt: new Date(2026, 2, 13) }), now)).toBe(false);
    expect(isOverdue(record({ assignedAt: new Date(2026, 2, 11) }), now)).toBe(true);
  });
});

describe("canRespond", () => {
  it("kişinin kendisi kabul edebilir — görüntüleyen bile olsa", () => {
    expect(canRespond(record(), { userId: "u-eylul", role: "VIEWER" })).toBe(true);
  });

  it("düzenleyen adına teslim işaretleyebilir", () => {
    expect(canRespond(record(), { userId: "u-engin", role: "EDITOR" })).toBe(true);
  });

  it("ilgisiz görüntüleyen edemez", () => {
    expect(canRespond(record(), { userId: "u-baska", role: "VIEWER" })).toBe(false);
  });

  it("kapanmış zimmete dokunulmaz", () => {
    const kapali = record({ closedAt: now, closedReason: "RETURN" });
    expect(canRespond(kapali, { userId: "u-eylul", role: "OWNER" })).toBe(false);
  });

  it("hesapsız kişinin zimmetini yalnız düzenleyen kapatır", () => {
    const hesapsiz = record({ holderUserId: null, holderName: "Buket Çoban" });
    expect(canRespond(hesapsiz, { userId: "u-engin", role: "OWNER" })).toBe(true);
    expect(canRespond(hesapsiz, { userId: "u-eylul", role: "VIEWER" })).toBe(false);
  });
});

describe("isSelf / canAssign", () => {
  it("kendi zimmeti mi", () => {
    expect(isSelf(record(), { userId: "u-eylul", role: "VIEWER" })).toBe(true);
    expect(isSelf(record(), { userId: "u-engin", role: "OWNER" })).toBe(false);
  });

  it("zimmet vermek düzenleme yetkisi ister", () => {
    expect(canAssign({ userId: "u-engin", role: "EDITOR" })).toBe(true);
    expect(canAssign({ userId: "u-engin", role: "VIEWER" })).toBe(false);
  });
});

describe("closeText", () => {
  it("devirde iki tarafı da yazar", () => {
    expect(closeText("TRANSFER", "Eylül", "Buket")).toBe("Eylül → Buket");
  });

  it("iade ve reddi ayırır", () => {
    expect(closeText("RETURN", "Eylül")).toBe("Eylül iade etti");
    expect(closeText("DECLINE", "Eylül")).toBe("Eylül kabul etmedi");
  });
});

describe("holderSummary", () => {
  it("zimmetsiz ekipman", () => {
    expect(holderSummary(null)).toBe("Zimmetsiz");
  });

  it("bekleyen zimmeti işaretler", () => {
    expect(holderSummary(record(), "Eylül")).toBe("Eylül · bekliyor");
    expect(holderSummary(record({ acceptedAt: now }), "Eylül")).toBe("Eylül");
  });
});

describe("eventNote", () => {
  const uye = { userId: "u1", name: "Eylül", hasAccount: true };
  const hesapsiz = { userId: null, name: "Buket", hasAccount: false };

  it("üye sorumluda adı tekrar etmez — olay zaten kişiye bağlı", () => {
    expect(eventNote(uye, "Teslim alındı")).toBe("Teslim alındı");
  });

  it("hesapsız kişide adı nota yazar", () => {
    expect(eventNote(hesapsiz, "Teslim alındı")).toBe("Buket · Teslim alındı");
  });

  it("adına işaretleyeni not eder", () => {
    expect(eventNote(hesapsiz, "Teslim alındı", "Engin")).toBe(
      "Buket · Teslim alındı (Engin işaretledi)",
    );
  });
});
