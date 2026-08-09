import { describe, expect, it } from "vitest";

import { prefetchRoute } from "./prefetchRoute";

describe("prefetchRoute", () => {
  it("is idempotent and ignores unknown paths", () => {
    expect(() => prefetchRoute("/no-such-route")).not.toThrow();
    expect(() => prefetchRoute("/monitor")).not.toThrow();
    expect(() => prefetchRoute("/monitor")).not.toThrow();
    expect(() => prefetchRoute("/tasks/abc/edit")).not.toThrow();
  });

  it("accepts assistant, voice, and analysis-strategy paths", () => {
    expect(() => prefetchRoute("/assistant")).not.toThrow();
    expect(() => prefetchRoute("/ai/voice")).not.toThrow();
    expect(() => prefetchRoute("/ai/analysis-strategy")).not.toThrow();
  });

  it("prefetches agent detail via /agent (not retired /project)", () => {
    expect(() => prefetchRoute("/tasks/abc/agent")).not.toThrow();
  });
});
