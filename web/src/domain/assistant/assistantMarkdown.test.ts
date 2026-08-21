import { describe, expect, it } from "vitest";
import { parseAssistantMarkdown, plainTextForSpeech } from "./assistantMarkdown";

describe("plainTextForSpeech", () => {
  it("strips emphasis markers so **星期六** is not spoken with stars", () => {
    const spoken = plainTextForSpeech("**星期六**");
    expect(spoken).toBe("星期六");
    expect(spoken).not.toContain("*");
  });

  it("turns headings and lists into short pauses", () => {
    const spoken = plainTextForSpeech("# 標題\n- 蘋果\n- 香蕉");
    expect(spoken).not.toContain("#");
    expect(spoken).not.toContain("*");
    expect(spoken).toContain("標題");
    expect(spoken).toContain("蘋果、香蕉");
  });

  it("reads link labels instead of markdown URLs", () => {
    expect(plainTextForSpeech("請看 [日曆](https://example.com)")).toBe("請看 日曆");
  });

  it("returns empty when only markers remain", () => {
    expect(plainTextForSpeech("****")).toBe("");
  });
});

describe("parseAssistantMarkdown", () => {
  it("parses bold, headings, and lists", () => {
    const blocks = parseAssistantMarkdown("# 週次\n**星期六**\n- 早\n- 晚\n1. 一\n2. 二");
    expect(blocks[0]).toMatchObject({ type: "heading", level: 1 });
    expect(blocks[1]).toMatchObject({ type: "paragraph" });
    expect(JSON.stringify(blocks[1])).toContain("星期六");
    expect(JSON.stringify(blocks[1])).not.toContain("**");
    expect(blocks[2]).toMatchObject({ type: "list", ordered: false });
    expect(blocks[3]).toMatchObject({ type: "list", ordered: true });
  });

  it("leaves HTML as plain text instead of interpreting tags", () => {
    const blocks = parseAssistantMarkdown("<b>hi</b> and <script>x</script>");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ type: "paragraph" });
    expect(JSON.stringify(blocks[0])).toContain("<b>hi</b>");
    expect(JSON.stringify(blocks[0])).toContain("<script>x</script>");
  });

  it("parses markdown links and leaves unsafe hrefs as text", () => {
    const blocks = parseAssistantMarkdown("請看 [日曆](https://example.com) 與 [x](javascript:alert(1))");
    expect(JSON.stringify(blocks[0])).toContain('"type":"link"');
    expect(JSON.stringify(blocks[0])).toContain("https://example.com");
    expect(JSON.stringify(blocks[0])).toContain("javascript:alert(1)");
    expect(JSON.stringify(blocks[0])).not.toContain('"href":"javascript:');
  });

  it("shows unrecognized markers as-is", () => {
    const blocks = parseAssistantMarkdown("_italic_ and *stars*");
    expect(JSON.stringify(blocks[0])).toContain("_italic_");
    expect(JSON.stringify(blocks[0])).toContain("*stars*");
  });
});
