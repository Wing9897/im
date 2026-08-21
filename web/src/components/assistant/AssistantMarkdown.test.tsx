import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { AssistantMarkdown } from "./AssistantMarkdown";

describe("AssistantMarkdown", () => {
  let root: Root;
  let host: HTMLDivElement;

  function render(text: string) {
    act(() => {
      root.render(createElement(AssistantMarkdown, { text }));
    });
  }

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it("renders bold without leftover asterisks", () => {
    render("今天是 **星期六**");
    const el = host.querySelector("[data-testid='assistant-markdown']");
    expect(el?.textContent).toBe("今天是 星期六");
    expect(el?.querySelector("strong")?.textContent).toBe("星期六");
  });

  it("renders headings and lists with existing tokens", () => {
    render("# 標題\n- 甲\n- 乙");
    expect(host.querySelector("h1")?.textContent).toBe("標題");
    expect(host.querySelector("h1")?.className).toContain("text-page-title");
    const items = [...host.querySelectorAll("li")].map((li) => li.textContent);
    expect(items).toEqual(["甲", "乙"]);
  });

  it("renders http(s) links and does not create anchors for javascript URLs", () => {
    render("看 [日曆](https://example.com) 與 [x](javascript:alert(1))");
    const link = host.querySelector("a");
    expect(link?.getAttribute("href")).toBe("https://example.com");
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toBe("noopener");
    expect(link?.textContent).toBe("日曆");
    expect(host.querySelectorAll("a")).toHaveLength(1);
    expect(host.textContent).toContain("[x](javascript:alert(1))");
  });

  it("does not create HTML elements from tags in the source", () => {
    render("<em>no html</em>");
    expect(host.querySelector("em")).toBeNull();
    expect(host.textContent).toContain("<em>no html</em>");
  });
});
