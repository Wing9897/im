import { describe, expect, it } from "vitest";
import { resolveItemCardExpiry, itemCardExpirySubtitle, itemExpiryBadgeLabel } from "./itemCardExpiry";

function isoDaysFrom(base: Date, days: number): string {
  const d = new Date(base);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

describe("resolveItemCardExpiry", () => {
  const today = new Date(2026, 7, 7); // 2026-08-07 local

  it("returns no expiry when expiresAt is null/empty (no linked到期 cache)", () => {
    expect(resolveItemCardExpiry({ expiresAt: null, remindBeforeDays: 3 }, today)).toEqual({
      expiresAt: null,
      days: null,
      tone: "none",
    });
    expect(resolveItemCardExpiry({ expiresAt: "  ", remindBeforeDays: 3 }, today)).toEqual({
      expiresAt: null,
      days: null,
      tone: "none",
    });
  });

  it("derives overdue badge from expiresAt", () => {
    const expiresAt = isoDaysFrom(today, -6);
    expect(
      resolveItemCardExpiry({ expiresAt, remindBeforeDays: 2 }, today),
    ).toEqual({
      expiresAt,
      days: -6,
      tone: "overdue",
    });
  });

  it("uses remindBeforeDays for soon window", () => {
    const expiresAt = isoDaysFrom(today, 2);
    expect(
      resolveItemCardExpiry({ expiresAt, remindBeforeDays: 3 }, today),
    ).toEqual({
      expiresAt,
      days: 2,
      tone: "soon",
    });
    expect(
      resolveItemCardExpiry({ expiresAt, remindBeforeDays: null }, today),
    ).toEqual({
      expiresAt,
      days: 2,
      tone: "ok",
    });
  });
});

describe("itemExpiryBadgeLabel", () => {
  const t = (key: string, opts?: Record<string, unknown>) => {
    if (key === "daysLeft") return `${opts?.count ?? 0}d left`;
    if (key === "daysOverdue") return `${opts?.count ?? 0}d overdue`;
    if (key === "expiringSoon") return "Expiring soon";
    return key;
  };

  it("uses expiringSoon label inside remind window", () => {
    const today = new Date(2026, 7, 7);
    const expiry = resolveItemCardExpiry(
      { expiresAt: "2026-08-09", remindBeforeDays: 3 },
      today,
    );
    expect(itemExpiryBadgeLabel(expiry, t)).toBe("Expiring soon");
  });
});

describe("itemCardExpirySubtitle", () => {
  const t = (key: string, opts?: Record<string, unknown>) => {
    if (key === "noExpiry") return "No expiry";
    if (key === "linkedExpiryOn") return `Expires ${opts?.date ?? ""}`;
    return key;
  };

  it("prefixes linked expiry dates and falls back to no-expiry copy", () => {
    const today = new Date(2026, 7, 7);
    const none = resolveItemCardExpiry({ expiresAt: null, remindBeforeDays: 3 }, today);
    expect(itemCardExpirySubtitle(none, t)).toBe("No expiry");

    const linked = resolveItemCardExpiry(
      { expiresAt: "2026-08-01", remindBeforeDays: 3 },
      today,
    );
    expect(itemCardExpirySubtitle(linked, t)).toBe("Expires 2026-08-01");
  });
});
