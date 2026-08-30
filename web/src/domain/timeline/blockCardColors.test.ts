import { describe, expect, it } from "vitest";
import {
  BLOCK_CARD_COLOR_CSS,
  BLOCK_CARD_COLOR_IDS,
  blockCardColorAttr,
  blockCardColorCss,
  isBlockCardColorId,
  parseBlockCardColorChoice,
  parseBlockCardColorMap,
  resolveBlockCardColor,
} from "./blockCardColors";

describe("blockCardColors", () => {
  it("accepts the theme palette ids and rejects free-form strings as ids", () => {
    expect(BLOCK_CARD_COLOR_IDS).toHaveLength(14);
    expect(isBlockCardColorId("sky")).toBe(true);
    expect(isBlockCardColorId("crimson")).toBe(true);
    expect(isBlockCardColorId("berry")).toBe(true);
    expect(isBlockCardColorId("accent")).toBe(false);
    expect(isBlockCardColorId("#ff0000")).toBe(false);
    expect(BLOCK_CARD_COLOR_CSS.sky).toBe("var(--info)");
  });

  it("parses a persisted map of old palette ids and drops invalid keys or colors", () => {
    expect(parseBlockCardColorMap(null)).toEqual({});
    expect(parseBlockCardColorMap(["sky"])).toEqual({});
    expect(
      parseBlockCardColorMap({
        "workset:ws-a": "teal",
        "subscribe:Alice/Work": "rose",
        "  ": "sky",
        "workset:bad": "hotpink",
        extra: 1,
      }),
    ).toEqual({
      "workset:ws-a": { kind: "preset", id: "teal" },
      "subscribe:Alice/Work": { kind: "preset", id: "rose" },
    });
  });

  it("parses tagged preset and custom hex choices, including short hex", () => {
    expect(parseBlockCardColorChoice({ kind: "preset", id: "sky" })).toEqual({
      kind: "preset",
      id: "sky",
    });
    expect(parseBlockCardColorChoice({ kind: "hex", value: "#C45C3E" })).toEqual({
      kind: "hex",
      value: "#c45c3e",
    });
    expect(parseBlockCardColorChoice({ kind: "hex", value: "#f50" })).toEqual({
      kind: "hex",
      value: "#ff5500",
    });
    expect(parseBlockCardColorChoice("#AbC")).toEqual({ kind: "hex", value: "#aabbcc" });
    expect(parseBlockCardColorChoice({ kind: "hex", value: "red" })).toBeUndefined();
    expect(parseBlockCardColorChoice({ kind: "preset", id: "hotpink" })).toBeUndefined();
  });

  it("resolves a saved color by source identity and defaults to unset", () => {
    const map = parseBlockCardColorMap({ "workset:ws-a": "sky" });
    expect(resolveBlockCardColor(map, "workset:ws-a")).toEqual({ kind: "preset", id: "sky" });
    expect(resolveBlockCardColor(map, "subscribe:Alice/Work")).toBeUndefined();
    expect(blockCardColorCss({ kind: "preset", id: "sky" })).toBe("var(--info)");
    expect(blockCardColorCss({ kind: "hex", value: "#c45c3e" })).toBe("#c45c3e");
    expect(blockCardColorAttr({ kind: "preset", id: "sky" })).toBe("sky");
    expect(blockCardColorAttr({ kind: "hex", value: "#c45c3e" })).toBe("#c45c3e");
    expect(blockCardColorCss(undefined)).toBeUndefined();
  });
});
