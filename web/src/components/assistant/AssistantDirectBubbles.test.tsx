/**
 * Unit tests for AssistantDirectBubbles (independent user STT + agent fades).
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { AssistantDirectBubbles } from "./AssistantDirectBubbles";
import { messagesAfterDirectBaseline } from "./assistantDirectBubbleSelectors";
import {
  AGENT_HIDE_MS,
  FADE_MS,
  USER_HIDE_MS,
  flashTotalMs,
  scheduleFlashLifecycle,
} from "./assistantDirectBubbleTimers";
import { wrapWithI18n } from "../../test/i18nHarness";

vi.mock("../../domain/aiStaff/assistantIdentity", () => ({
  useAssistantIdentity: () => ({ identity: { avatarDataUrl: null, displayName: null } }),
  resolveAssistantDisplayName: (_identity: unknown, fallback: string) => fallback,
}));

vi.mock("../../domain/user/userProfile", () => ({
  useUserProfile: () => ({
    profile: { displayName: "", avatarDataUrl: null, background: "" },
  }),
  resolveUserDisplayName: (_profile: unknown, fallback: string) => fallback,
}));

describe("assistantDirectBubbleTimers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("exposes stable hide + fade durations", () => {
    expect(USER_HIDE_MS).toBe(6_000);
    expect(AGENT_HIDE_MS).toBe(15_000);
    expect(flashTotalMs(USER_HIDE_MS)).toBe(USER_HIDE_MS + FADE_MS);
  });

  it("scheduleFlashLifecycle fades then clears exactly once", () => {
    const onFadeStart = vi.fn();
    const onClear = vi.fn();
    const onFadeTimer = vi.fn();
    scheduleFlashLifecycle({
      key: "k1",
      hideMs: USER_HIDE_MS,
      onFadeStart,
      onClear,
      onFadeTimer,
    });
    expect(onFadeStart).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(USER_HIDE_MS);
    });
    expect(onFadeStart).toHaveBeenCalledWith("k1");
    expect(onFadeTimer).toHaveBeenCalledTimes(1);
    expect(onClear).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(FADE_MS);
    });
    expect(onClear).toHaveBeenCalledWith("k1");
  });
});

describe("messagesAfterDirectBaseline", () => {
  it("returns all messages when frozen set is empty", () => {
    const msgs = [{ id: "a1", role: "assistant" as const, content: "new" }];
    expect(messagesAfterDirectBaseline(msgs, new Set())).toEqual(msgs);
  });

  it("hides messages whose ids are frozen", () => {
    const msgs = [
      { id: "u1", role: "user" as const, content: "old user" },
      { id: "a1", role: "assistant" as const, content: "old agent" },
      { id: "u2", role: "user" as const, content: "new user" },
      { id: "a2", role: "assistant" as const, content: "new agent" },
    ];
    expect(messagesAfterDirectBaseline(msgs, new Set(["u1", "a1"])).map((m) => m.id)).toEqual([
      "u2",
      "a2",
    ]);
  });

  it("keeps a second PTT turn's new assistant id after the first-turn baseline", () => {
    const msgs = [
      { id: "u1", role: "user" as const, content: "first" },
      { id: "a1", role: "assistant" as const, content: "reply one" },
      { id: "u2", role: "user" as const, content: "second" },
      { id: "a2", role: "assistant" as const, content: "reply two" },
    ];
    const afterFirstHold = messagesAfterDirectBaseline(msgs, new Set());
    expect(afterFirstHold.map((m) => m.id)).toEqual(["u1", "a1", "u2", "a2"]);
    const afterSecondHold = messagesAfterDirectBaseline(msgs, new Set(["u1", "a1"]));
    expect(afterSecondHold.map((m) => m.id)).toEqual(["u2", "a2"]);
    expect(afterSecondHold.some((m) => m.id === "a2")).toBe(true);
  });
});

describe("AssistantDirectBubbles", () => {
  let root: Root;
  let host: HTMLDivElement;

  beforeEach(() => {
    vi.useFakeTimers();
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    document.querySelectorAll("[data-testid='assistant-direct-bubbles']").forEach((el) => el.remove());
    vi.useRealTimers();
  });

  function render(props: Record<string, unknown>) {
    act(() => {
      root.render(
        wrapWithI18n(createElement(AssistantDirectBubbles, {
            messages: [],
            sending: false,
            listening: false,
            liveToolSteps: [],
            ...props,
          })),
      );
    });
  }

  /** Arm the turn (freeze current history) then show new messages. */
  function armThenShowMessages(messages: unknown[], extra: Record<string, unknown> = {}) {
    render({ listening: true, messages: [], ...extra });
    render({ listening: false, messages, ...extra });
  }

  it("shows live STT draft while listening", () => {
    render({ listening: true, draft: "hello partial" });
    expect(document.querySelector("[data-testid='assistant-direct-listening']")).not.toBeNull();
    expect(document.querySelector("[data-testid='assistant-direct-stt-live']")?.textContent).toBe(
      "hello partial",
    );
    expect(document.querySelector("[data-testid='assistant-direct-user-avatar']")).not.toBeNull();
  });

  it("shows assistant presence when the text composer is open", () => {
    render({
      active: true,
      composer: createElement("div", { "data-testid": "assistant-caption-composer" }),
    });
    const presence = document.querySelector("[data-testid='assistant-direct-presence']");
    expect(presence).not.toBeNull();
    expect(presence?.querySelector("[data-testid='ai-staff-avatar-assistant']")).not.toBeNull();
    expect(presence?.querySelector("[data-testid='ai-staff-avatar-taskEditor']")).toBeNull();
    expect(document.querySelector("[data-testid='assistant-task-advisor-presence']")).toBeNull();

    render({ active: true });
    expect(document.querySelector("[data-testid='assistant-direct-presence']")).toBeNull();
  });

  it("flashes the current turn while the composer is open (flash mode)", () => {
    const composer = createElement("div", { "data-testid": "assistant-caption-composer" });
    armThenShowMessages(
      [
        { id: "u1", role: "user", content: "hello" },
        { id: "a1", role: "assistant", content: "world" },
      ],
      { composer, active: true },
    );
    expect(document.querySelector("[data-testid='assistant-direct-user-msg']")?.textContent).toBe(
      "hello",
    );
    expect(document.querySelector("[data-testid='assistant-direct-msg']")?.textContent).toBe(
      "world",
    );
    expect(document.querySelector("[data-testid='assistant-caption-composer']")).not.toBeNull();
  });

  it("hides turn bubbles when persistTranscript is on with the composer", () => {
    const composer = createElement("div", { "data-testid": "assistant-caption-composer" });
    armThenShowMessages(
      [
        { id: "u1", role: "user", content: "hello" },
        { id: "a1", role: "assistant", content: "world" },
      ],
      { composer, active: true, persistTranscript: true },
    );
    expect(document.querySelector("[data-testid='assistant-direct-user-msg']")).toBeNull();
    expect(document.querySelector("[data-testid='assistant-direct-msg']")).toBeNull();
    expect(document.querySelector("[data-testid='assistant-caption-composer']")).not.toBeNull();
  });

  it("shows dual staff presence only when taskAdvisorPresence is enabled", () => {
    render({ active: true, taskAdvisorPresence: true });
    const presence = document.querySelector("[data-testid='assistant-task-advisor-presence']");
    expect(presence).not.toBeNull();
    expect(presence?.querySelector("[data-testid='ai-staff-avatar-assistant']")).not.toBeNull();
    expect(presence?.querySelector("[data-testid='ai-staff-avatar-taskEditor']")).not.toBeNull();

    render({ active: true, taskAdvisorPresence: false });
    expect(document.querySelector("[data-testid='assistant-task-advisor-presence']")).toBeNull();
    expect(document.querySelector("[data-testid='assistant-direct-presence']")).toBeNull();
  });

  it("clears the sending flash when the turn fails without an assistant reply", () => {
    render({ sending: true, messages: [] });
    expect(document.querySelector("[data-testid='assistant-direct-sending']")).not.toBeNull();

    render({ sending: false, messages: [] });
    expect(document.querySelector("[data-testid='assistant-direct-sending']")).toBeNull();
    expect(document.querySelector("[data-testid='assistant-direct-bubbles']")).toBeNull();
  });

  it("keeps final reply on assistant avatar while attributing consult_advisor steps", () => {
    armThenShowMessages(
      [
        {
          id: "a1",
          role: "assistant",
          content: "表單已更新",
          toolCalls: [
            {
              name: "tasks.consult_advisor",
              arguments: { instruction: "改名" },
              resultSummary: "ok",
            },
          ],
        },
      ],
      { taskAdvisorPresence: true },
    );

    const reply = document.querySelector("[data-testid='assistant-direct-msg']");
    expect(reply).not.toBeNull();
    expect(reply?.closest(".im-assistant-direct__row")?.querySelector(
      "[data-testid='ai-staff-avatar-assistant']",
    )).not.toBeNull();
    expect(document.querySelector("[data-testid='assistant-tool-step-staff']")?.getAttribute(
      "data-staff-id",
    )).toBe("taskEditor");
  });

  it("on release does not flash draft-only transcript (avoids double bar)", () => {
    render({ listening: true, draft: "spoken words" });
    render({ listening: false, draft: "spoken words", messages: [] });
    expect(document.querySelector("[data-testid='assistant-direct-user-msg']")).toBeNull();
  });

  it("on release flashes committed user message", () => {
    render({ listening: true, draft: "spoken words" });
    render({
      listening: false,
      draft: "",
      messages: [{ id: "u1", role: "user", content: "spoken words" }],
    });
    expect(document.querySelector("[data-testid='assistant-direct-user-msg']")?.textContent).toBe(
      "spoken words",
    );
  });

  it("clears prior user flash when listening starts again", () => {
    render({
      listening: false,
      messages: [{ id: "u0", role: "user", content: "last time" }],
    });
    // Arm turn then show prior user flash via listen→release with message.
    render({ listening: true, draft: "" });
    render({
      listening: false,
      messages: [{ id: "u0", role: "user", content: "last time" }],
    });
    expect(document.querySelector("[data-testid='assistant-direct-user-msg']")?.textContent).toBe(
      "last time",
    );
    render({ listening: true, draft: "" });
    expect(document.querySelector("[data-testid='assistant-direct-user-msg']")).toBeNull();
    expect(document.querySelector("[data-testid='assistant-direct-stt-live']")).toBeNull();
  });

  it("ignores session history until the user listens or sends (F5 / always-on)", () => {
    render({
      showReadyHint: true,
      messages: [
        { id: "u-old", role: "user", content: "previous ask" },
        { id: "a-old", role: "assistant", content: "previous reply" },
      ],
    });
    expect(document.querySelector("[data-testid='assistant-direct-ready']")).not.toBeNull();
    expect(document.querySelector("[data-testid='assistant-direct-msg']")).toBeNull();
    expect(document.querySelector("[data-testid='assistant-direct-user-msg']")).toBeNull();
  });

  it("fades user transcript after USER_HIDE_MS independently of agent", () => {
    armThenShowMessages([
      { id: "u1", role: "user", content: "my ask" },
      { id: "a1", role: "assistant", content: "agent answer" },
    ]);
    expect(document.querySelector("[data-testid='assistant-direct-user-msg']")).not.toBeNull();
    expect(document.querySelector("[data-testid='assistant-direct-msg']")?.textContent).toContain(
      "agent answer",
    );

    act(() => {
      vi.advanceTimersByTime(USER_HIDE_MS - 1);
    });
    expect(document.querySelector("[data-testid='assistant-direct-user-msg']")).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    // fading class applied; still mounted until FADE_MS
    expect(document.querySelector("[data-testid='assistant-direct-user-msg']")).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(FADE_MS);
    });
    expect(document.querySelector("[data-testid='assistant-direct-user-msg']")).toBeNull();
    expect(document.querySelector("[data-testid='assistant-direct-msg']")).not.toBeNull();
  });

  it("fades agent reply after AGENT_HIDE_MS + FADE_MS", () => {
    armThenShowMessages([{ id: "a1", role: "assistant", content: "agent answer" }]);
    expect(document.querySelector("[data-testid='assistant-direct-msg']")).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(AGENT_HIDE_MS);
    });
    expect(document.querySelector("[data-testid='assistant-direct-msg']")).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(FADE_MS);
    });
    expect(document.querySelector("[data-testid='assistant-direct-msg']")).toBeNull();
  });

  it("does not show prior agent reply while listening", () => {
    render({
      listening: true,
      messages: [{ id: "a1", role: "assistant", content: "prior reply" }],
    });
    expect(document.querySelector("[data-testid='assistant-direct-listening']")).not.toBeNull();
    expect(document.querySelector("[data-testid='assistant-direct-msg']")).toBeNull();
  });

  it("shows ready hint only when idle", () => {
    render({
      showReadyHint: true,
      messages: [{ id: "a0", role: "assistant", content: "old" }],
    });
    expect(document.querySelector("[data-testid='assistant-direct-ready']")).not.toBeNull();
    expect(document.querySelector("[data-testid='assistant-direct-msg']")).toBeNull();
  });

  it("does not reappear ready hint after fade completes", () => {
    const onReadyHintConsumed = vi.fn();
    render({
      showReadyHint: true,
      onReadyHintConsumed,
      messages: [{ id: "a0", role: "assistant", content: "old" }],
    });
    expect(document.querySelector("[data-testid='assistant-direct-ready']")).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(4_000);
    });
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(document.querySelector("[data-testid='assistant-direct-ready']")).toBeNull();
    expect(onReadyHintConsumed).toHaveBeenCalledTimes(1);

    render({
      showReadyHint: true,
      onReadyHintConsumed,
      messages: [{ id: "a0", role: "assistant", content: "old" }],
    });
    expect(document.querySelector("[data-testid='assistant-direct-ready']")).toBeNull();
  });

  it("does not reappear ready hint after a speaking turn ends", () => {
    const onReadyHintConsumed = vi.fn();
    render({
      showReadyHint: true,
      onReadyHintConsumed,
      messages: [],
    });
    expect(document.querySelector("[data-testid='assistant-direct-ready']")).not.toBeNull();

    render({
      showReadyHint: true,
      onReadyHintConsumed,
      listening: true,
      draft: "hello",
      messages: [],
    });
    expect(document.querySelector("[data-testid='assistant-direct-ready']")).toBeNull();
    expect(onReadyHintConsumed).toHaveBeenCalled();

    render({
      showReadyHint: false,
      onReadyHintConsumed,
      listening: false,
      draft: "",
      messages: [
        { id: "u1", role: "user", content: "hello" },
        { id: "a1", role: "assistant", content: "world" },
      ],
    });

    act(() => {
      vi.advanceTimersByTime(15_000);
    });
    act(() => {
      vi.advanceTimersByTime(400);
    });

    render({
      showReadyHint: false,
      onReadyHintConsumed,
      listening: false,
      messages: [
        { id: "u1", role: "user", content: "hello" },
        { id: "a1", role: "assistant", content: "world" },
      ],
    });
    expect(document.querySelector("[data-testid='assistant-direct-ready']")).toBeNull();
  });

  it("uses near-bottom overlay class on the portal root", () => {
    render({
      showReadyHint: true,
      messages: [],
    });
    const rootEl = document.querySelector("[data-testid='assistant-direct-bubbles']");
    expect(rootEl?.classList.contains("im-assistant-direct")).toBe(true);
  });

  function overlayCss(): string {
    return readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), "../../css/dialog-assistant.css"),
      "utf8",
    );
  }

  it("pins overlay near the window bottom with panel contrast tokens", () => {
    const css = overlayCss();
    expect(css).toMatch(
      /\.im-assistant-direct\s*\{[^}]*bottom:\s*calc\(20px \+ env\(safe-area-inset-bottom/s,
    );
    expect(css).not.toMatch(/bottom:\s*max\(24px,\s*calc\(12%/);
    expect(css).toMatch(
      /\.im-assistant-direct__presence-name\s*\{[^}]*color:\s*var\(--text-primary\)/s,
    );
    expect(css).toMatch(
      /--im-assistant-overlay-fill:\s*color-mix\(in srgb, var\(--surface-card\) 86%, transparent\)/,
    );
    expect(css).toMatch(
      /\.im-assistant-direct__bubble\s*\{[^}]*background:\s*var\(--im-assistant-overlay-fill\)/s,
    );
    expect(css).toMatch(
      /\.im-assistant-direct__composer\s*\{[^}]*background:\s*var\(--im-assistant-overlay-fill\)/s,
    );
    expect(css).toMatch(
      /\.im-assistant-direct__composer-history-role\s*\{[^}]*color:\s*var\(--text-primary\)/s,
    );
  });

  it("caps flash bubbles taller when the composer is open and leaves persist history unchanged", () => {
    const css = overlayCss();
    expect(css).toMatch(
      /\.im-assistant-direct__bubble\s*\{[^}]*max-height:\s*min\(22vh,\s*180px\)[^}]*pointer-events:\s*auto/s,
    );
    expect(css).toMatch(
      /\.im-assistant-direct:has\(\.im-assistant-direct__composer\)\s+\.im-assistant-direct__bubble\s*\{[^}]*max-height:\s*min\(38vh,\s*calc\(100dvh - 280px\)\)[^}]*min-height:\s*0/s,
    );
    expect(css).not.toMatch(/max-height:\s*min\(14vh,\s*120px\)/);
    expect(css).toMatch(
      /\.im-assistant-direct__composer-history\s*\{[^}]*max-height:\s*min\(20vh,\s*160px\)/s,
    );
  });

  it("lets composer+flash long markdown overflow and receive pointer events", () => {
    const style = document.createElement("style");
    style.textContent = overlayCss();
    document.head.appendChild(style);

    const longReply = Array.from({ length: 24 }, (_, i) =>
      `## 段落 ${i + 1}\n\n這是一段足夠長的回覆，用來確認閃現氣泡可以完整捲動閱讀。\n`,
    ).join("\n");
    const composer = createElement("div", {
      className: "im-assistant-direct__composer",
      "data-testid": "assistant-caption-composer",
    });
    armThenShowMessages(
      [{ id: "a1", role: "assistant", content: longReply }],
      { composer, active: true },
    );

    const stack = document.querySelector(".im-assistant-direct__stack");
    const bubble = document.querySelector("[data-testid='assistant-direct-msg']") as HTMLElement | null;
    expect(stack?.classList.contains("pointer-events-none")).toBe(true);
    expect(bubble).not.toBeNull();
    expect(bubble?.querySelectorAll("h2").length).toBe(24);
    expect(getComputedStyle(bubble!).pointerEvents).toBe("auto");
    expect(getComputedStyle(bubble!).overflowY).toBe("auto");
    expect(getComputedStyle(bubble!).maxHeight).not.toBe("120px");

    Object.defineProperty(bubble, "clientHeight", { configurable: true, get: () => 180 });
    Object.defineProperty(bubble, "scrollHeight", { configurable: true, get: () => 960 });
    expect(bubble!.scrollHeight).toBeGreaterThan(bubble!.clientHeight);
  });

  it("renders per-message rows with user and assistant avatars", () => {
    armThenShowMessages([
      { id: "u1", role: "user", content: "my ask" },
      { id: "a1", role: "assistant", content: "agent answer" },
    ]);
    const portal = document.querySelector("[data-testid='assistant-direct-bubbles']");
    expect(portal).not.toBeNull();
    expect(portal?.querySelectorAll("[data-testid='assistant-direct-user-avatar']").length).toBeGreaterThanOrEqual(1);
    expect(portal?.querySelectorAll("[data-testid='ai-staff-avatar-assistant']").length).toBeGreaterThanOrEqual(1);
    expect(portal?.querySelectorAll(".im-assistant-direct__row").length).toBeGreaterThanOrEqual(2);
  });

  function laneOrder(): string[] {
    const portal = document.querySelector("[data-testid='assistant-direct-bubbles']");
    if (!portal) return [];
    return [...portal.querySelectorAll("[data-testid]")]
      .map((el) => el.getAttribute("data-testid") ?? "")
      .filter((id) =>
        id === "assistant-direct-user-msg" ||
        id === "assistant-direct-sending" ||
        id === "assistant-direct-msg",
      );
  }

  it("keeps sending then reply through the listen-to-send gap and does not hide before reply", () => {
    render({ listening: true, draft: "hello" });
    render({ listening: false, sending: false, draft: "", messages: [] });
    render({
      listening: false,
      sending: true,
      messages: [{ id: "u1", role: "user", content: "hello" }],
    });
    expect(document.querySelector("[data-testid='assistant-direct-user-msg']")?.textContent).toBe(
      "hello",
    );
    expect(document.querySelector("[data-testid='assistant-direct-sending']")).not.toBeNull();
    expect(laneOrder()).toEqual(["assistant-direct-user-msg", "assistant-direct-sending"]);

    act(() => {
      vi.advanceTimersByTime(AGENT_HIDE_MS + FADE_MS);
    });
    expect(document.querySelector("[data-testid='assistant-direct-sending']")).not.toBeNull();

    render({
      listening: false,
      sending: false,
      messages: [
        { id: "u1", role: "user", content: "hello" },
        { id: "a1", role: "assistant", content: "**星期六**" },
      ],
    });
    const reply = document.querySelector("[data-testid='assistant-direct-msg']");
    expect(reply?.textContent).toContain("星期六");
    expect(reply?.textContent).not.toContain("*");
    // User lane may already have independently faded (USER_HIDE_MS < AGENT_HIDE_MS).
    expect(laneOrder().at(-1)).toBe("assistant-direct-msg");
  });

  it("shows the new assistant id after a second PTT turn", () => {
    const turn1 = [
      { id: "u1", role: "user", content: "first" },
      { id: "a1", role: "assistant", content: "reply one" },
    ];
    armThenShowMessages(turn1);
    expect(document.querySelector("[data-testid='assistant-direct-msg']")?.textContent).toContain(
      "reply one",
    );

    render({ listening: true, messages: turn1 });
    expect(document.querySelector("[data-testid='assistant-direct-msg']")).toBeNull();

    render({
      listening: false,
      sending: true,
      messages: [...turn1, { id: "u2", role: "user", content: "second" }],
    });
    expect(document.querySelector("[data-testid='assistant-direct-user-msg']")?.textContent).toBe(
      "second",
    );
    expect(document.querySelector("[data-testid='assistant-direct-sending']")).not.toBeNull();
    expect(document.querySelector("[data-testid='assistant-direct-msg']")).toBeNull();

    render({
      listening: false,
      sending: false,
      messages: [
        ...turn1,
        { id: "u2", role: "user", content: "second" },
        { id: "a2", role: "assistant", content: "reply two" },
      ],
    });
    expect(document.querySelector("[data-testid='assistant-direct-msg']")?.textContent).toContain(
      "reply two",
    );
    expect(document.querySelector("[data-testid='assistant-direct-msg']")?.textContent).not.toContain(
      "reply one",
    );
  });
});
