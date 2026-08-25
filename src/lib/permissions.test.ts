import { describe, expect, it } from "vitest";
import {
  canChangeRole,
  canEdit,
  canManageCategories,
  canManageMembers,
  canRemoveMember,
  canView,
} from "./permissions";

const owner = { role: "OWNER" } as const;
const editor = { role: "EDITOR" } as const;
const viewer = { role: "VIEWER" } as const;

describe("canView", () => {
  it("üye olmayan göremez", () => {
    expect(canView(null)).toBe(false);
    expect(canView(undefined)).toBe(false);
  });

  it("her rol görür", () => {
    expect(canView(owner)).toBe(true);
    expect(canView(editor)).toBe(true);
    expect(canView(viewer)).toBe(true);
  });
});

describe("canEdit", () => {
  it("sahip ve düzenleyen ekler", () => {
    expect(canEdit(owner)).toBe(true);
    expect(canEdit(editor)).toBe(true);
  });

  it("görüntüleyen ve üye olmayan ekleyemez", () => {
    expect(canEdit(viewer)).toBe(false);
    expect(canEdit(null)).toBe(false);
  });
});

describe("canManageMembers / canManageCategories", () => {
  it("yalnız sahip yönetir", () => {
    expect(canManageMembers(owner)).toBe(true);
    expect(canManageMembers(editor)).toBe(false);
    expect(canManageCategories(owner)).toBe(true);
    expect(canManageCategories(viewer)).toBe(false);
  });
});

describe("canChangeRole", () => {
  it("sahip olmayan rol değiştiremez", () => {
    expect(
      canChangeRole(editor, { role: "VIEWER", userId: "u2" }, "EDITOR", 1),
    ).toBe(false);
  });

  it("son sahibi indiremez", () => {
    expect(
      canChangeRole(owner, { role: "OWNER", userId: "u1" }, "EDITOR", 1),
    ).toBe(false);
  });

  it("ikinci sahip varsa indirebilir", () => {
    expect(
      canChangeRole(owner, { role: "OWNER", userId: "u1" }, "EDITOR", 2),
    ).toBe(true);
  });

  it("düzenleyeni yükseltebilir", () => {
    expect(
      canChangeRole(owner, { role: "EDITOR", userId: "u2" }, "OWNER", 1),
    ).toBe(true);
  });
});

describe("canRemoveMember", () => {
  it("son sahibi çıkaramaz", () => {
    expect(canRemoveMember(owner, { role: "OWNER" }, 1)).toBe(false);
    expect(canRemoveMember(owner, { role: "OWNER" }, 2)).toBe(true);
  });

  it("sahip olmayan kimseyi çıkaramaz", () => {
    expect(canRemoveMember(editor, { role: "VIEWER" }, 1)).toBe(false);
  });
});
