import { describe, expect, it } from "vitest";

import { readWorksetCoverPick, resetWorksetCoverFileInput } from "./worksetCover";

describe("worksetCover file input helpers", () => {
  it("readWorksetCoverPick returns the first file or null when empty", () => {
    const file = new File(["x"], "cover.png", { type: "image/png" });
    const list = {
      0: file,
      length: 1,
      item: (index: number) => (index === 0 ? file : null),
    } as FileList;

    expect(readWorksetCoverPick(list)).toBe(file);
    expect(readWorksetCoverPick({ length: 0, item: () => null } as FileList)).toBeNull();
    expect(readWorksetCoverPick(null)).toBeNull();
  });

  it("resetWorksetCoverFileInput clears the native value", () => {
    const input = document.createElement("input");
    input.type = "file";
    resetWorksetCoverFileInput(input);
    expect(input.value).toBe("");
  });
});
