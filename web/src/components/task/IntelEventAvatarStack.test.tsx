import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import {
  IntelEventAvatarStack,
  IntelEventMark,
  INTEL_EVENT_STACK_SIZES,
} from "./IntelEventAvatarStack";

function renderStack(props: Parameters<typeof IntelEventAvatarStack>[0]) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => {
    root.render(createElement(IntelEventAvatarStack, props));
  });
  return {
    host,
    unmount() {
      act(() => root.unmount());
      host.remove();
    },
  };
}

describe("IntelEventAvatarStack", () => {
  it("uses the intel Radar chip as the large mark and ListChecks as the small overlay", () => {
    const { host, unmount } = renderStack({ emoji: "" });
    const stack = host.querySelector(
      '[data-testid="intel-event-avatar-stack"]',
    ) as HTMLElement | null;
    const intel = host.querySelector(
      '[data-testid="intel-event-mark"]',
    ) as HTMLElement | null;
    const task = host.querySelector(
      '[data-testid="intel-event-task-badge"] [data-testid="task-logo-mark"]',
    ) as HTMLElement | null;
    expect(stack?.style.width).toBe(`${INTEL_EVENT_STACK_SIZES.card.largePx + INTEL_EVENT_STACK_SIZES.card.offsetPx}px`);
    expect(intel?.style.width).toBe("38px");
    expect(task?.style.width).toBe("18px");
    expect(intel?.querySelector("svg")?.classList.contains("lucide-radar")).toBe(true);
    expect(task?.querySelector("svg")?.classList.contains("lucide-list-checks")).toBe(true);
    expect(host.querySelector('[data-testid="task-avatar-stack"]')).toBeNull();
    expect(host.querySelector('[data-testid="task-avatar-ai-badge"]')).toBeNull();
    unmount();
  });

  it("puts a picked task emoji on the small overlay, not the large intel mark", () => {
    const { host, unmount } = renderStack({ emoji: "🎯" });
    const intel = host.querySelector('[data-testid="intel-event-mark"]');
    const badge = host.querySelector('[data-testid="intel-event-task-badge"]');
    expect(intel?.textContent).not.toContain("🎯");
    expect(intel?.querySelector("svg")?.classList.contains("lucide-radar")).toBe(true);
    expect(badge?.textContent).toContain("🎯");
    expect(badge?.querySelector('[data-testid="task-logo-mark"]')).toBeNull();
    expect(
      (badge?.querySelector('[data-testid="item-emoji-avatar"]') as HTMLElement | null)?.style
        .width,
    ).toBe("18px");
    unmount();
  });

  it("shrinks the compact timeline stack without using the AI head", () => {
    const { host, unmount } = renderStack({ emoji: "", size: "compact" });
    const stack = host.querySelector(
      '[data-testid="intel-event-avatar-stack"]',
    ) as HTMLElement | null;
    const intel = host.querySelector(
      '[data-testid="intel-event-mark"]',
    ) as HTMLElement | null;
    const task = host.querySelector(
      '[data-testid="intel-event-task-badge"] [data-testid="task-logo-mark"]',
    ) as HTMLElement | null;
    expect(stack?.style.width).toBe("32px");
    expect(intel?.style.width).toBe("28px");
    expect(task?.style.width).toBe("14px");
    expect(host.querySelector('[class*="ai-staff"]')).toBeNull();
    unmount();
  });
});

describe("IntelEventMark", () => {
  it("looks up the task emoji from event.taskId", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => {
      root.render(
        createElement(IntelEventMark, {
          event: { taskId: "task-ops" },
          emojis: { "task-ops": "🎯" },
        }),
      );
    });
    expect(
      host.querySelector('[data-testid="intel-event-task-badge"]')?.textContent,
    ).toContain("🎯");
    expect(
      host.querySelector('[data-testid="intel-event-mark"]')?.querySelector("svg")?.classList.contains(
        "lucide-radar",
      ),
    ).toBe(true);
    act(() => root.unmount());
    host.remove();
  });
});
