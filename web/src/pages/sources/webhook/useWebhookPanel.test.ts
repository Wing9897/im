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
  it("treats missing or empty scopes as not full", () => {
    expect(isFullAccessKey({ scopes: undefined as unknown as string[] })).toBe(false);
    expect(isFullAccessKey({ scopes: [] })).toBe(false);
  });

  it("counts only keys with * for webhook configured state", () => {
    const keys = [
      key({ id: "read", scopes: ["read"] }),
      key({ id: "full", scopes: ["*"] }),
      key({ id: "legacy", scopes: [] }),
    ];
    expect(countFullAccessKeys(keys)).toBe(1);
    expect(countFullAccessKeys([key({ id: "only-read", scopes: ["read"] })])).toBe(0);
    expect(countFullAccessKeys([])).toBe(0);
    expect(countFullAccessKeys(null)).toBe(0);
  });
});
