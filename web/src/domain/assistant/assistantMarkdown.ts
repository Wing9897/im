/**
 * Safe in-repo Markdown subset for assistant bubbles (no HTML, no extra deps).
 * Unrecognized syntax is left as plain text.
 */

export type AssistantMdInline =
  | { type: "text"; value: string }
  | { type: "bold"; children: AssistantMdInline[] }
  | { type: "code"; value: string }
  | { type: "link"; href: string; children: AssistantMdInline[] };

export type AssistantMdBlock =
  | { type: "heading"; level: 1 | 2 | 3; children: AssistantMdInline[] }
  | { type: "paragraph"; children: AssistantMdInline[] }
  | { type: "list"; ordered: boolean; items: AssistantMdInline[][] };

const HEADING_RE = /^(#{1,3})\s+(.+)$/;
const UL_RE = /^\s*[-*]\s+(.+)$/;
const OL_RE = /^\s*\d+\.\s+(.+)$/;

/** http(s) only — never interpret HTML or javascript: / data: URLs. */
export function isSafeAssistantHref(href: string): boolean {
  const trimmed = href.trim();
  if (!trimmed || /\s/.test(trimmed)) return false;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function tryParseLink(
  line: string,
  i: number,
): { node: AssistantMdInline; end: number } | null {
  const close = line.indexOf("]", i + 1);
  if (close === -1 || line[close + 1] !== "(") return null;
  const urlEnd = line.indexOf(")", close + 2);
  if (urlEnd === -1) return null;
  const label = line.slice(i + 1, close);
  const href = line.slice(close + 2, urlEnd).trim();
  if (!label || !isSafeAssistantHref(href)) return null;
  return {
    node: { type: "link", href, children: parseInline(label) },
    end: urlEnd + 1,
  };
}

function parseInline(line: string): AssistantMdInline[] {
  const out: AssistantMdInline[] = [];
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (ch === "`") {
      const end = line.indexOf("`", i + 1);
      if (end !== -1) {
        out.push({ type: "code", value: line.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    if (line.startsWith("**", i)) {
      const end = line.indexOf("**", i + 2);
      if (end !== -1 && end > i + 2) {
        out.push({ type: "bold", children: parseInline(line.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }
    if (ch === "[") {
      const parsed = tryParseLink(line, i);
      if (parsed) {
        out.push(parsed.node);
        i = parsed.end;
        continue;
      }
    }
    let next = line.length;
    const tick = line.indexOf("`", i);
    const star = line.indexOf("**", i);
    const bracket = line.indexOf("[", i);
    if (tick !== -1) next = Math.min(next, tick);
    if (star !== -1) next = Math.min(next, star);
    if (bracket !== -1) next = Math.min(next, bracket);
    if (next === i) {
      out.push({ type: "text", value: line[i] ?? "" });
      i += 1;
      continue;
    }
    out.push({ type: "text", value: line.slice(i, next) });
    i = next;
  }
  return out.filter((node) => node.type !== "text" || node.value.length > 0);
}

function flushParagraph(lines: string[], blocks: AssistantMdBlock[]): void {
  if (lines.length === 0) return;
  for (const line of lines) {
    blocks.push({ type: "paragraph", children: parseInline(line) });
  }
  lines.length = 0;
}

function flushList(
  items: AssistantMdInline[][],
  ordered: boolean,
  blocks: AssistantMdBlock[],
): void {
  if (items.length === 0) return;
  blocks.push({ type: "list", ordered, items: items.slice() });
  items.length = 0;
}

/** Parse a safe subset: headings, bold, inline code, lists, `[text](url)` links. HTML is never interpreted. */
export function parseAssistantMarkdown(source: string): AssistantMdBlock[] {
  const text = source.replace(/\r\n/g, "\n");
  if (!text.trim()) {
    return [];
  }
  const blocks: AssistantMdBlock[] = [];
  const paragraphLines: string[] = [];
  let listItems: AssistantMdInline[][] = [];
  let listOrdered: boolean | null = null;

  const endList = () => {
    if (listOrdered == null) return;
    flushList(listItems, listOrdered, blocks);
    listItems = [];
    listOrdered = null;
  };

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      flushParagraph(paragraphLines, blocks);
      endList();
      continue;
    }
    const heading = line.match(HEADING_RE);
    if (heading) {
      flushParagraph(paragraphLines, blocks);
      endList();
      const marks = heading[1] ?? "#";
      const level = Math.min(marks.length, 3) as 1 | 2 | 3;
      blocks.push({ type: "heading", level, children: parseInline(heading[2] ?? "") });
      continue;
    }
    const ul = line.match(UL_RE);
    if (ul) {
      flushParagraph(paragraphLines, blocks);
      if (listOrdered !== false) {
        endList();
        listOrdered = false;
      }
      listItems.push(parseInline(ul[1] ?? ""));
      continue;
    }
    const ol = line.match(OL_RE);
    if (ol) {
      flushParagraph(paragraphLines, blocks);
      if (listOrdered !== true) {
        endList();
        listOrdered = true;
      }
      listItems.push(parseInline(ol[1] ?? ""));
      continue;
    }
    endList();
    paragraphLines.push(line);
  }
  flushParagraph(paragraphLines, blocks);
  endList();
  return blocks;
}

/**
 * TTS-facing plain text: drop emphasis / heading markers and link syntax.
 * Headings get a short stop (。); list items join with 、.
 */
export function plainTextForSpeech(source: string): string {
  let text = source.replace(/\r\n/g, "\n");
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  text = text.replace(/^\s{0,3}#{1,3}\s+(.+)$/gm, "$1。");
  text = text.replace(/^\s*[-*+]\s+/gm, "");
  text = text.replace(/^\s*\d+\.\s+/gm, "");
  text = text.replace(/`([^`]+)`/g, "$1");
  text = text.replace(/[*_#]+/g, "");
  text = text.replace(/\n{2,}/g, "。");
  text = text.replace(/\n/g, "、");
  text = text.replace(/[。、]{2,}/g, (chunk) => chunk.slice(0, 1));
  text = text.replace(/[ \t]+/g, " ");
  return text.trim();
}
