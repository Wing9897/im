import { describe, expect, it, vi, beforeEach } from "vitest";
import { coalesceAsync } from "./coalesceAsync";
import { resetCoalesceAsyncForTests } from "./coalesceAsync.testing";
describe("coalesceAsync", () => {
  beforeEach(() => {
    resetCoalesceAsyncForTests();
  });

  it("shares one in-flight promise for the same key", async () => {
    let resolve!: (value: string) => void;
    const factory = vi.fn(
      () =>
        new Promise<string>((res) => {
          resolve = res;
        }),
    );

    const a = coalesceAsync("k", factory);
    const b = coalesceAsync("k", factory);
    expect(factory).toHaveBeenCalledTimes(1);

    resolve("ok");
    await expect(a).resolves.toBe("ok");
    await expect(b).resolves.toBe("ok");
  });

  it("allows a new call after the previous promise settles", async () => {
    const factory = vi.fn(async () => "v");
    await coalesceAsync("k", factory);
    await coalesceAsync("k", factory);
    expect(factory).toHaveBeenCalledTimes(2);
  });
});
