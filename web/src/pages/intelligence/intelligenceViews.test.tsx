import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { makeAnalysisEvent } from "../../test/analysisEventFixtures";

// Mock useAutoRead to return a simple ref (avoids IntersectionObserver issues)
vi.mock("../../hooks/useAutoRead", () => ({
  useAutoRead: () => ({ current: null }),
}));

// Mock useFocusTrap (used by IntelligenceDetailDialog)
vi.mock("../../hooks/useFocusTrap", () => ({
  useFocusTrap: () => ({ current: null }),
}));

// Import after mocks
const { IntelligenceCard } = await import("./views/IntelligenceCardView");
const { IntelligenceRow } = await import("./views/IntelligenceListView");
const { IntelligenceDetailDialog } = await import("./views/IntelligenceDetailDialog");

/* ------------------------------------------------------------------ */
/*  IntelligenceCard — meta tags (task pill + platform icon)                */
/* ------------------------------------------------------------------ */

describe("IntelligenceCard meta tags", () => {
  it("renders separate task tag and platform icon tag in the header", () => {
    const item = makeAnalysisEvent({ sourcePlatform: "telegram", taskName: "Task A" });
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(IntelligenceCard, {
          item,
          isRead: false,
          isConsumed: false,
          onAutoRead: vi.fn(),
          onClick: vi.fn(),
        }),
      );
    });

    const taskTag = container.querySelector(".im-intelligence-card-task-tag");
    expect(taskTag?.textContent).toBe("Task A");
    expect(taskTag?.className).toContain("text-[9px]");

    const platformTag = container.querySelector(".im-intelligence-card-platform-tag");
    expect(platformTag).toBeTruthy();
    expect(platformTag?.getAttribute("aria-label")).toBe("Telegram");
    expect(platformTag?.querySelector("svg")).toBeTruthy();
    expect(container.textContent).not.toContain("Task A · Telegram");
    const stack = container.querySelector(
      '[data-testid="intel-event-avatar-stack"]',
    ) as HTMLElement | null;
    const intel = container.querySelector(
      '[data-testid="intel-event-mark"]',
    ) as HTMLElement | null;
    const taskMark = container.querySelector(
      '[data-testid="intel-event-task-badge"] [data-testid="task-logo-mark"]',
    ) as HTMLElement | null;
    expect(stack?.getAttribute("aria-label")).toBe("情報事件與任務標記");
    expect(intel?.style.width).toBe("38px");
    expect(taskMark?.style.width).toBe("18px");
    expect(intel?.querySelector("svg")?.classList.contains("lucide-radar")).toBe(true);
    expect(taskMark?.querySelector("svg")?.classList.contains("lucide-list-checks")).toBe(true);
    expect(container.querySelector('[data-testid="card-title-icon"]')).toBeNull();
    expect(container.querySelector('[data-testid="task-avatar-stack"]')).toBeNull();
    expect(container.querySelector('[data-testid="task-avatar-ai-badge"]')).toBeNull();
  });

  it("does not render platform tag when sourcePlatform is null", () => {
    const item = makeAnalysisEvent({ sourcePlatform: null, taskName: "Task A" });
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(IntelligenceCard, {
          item,
          isRead: false,
          isConsumed: false,
          onAutoRead: vi.fn(),
          onClick: vi.fn(),
        }),
      );
    });

    expect(container.querySelector(".im-intelligence-card-task-tag")?.textContent).toBe("Task A");
    expect(container.querySelector(".im-intelligence-card-platform-tag")).toBeNull();
    expect(container.textContent).not.toContain("Telegram");
  });

  it("does not render platform tag when sourcePlatform is empty string", () => {
    const item = makeAnalysisEvent({ sourcePlatform: "", taskName: "Task A" });
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(IntelligenceCard, {
          item,
          isRead: false,
          isConsumed: false,
          onAutoRead: vi.fn(),
          onClick: vi.fn(),
        }),
      );
    });

    expect(container.querySelector(".im-intelligence-card-platform-tag")).toBeNull();
    expect(container.querySelector(".im-intelligence-card-task-tag")?.textContent).toBe("Task A");
  });

  it("uses aria-label for rss platform icon tag", () => {
    const item = makeAnalysisEvent({ sourcePlatform: "rss", taskName: "Feed Task" });
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(IntelligenceCard, {
          item,
          isRead: false,
          isConsumed: false,
          onAutoRead: vi.fn(),
          onClick: vi.fn(),
        }),
      );
    });

    expect(container.querySelector(".im-intelligence-card-task-tag")?.textContent).toBe("Feed Task");
    expect(container.querySelector(".im-intelligence-card-platform-tag")?.getAttribute("aria-label")).toBe("RSS");
  });

  it("shows unread dot and medium-weight title when not read", () => {
    const item = makeAnalysisEvent({
      title: "Test Item",
      sourcePlatform: "telegram",
      taskName: "Task A",
    });
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(IntelligenceCard, {
          item,
          isRead: false,
          isConsumed: false,
          onAutoRead: vi.fn(),
          onClick: vi.fn(),
        }),
      );
    });

    expect(container.querySelector('[aria-label="未讀"]')).toBeTruthy();
    const title = Array.from(container.querySelectorAll("div")).find(
      (el) => el.textContent === "Test Item" && el.children.length === 0,
    );
    expect(title?.className).toContain("font-medium");
    expect(title?.className).not.toContain("font-semibold");
  });

  it("hides unread dot and keeps medium-weight title when read", () => {
    const item = makeAnalysisEvent({
      title: "Test Item",
      sourcePlatform: "telegram",
      taskName: "Task A",
    });
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(IntelligenceCard, {
          item,
          isRead: true,
          isConsumed: true,
          onAutoRead: vi.fn(),
          onClick: vi.fn(),
        }),
      );
    });

    expect(container.querySelector('[aria-label="未讀"]')).toBeNull();
    const title = Array.from(container.querySelectorAll("div")).find(
      (el) => el.textContent === "Test Item" && el.children.length === 0,
    );
    expect(title?.className).toContain("font-medium");
    expect(title?.className).not.toContain("font-semibold");
  });
});

/* ------------------------------------------------------------------ */
/*  IntelligenceRow — platform badge                                        */
/* ------------------------------------------------------------------ */

describe("IntelligenceRow platform badge", () => {
  it("renders platform info in source meta when sourcePlatform is provided", () => {
    const item = makeAnalysisEvent({ sourcePlatform: "telegram" });
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(IntelligenceRow, {
          item,
          isRead: false,
          isConsumed: false,
          onAutoRead: vi.fn(),
          onClick: vi.fn(),
        }),
      );
    });

    // IntelligenceRow shows platform via buildIntelligenceSourceMeta which includes the platform label
    expect(container.textContent).toContain("Telegram");
  });

  it("does not show platform label when sourcePlatform is null", () => {
    const item = makeAnalysisEvent({ sourcePlatform: null });
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(IntelligenceRow, {
          item,
          isRead: false,
          isConsumed: false,
          onAutoRead: vi.fn(),
          onClick: vi.fn(),
        }),
      );
    });

    // Without sourcePlatform, the source meta should not contain platform labels
    expect(container.textContent).not.toContain("Telegram");
    expect(container.textContent).not.toContain("RSS");
    expect(container.textContent).not.toContain("API");
  });

  it("renders source meta with rss platform label", () => {
    const item = makeAnalysisEvent({ sourcePlatform: "rss", sourceChannelName: "Tech Feed" });
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(IntelligenceRow, {
          item,
          isRead: false,
          isConsumed: false,
          onAutoRead: vi.fn(),
          onClick: vi.fn(),
        }),
      );
    });

    expect(container.textContent).toContain("RSS");
    expect(container.textContent).toContain("Tech Feed");
  });
});

/* ------------------------------------------------------------------ */
/*  IntelligenceCard — title attributes (Req 8.3)                           */
/* ------------------------------------------------------------------ */

describe("IntelligenceCard title attributes", () => {
  it("has title attribute on content element", () => {
    const item = makeAnalysisEvent({ body: "Important insight about market trends" });
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(IntelligenceCard, {
          item,
          isRead: false,
          isConsumed: false,
          onAutoRead: vi.fn(),
          onClick: vi.fn(),
        }),
      );
    });

    // Find the element that contains the content text and has a title attribute
    const elements = container.querySelectorAll("[title]");
    const contentEl = Array.from(elements).find(
      (el) => el.getAttribute("title") === "Important insight about market trends",
    );
    expect(contentEl).toBeTruthy();
    expect(contentEl!.textContent).toBe("Important insight about market trends");
  });
});

/* ------------------------------------------------------------------ */
/*  IntelligenceRow — title attributes (Req 8.3)                            */
/* ------------------------------------------------------------------ */

describe("IntelligenceRow title attributes", () => {
  it("has title attribute on content span", () => {
    const item = makeAnalysisEvent({ body: "Key finding from analysis" });
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(IntelligenceRow, {
          item,
          isRead: false,
          isConsumed: false,
          onAutoRead: vi.fn(),
          onClick: vi.fn(),
        }),
      );
    });

    const spans = container.querySelectorAll("span");
    const contentSpan = Array.from(spans).find(
      (s) => s.getAttribute("title") === "Key finding from analysis",
    );
    expect(contentSpan).toBeTruthy();
    expect(contentSpan!.textContent).toBe("Key finding from analysis");
  });
});


/* ------------------------------------------------------------------ */
/*  IntelligenceDetailDialog — coordinate display (Req 6.2, 6.3)           */
/* ------------------------------------------------------------------ */

describe("IntelligenceDetailDialog coordinate display", () => {
  let mount: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    mount = document.createElement("div");
    document.body.appendChild(mount);
    root = createRoot(mount);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    mount.remove();
  });

  it("shows location with coordinates when latitude and longitude are mappable", () => {
    const item = makeAnalysisEvent({
      location: "台北",
      latitude: 25.033,
      longitude: 121.5654,
    });
    act(() => {
      root.render(
        createElement(
          MemoryRouter,
          null,
          createElement(IntelligenceDetailDialog, {
            item,
            onClose: vi.fn(),
          }),
        ),
      );
    });

    const dialog = document.body.querySelector(".im-material-panel");
    expect(dialog?.textContent).toContain("位置");
    expect(dialog?.textContent).toContain("台北");
    expect(dialog?.textContent).toContain("25.0330, 121.5654");
    expect(dialog?.textContent).not.toContain("座標");
  });

  it("shows 無具體地理位置 when only 0,0 / N/A place data exists", () => {
    const item = makeAnalysisEvent({
      location: "N/A",
      latitude: 0,
      longitude: 0,
    });
    act(() => {
      root.render(
        createElement(
          MemoryRouter,
          null,
          createElement(IntelligenceDetailDialog, {
            item,
            onClose: vi.fn(),
          }),
        ),
      );
    });

    const dialog = document.body.querySelector(".im-material-panel");
    expect(dialog?.textContent).toContain("無具體地理位置（不上地圖）");
    expect(dialog?.textContent).not.toContain("0.0000");
  });

  it("says the model did not bind a source when sourceMessageId is missing", () => {
    act(() => {
      root.render(
        createElement(
          MemoryRouter,
          null,
          createElement(IntelligenceDetailDialog, {
            item: makeAnalysisEvent({ sourceMessageId: null }),
            onClose: vi.fn(),
          }),
        ),
      );
    });

    expect(document.body.querySelector('[data-testid="intel-source-unbound"]')).not.toBeNull();
    expect(document.body.textContent).toContain("模型沒有綁定來源訊息");
  });
});

describe("IntelligenceCard dual avatar", () => {
  it("keeps Radar large and overlays a picked task emoji, not the AI head", () => {
    const item = makeAnalysisEvent({ taskId: "task-ops", taskName: "Ops Task", emoji: "🎯" });
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(IntelligenceCard, {
          item,
          isRead: false,
          isConsumed: false,
          onAutoRead: vi.fn(),
        }),
      );
    });
    const intel = container.querySelector('[data-testid="intel-event-mark"]');
    const badge = container.querySelector('[data-testid="intel-event-task-badge"]');
    expect(intel?.querySelector("svg")?.classList.contains("lucide-radar")).toBe(true);
    expect(intel?.textContent).not.toContain("🎯");
    expect(badge?.textContent).toContain("🎯");
    expect(container.querySelector('[data-testid="task-avatar-ai-badge"]')).toBeNull();
  });
});

describe("IntelligenceDetailDialog dual avatar", () => {
  let mount: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    mount = document.createElement("div");
    document.body.appendChild(mount);
    root = createRoot(mount);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    mount.remove();
  });

  it("uses intel Radar large + task ListChecks small beside the title", () => {
    act(() => {
      root.render(
        createElement(
          MemoryRouter,
          null,
          createElement(IntelligenceDetailDialog, {
            item: makeAnalysisEvent({ title: "詳情標題", taskId: "task-1" }),
            onClose: vi.fn(),
          }),
        ),
      );
    });
    const dialog = document.body.querySelector(".im-material-panel");
    const stack = dialog?.querySelector('[data-testid="intel-event-avatar-stack"]') as HTMLElement | null;
    const intel = dialog?.querySelector('[data-testid="intel-event-mark"]') as HTMLElement | null;
    const taskMark = dialog?.querySelector(
      '[data-testid="intel-event-task-badge"] [data-testid="task-logo-mark"]',
    ) as HTMLElement | null;
    expect(stack?.getAttribute("aria-label")).toBe("情報事件與任務標記");
    expect(intel?.style.width).toBe("38px");
    expect(taskMark?.style.width).toBe("18px");
    expect(intel?.querySelector("svg")?.classList.contains("lucide-radar")).toBe(true);
    expect(taskMark?.querySelector("svg")?.classList.contains("lucide-list-checks")).toBe(true);
    expect(dialog?.textContent).toContain("詳情標題");
  });
});
