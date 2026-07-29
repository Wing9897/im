import { describe, expect, it } from "vitest";
import { countFullAccessKeys, isFullAccessKey } from "./useWebhookPanel";
import type { AccessKeyPublic } from "../../../api/accessKeys";

function key(partial: Partial<AccessKeyPublic> & { id: string }): AccessKeyPublic {
  return {
    label: "k",
    preview: "xxxx…yyyy",
    createdAt: "2026-01-01T00:00:00Z",
    scopes: ["*"],
    ...partial,
  };
}

describe("isFullAccessKey / countFullAccessKeys", () => {
  it("treats missing or empty scopes as full (*)", () => {
    expect(isFullAccessKey({ scopes: undefined as unknown as string[] })).toBe(true);
    expect(isFullAccessKey({ scopes: [] })).toBe(true);
  });

  it("counts only keys with * for webhook configured state", () => {
    const keys = [
      key({ id: "a2a", scopes: ["a2a:agent"] }),
      key({ id: "full", scopes: ["*"] }),
      key({ id: "legacy", scopes: [] }),
    ];
    expect(countFullAccessKeys(keys)).toBe(2);
    expect(countFullAccessKeys([key({ id: "only-a2a", scopes: ["a2a:agent"] })])).toBe(0);
    expect(countFullAccessKeys([])).toBe(0);
    expect(countFullAccessKeys(null)).toBe(0);
  });
});
