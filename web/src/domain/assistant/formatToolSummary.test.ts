import { describe, expect, it } from "vitest";
import i18n from "../../i18n";
import { formatToolResultSummary, localizeToolName } from "./formatToolSummary";

const tHant = i18n.getFixedT("zh-Hant", "assistant");
const tEn = i18n.getFixedT("en", "assistant");

describe("localizeToolName", () => {
  it("maps calendar.upcoming in zh-Hant", () => {
    expect(localizeToolName("calendar.upcoming", tHant)).toBe("查近日日程");
  });

  it("falls back to the wire name when unmapped", () => {
    expect(localizeToolName("custom.unknown", tHant)).toBe("custom.unknown");
  });
});

describe("formatToolResultSummary", () => {
  it("maps 3 items to 3 項 and strips a name prefix", () => {
    expect(formatToolResultSummary("calendar.upcoming", "3 items", tHant)).toBe("3 項");
    expect(formatToolResultSummary("calendar.upcoming", "calendar.upcoming: 2 items", tHant)).toBe(
      "2 項",
    );
  });

  it("maps ok and event-in-window copy", () => {
    expect(formatToolResultSummary("calendar.window", "ok", tHant)).toBe("完成");
    expect(formatToolResultSummary("calendar.window", "1 event in window", tHant)).toBe(
      "時段內 1 件",
    );
  });

  it("keeps English counts human in en locale", () => {
    expect(formatToolResultSummary("web.search", "3 items", tEn)).toBe("3 items");
    expect(localizeToolName("web.search", tEn)).toBe("Web search");
  });

  it("leaves unrecognized summaries intact after stripping the name prefix", () => {
    expect(formatToolResultSummary("web.search", "web.search: mystery payload", tHant)).toBe(
      "mystery payload",
    );
  });
});
