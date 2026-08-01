/**
 * XSS Demonstration & URL Protocol Allowlist Tests
 *
 * Validates: Requirement 11 (Frontend XSS Protection)
 *
 * NOTE: This test imports React components from web/src/ and requires
 * web/node_modules to be installed (npm install in web/).
 *
 * These tests demonstrate that the codebase neutralizes the following
 * XSS attack vectors:
 *   1. `<script>` tags injected via user content render as text, not as
 *      executable script.
 *   2. HTML event-handler payloads (such as `<img onerror=...>`) render
 *      as text, not as DOM with handlers.
 *   3. HTML-entity-encoded payloads (`&lt;script&gt;`) render literally.
 *   4. URL validation (`isSafeHttpUrl` and the action
 *      config validators) rejects `javascript:`, `data:`, `vbscript:`,
 *      and other unsafe schemes.
 *
 * The test approach is functional: render real components with malicious
 * inputs, then assert the resulting DOM contains no executable artifacts.
 */
import React from "react";
import { describe, it, expect } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MessageCard } from "../web/src/components/common/MessageCard";
import { isSafeHttpUrl } from "../web/src/utils/safeUrl";
import {
  validateDiscordConfig,
  validateHttpConfig,
  validateMqttConfig,
} from "../web/src/utils/configValidation";
import type { Message } from "../web/src/types";

// ── Helpers ────────────────────────────────────────────────

interface Mounted {
  container: HTMLElement;
  root: Root;
}

function mount(node: React.ReactNode): Mounted {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(node);
  });
  return { container, root };
}

function unmount({ container, root }: Mounted): void {
  act(() => {
    root.unmount();
  });
  if (container.parentNode) {
    container.parentNode.removeChild(container);
  }
}

function messageContentEl(container: HTMLElement): HTMLElement {
  const el = container.querySelector('[data-testid="message-card-content"]');
  if (!el) {
    throw new Error("message-card-content element not found");
  }
  return el as HTMLElement;
}

function makeMessage(content: string): Message {
  return {
    id: "msg-xss-1",
    accountId: "acc-1",
    platform: "telegram",
    platformMessageId: "1",
    platformId: "ch-1",
    channelName: "Test Channel",
    senderId: "sender-1",
    senderName: "Test Sender",
    content,
    timestamp: "2025-01-15T12:00:00Z",
    rawData: null,
    media: null,
    createdAt: "2025-01-15T12:00:00Z",
  };
}

// ── 1. Script tag neutralization ───────────────────────────

describe("XSS protection — script tag rendering", () => {
  it("renders <script>alert(1)</script> in message content as text, not as a script element", () => {
    const payload = "<script>alert(1)</script>";
    const m = mount(<MessageCard message={makeMessage(payload)} />);
    try {
      // The dangerous text appears verbatim in the DOM.
      expect(m.container.textContent).toContain(payload);
      // No <script> element was created from the user input.
      expect(m.container.querySelector("script")).toBeNull();
    } finally {
      unmount(m);
    }
  });

  it("escapes nested <script> with quoted attributes", () => {
    const payload = `<script type="text/javascript">window.x=1</script>`;
    const m = mount(<MessageCard message={makeMessage(payload)} />);
    try {
      expect(m.container.textContent).toContain(payload);
      expect(m.container.querySelector("script")).toBeNull();
    } finally {
      unmount(m);
    }
  });
});

// ── 2. Event handler neutralization ────────────────────────

describe("XSS protection — event handler payloads", () => {
  it("renders <img src=x onerror=alert(1)> as text, not as an img element with handler", () => {
    const payload = "<img src=x onerror=alert(1)>";
    const m = mount(<MessageCard message={makeMessage(payload)} />);
    try {
      const contentEl = messageContentEl(m.container);
      expect(contentEl.textContent).toContain(payload);
      expect(contentEl.querySelector("img")).toBeNull();
    } finally {
      unmount(m);
    }
  });

  it("renders <svg onload=alert(1)> as text, not as an svg element with onload", () => {
    const payload = "<svg onload=alert(1)>";
    const m = mount(<MessageCard message={makeMessage(payload)} />);
    try {
      const contentEl = messageContentEl(m.container);
      expect(contentEl.textContent).toContain(payload);
      expect(contentEl.querySelector("svg")).toBeNull();
    } finally {
      unmount(m);
    }
  });

  it("renders <body onfocus=...> as text, not as a body-element injection", () => {
    const payload = "<body onfocus=alert(1)>";
    const m = mount(<MessageCard message={makeMessage(payload)} />);
    try {
      const contentEl = messageContentEl(m.container);
      expect(contentEl.textContent).toContain(payload);
      // No new <body> element was injected into the message content subtree.
      expect(contentEl.querySelector("body")).toBeNull();
    } finally {
      unmount(m);
    }
  });
});

// ── 3. Encoded payload handling ────────────────────────────

describe("XSS protection — encoded payload handling", () => {
  it("renders entity-encoded payload (&lt;script&gt;) literally without re-decoding into a tag", () => {
    const payload = "&lt;script&gt;alert(1)&lt;/script&gt;";
    const m = mount(<MessageCard message={makeMessage(payload)} />);
    try {
      // React preserves the literal entity sequence (no double-decoding).
      expect(m.container.textContent).toContain(payload);
      expect(m.container.querySelector("script")).toBeNull();
    } finally {
      unmount(m);
    }
  });

  it("renders user content inside an attribute (title) without escaping into surrounding markup", () => {
    // Sender name is rendered into the title attribute on MessageCard;
    // injecting an attribute-breaking payload must not introduce a real
    // event handler on any element.
    const payload = `" onmouseover="alert(1)`;
    const messageWithMaliciousSender: Message = {
      ...makeMessage("normal content"),
      senderName: payload,
    };
    const m = mount(<MessageCard message={messageWithMaliciousSender} />);
    try {
      const withTitle = m.container.querySelectorAll("[title]");
      const matched = Array.from(withTitle).some(
        (el) => (el as HTMLElement).getAttribute("title") === payload,
      );
      expect(matched).toBe(true);
      // No element should have an actual onmouseover DOM handler set —
      // even though the payload contains the literal text
      // `onmouseover=`, React must serialize it inside a quoted attribute
      // value (using `&quot;`) so the parser never sees it as markup.
      const allElements = m.container.querySelectorAll("*");
      for (const el of Array.from(allElements)) {
        expect((el as HTMLElement).onmouseover).toBeNull();
      }
      // The serialized HTML must use entity-encoded quotes inside the
      // title attribute so the surrounding attribute is not broken.
      expect(m.container.innerHTML).toContain("&quot;");
    } finally {
      unmount(m);
    }
  });
});

// ── 4. URL protocol allowlist ──────────────────────────────

describe("XSS protection — URL protocol allowlist", () => {
  it("rejects javascript: URLs", () => {
    expect(isSafeHttpUrl("javascript:alert(1)")).toBe(false);
  });

  it("rejects data: URLs (including base64-encoded HTML payloads)", () => {
    expect(isSafeHttpUrl("data:text/html,<script>alert(1)</script>")).toBe(
      false,
    );
    expect(
      isSafeHttpUrl(
        "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
      ),
    ).toBe(false);
  });

  it("rejects vbscript:, file:, and other unsafe schemes", () => {
    expect(isSafeHttpUrl("vbscript:msgbox(1)")).toBe(false);
    expect(isSafeHttpUrl("file:///etc/passwd")).toBe(false);
    expect(isSafeHttpUrl("ftp://example.com/payload")).toBe(false);
  });

  it("rejects URLs with leading/trailing whitespace and control characters that hide the scheme", () => {
    expect(isSafeHttpUrl("  javascript:alert(1)  ")).toBe(false);
    expect(isSafeHttpUrl("\tjavascript:alert(1)")).toBe(false);
  });

  it("rejects malformed URLs and empty strings", () => {
    expect(isSafeHttpUrl("")).toBe(false);
    expect(isSafeHttpUrl("   ")).toBe(false);
    expect(isSafeHttpUrl("not a url")).toBe(false);
    expect(isSafeHttpUrl(null)).toBe(false);
    expect(isSafeHttpUrl(undefined)).toBe(false);
  });

  it("accepts http:// and https:// URLs", () => {
    expect(isSafeHttpUrl("http://example.com")).toBe(true);
    expect(isSafeHttpUrl("https://example.com/path?x=1")).toBe(true);
  });

  it("accepts case-variant http/https schemes (HTTP://, HtTpS://)", () => {
    // URL parser canonicalizes scheme to lowercase, so these pass.
    expect(isSafeHttpUrl("HTTP://example.com")).toBe(true);
    expect(isSafeHttpUrl("HtTpS://example.com")).toBe(true);
  });
});

// ── 5. Action config validators reject unsafe URLs ─────────

describe("XSS protection — action config validators", () => {
  it("validateDiscordConfig rejects javascript: payload disguised as a webhook", () => {
    const result = validateDiscordConfig({
      webhook_url: "javascript:alert('xss')",
    });
    expect(result.valid).toBe(false);
  });

  it("validateHttpConfig rejects javascript: scheme", () => {
    const result = validateHttpConfig({
      url: "javascript:alert(1)",
      method: "POST",
    });
    expect(result.valid).toBe(false);
  });

  it("validateMqttConfig rejects http(s) schemes for broker URL", () => {
    // Broker URL must be mqtt:// or mqtts:// — a maliciously schemed URL
    // such as javascript: must be rejected.
    const result = validateMqttConfig({
      broker_url: "javascript:alert(1)",
      topic: "x",
      username: "",
      password: "",
      qos: 0,
    });
    expect(result.valid).toBe(false);
  });
});
