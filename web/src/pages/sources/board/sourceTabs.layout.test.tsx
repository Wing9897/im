/**
 * Parameterized SourceTabLayout integration tests for Rss|Email|Http|Mqtt|Discord tabs.
 */
import { act, type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  discordState,
  emailState,
  httpState,
  makeSource,
  makeBot,
  makeBroker,
  makeFeed,
  makeHttpSource,
  makeMailbox,
  mqttState,
  rssState,
} from "../../../test/sourceTabLayoutFixtures";
import {
  getTestContainer,
  renderInIsolatedContainer,
  renderSourceTab,
  setupSourceTabTestHarness,
  teardownSourceTabTestHarness,
} from "../../../test/sourceTabLayoutHarness";
import { mockShowToast } from "../../../test/context-mocks";
import { INITIAL_HTTP_FORM } from "../http/httpFormTypes";

const {
  mockUseRssTab,
  mockUseEmailTab,
  mockUseHttpTab,
  mockUseMqttTab,
  mockUseDiscordTab,
} = vi.hoisted(() => ({
  mockUseRssTab: vi.fn(),
  mockUseEmailTab: vi.fn(),
  mockUseHttpTab: vi.fn(),
  mockUseMqttTab: vi.fn(),
  mockUseDiscordTab: vi.fn(),
}));

vi.mock("../rss/useRssTab", () => ({ useRssTab: mockUseRssTab }));
vi.mock("../email/useEmailTab", () => ({ useEmailTab: mockUseEmailTab }));
vi.mock("../http/useHttpTab", () => ({ useHttpTab: mockUseHttpTab }));
vi.mock("../mqtt/useMqttTab", () => ({ useMqttTab: mockUseMqttTab }));
vi.mock("../discord/useDiscordTab", () => ({ useDiscordTab: mockUseDiscordTab }));

vi.mock("../../../hooks/useFocusTrap", () => ({
  useFocusTrap: () => ({ current: null }),
}));
vi.mock("../../../context/ToastContext", async () =>
  (await import("../../../test/context-mocks")).toastContextModuleMock());

import { DiscordTab } from "../discord/DiscordTab";
import { EmailTab } from "../email/EmailTab";
import { HttpTab } from "../http/HttpTab";
import { MqttTab } from "../mqtt/MqttTab";
import { RssTab } from "../rss/RssTab";

type TabCase = {
  name: string;
  Tab: () => ReactElement;
  mockHook: { mockReset: () => void; mockReturnValue: (v: unknown) => void };
  emptyState: () => unknown;
  emptyExpect: {
    addLabel: string;
    emptyLabel: string;
    listLabel: string;
    extraTexts?: string[];
    selector?: string;
  };
  twoItemsState: () => unknown;
  twoItemLabels: [string, string];
  removeState: () => unknown;
  removeTitle: string;
  removeBody: string;
};

const TAB_CASES: TabCase[] = [
  {
    name: "RssTab",
    Tab: RssTab,
    mockHook: mockUseRssTab,
    emptyState: () => rssState(),
    emptyExpect: {
      addLabel: "新增 RSS Feed",
      emptyLabel: "尚未新增任何 RSS Feed",
      listLabel: "已新增 RSS Feeds",
      extraTexts: ["自訂 RSS"],
      selector: "#rss-provider-select",
    },
    twoItemsState: () =>
      rssState({
        feeds: [
          makeFeed({ source: makeSource({ id: "f1", name: "Feed One" }) }),
          makeFeed({ source: makeSource({ id: "f2", name: "Feed Two" }) }),
        ],
      }),
    twoItemLabels: ["Feed One", "Feed Two"],
    removeState: () => {
      const feed = makeFeed({ source: makeSource({ id: "f1", name: "Feed One" }) });
      return rssState({ feeds: [feed], removeTarget: feed });
    },
    removeTitle: "確認移除 RSS Feed",
    removeBody: "確定要移除「Feed One」嗎？移除後將停止輪詢此 Feed。",
  },
  {
    name: "EmailTab",
    Tab: EmailTab,
    mockHook: mockUseEmailTab,
    emptyState: () => emailState(),
    emptyExpect: {
      addLabel: "新增 Email 信箱",
      emptyLabel: "尚未新增任何 Email 信箱",
      listLabel: "已新增 Email 信箱",
    },
    twoItemsState: () =>
      emailState({
        mailboxes: [
          makeMailbox({ username: "one@gmail.com" }),
          makeMailbox({
            source: makeSource({ id: "email-2", platform: "email", name: "two@gmail.com" }),
            username: "two@gmail.com",
          }),
        ],
      }),
    twoItemLabels: ["one@gmail.com", "two@gmail.com"],
    removeState: () => {
      const mailbox = makeMailbox({ username: "user@gmail.com" });
      return emailState({ mailboxes: [mailbox], removeTarget: mailbox });
    },
    removeTitle: "確認移除 Email 信箱",
    removeBody: "確定要移除「user@gmail.com」嗎？移除後將停止輪詢此信箱。",
  },
  {
    name: "HttpTab",
    Tab: HttpTab,
    mockHook: mockUseHttpTab,
    emptyState: () => httpState(),
    emptyExpect: {
      addLabel: "新增定時抓取",
      emptyLabel: "尚未設定定時抓取",
      listLabel: "已設定的定時抓取",
      selector: "#http-add-url",
    },
    twoItemsState: () =>
      httpState({
        sources: [
          makeHttpSource({
            source: makeSource({ id: "h1", platform: "http", name: "HTTP 1" }),
            url: "https://one.example.com",
          }),
          makeHttpSource({
            source: makeSource({ id: "h2", platform: "http", name: "HTTP 2" }),
            url: "https://two.example.com",
          }),
        ],
      }),
    twoItemLabels: ["HTTP 1", "HTTP 2"],
    removeState: () => {
      const source = makeHttpSource({
        source: makeSource({ id: "h1", platform: "http", name: "HTTP 1" }),
        url: "https://one.example.com",
      });
      return httpState({ sources: [source], removeTarget: source });
    },
    removeTitle: "確認移除定時抓取",
    removeBody: "確定要移除「HTTP 1」嗎？",
  },
  {
    name: "MqttTab",
    Tab: MqttTab,
    mockHook: mockUseMqttTab,
    emptyState: () => mqttState(),
    emptyExpect: {
      addLabel: "新增 MQTT Broker",
      emptyLabel: "尚未新增任何 MQTT Broker",
      listLabel: "已新增 MQTT Brokers",
    },
    twoItemsState: () =>
      mqttState({
        sources: [
          makeBroker({
            source: makeSource({ id: "m1", platform: "mqtt", name: "MQTT 1" }),
            brokerUrl: "mqtt://one.example.com:1883",
          }),
          makeBroker({
            source: makeSource({ id: "m2", platform: "mqtt", name: "MQTT 2" }),
            brokerUrl: "mqtt://two.example.com:1883",
          }),
        ],
      }),
    twoItemLabels: ["mqtt://one.example.com:1883", "mqtt://two.example.com:1883"],
    removeState: () => {
      const broker = makeBroker({
        source: makeSource({ id: "m1", platform: "mqtt", name: "MQTT 1" }),
        brokerUrl: "mqtt://one.example.com:1883",
      });
      return mqttState({ sources: [broker], removeTarget: broker });
    },
    removeTitle: "確認移除 MQTT Broker",
    removeBody: "確定要移除「mqtt://one.example.com:1883」嗎？移除後將停止訂閱此 Broker。",
  },
  {
    name: "DiscordTab",
    Tab: DiscordTab,
    mockHook: mockUseDiscordTab,
    emptyState: () => discordState(),
    emptyExpect: {
      addLabel: "新增 Discord Bot",
      emptyLabel: "尚未新增任何 Discord Bot",
      listLabel: "已連線 Discord Bots",
    },
    twoItemsState: () =>
      discordState({
        bots: [
          makeBot({ source: makeSource({ id: "b1", name: "Bot One" }) }),
          makeBot({ source: makeSource({ id: "b2", name: "Bot Two" }) }),
        ],
      }),
    twoItemLabels: ["Bot One", "Bot Two"],
    removeState: () => {
      const bot = makeBot({ source: makeSource({ id: "b1", name: "Bot One" }) });
      return discordState({ bots: [bot], removeTarget: bot });
    },
    removeTitle: "確認移除 Discord Bot",
    removeBody: "確定要移除「Bot One」嗎？移除後將停止監控此 Bot 的頻道。",
  },
];

describe.each(TAB_CASES)("$name via SourceTabLayout", ({
  Tab,
  mockHook,
  emptyState,
  emptyExpect,
  twoItemsState,
  twoItemLabels,
  removeState,
  removeTitle,
  removeBody,
}) => {
  beforeEach(async () => {
    await setupSourceTabTestHarness();
    mockHook.mockReset();
    mockShowToast.mockReset();
  });

  afterEach(() => {
    teardownSourceTabTestHarness();
  });

  it("renders the add form and empty state when no items", () => {
    mockHook.mockReturnValue(emptyState());
    renderSourceTab(Tab);

    const container = getTestContainer();
    expect(container.textContent).toContain(emptyExpect.addLabel);
    expect(container.textContent).toContain(emptyExpect.emptyLabel);
    expect(container.textContent).toContain(emptyExpect.listLabel);
    expect(container.querySelector(".sources-count-badge")?.textContent).toBe("0");
    for (const text of emptyExpect.extraTexts ?? []) {
      expect(container.textContent).toContain(text);
    }
    if (emptyExpect.selector) {
      expect(container.querySelector(emptyExpect.selector)).not.toBeNull();
    }
  });

  it("renders one card per item with the count suffix", () => {
    mockHook.mockReturnValue(twoItemsState());
    renderSourceTab(Tab);

    const container = getTestContainer();
    expect(container.querySelector(".sources-count-badge")?.textContent).toBe("2");
    expect(container.textContent).toContain(twoItemLabels[0]);
    expect(container.textContent).toContain(twoItemLabels[1]);
    expect(container.textContent).not.toContain(emptyExpect.emptyLabel);
  });

  it("renders the remove-confirmation dialog when a remove target is set", () => {
    mockHook.mockReturnValue(removeState());
    renderSourceTab(Tab);

    expect(document.body.textContent).toContain(removeTitle);
    expect(document.body.textContent).toContain(removeBody);
  });
});

describe("RssTab layout specifics", () => {
  beforeEach(async () => {
    await setupSourceTabTestHarness();
    mockUseRssTab.mockReset();
    mockShowToast.mockReset();
  });

  afterEach(() => {
    teardownSourceTabTestHarness();
  });

  it("shows the loading skeleton and hides count/empty while loading", () => {
    mockUseRssTab.mockReturnValue(rssState({ initialLoading: true }));
    renderSourceTab(RssTab);

    const container = getTestContainer();
    expect(container.querySelector('[role="status"][aria-label="載入內容中"]')).toBeTruthy();
    expect(container.querySelector(".sources-count-badge")).toBeNull();
    expect(container.textContent).not.toContain("尚未新增任何 RSS Feed");
  });

  it("shows a toast instead of an error retry banner when error is set", () => {
    mockUseRssTab.mockReturnValue(rssState({ error: "載入失敗" }));
    renderSourceTab(RssTab);

    expect(mockShowToast).toHaveBeenCalledWith("載入失敗", "error");
    expect(getTestContainer().textContent).not.toContain("載入失敗");
  });

  it.each([0, 1, 2, 5])("renders exactly N cards and the (N) count suffix for feed count %i", (n) => {
    const feeds = Array.from({ length: n }, (_, i) =>
      makeFeed({
        source: makeSource({ id: `f-${i}`, name: `Feed ${i}` }),
        feedUrl: `https://example.com/feed-${i}.xml`,
      }),
    );
    mockUseRssTab.mockReturnValue(rssState({ feeds }));

    const { container, unmount } = renderInIsolatedContainer(RssTab);

    expect(container.querySelector(".sources-count-badge")?.textContent).toBe(String(n));
    const hasEmpty = container.textContent?.includes("尚未新增任何 RSS Feed");
    expect(hasEmpty).toBe(n === 0);
    for (let i = 0; i < n; i++) {
      expect(container.textContent).toContain(`Feed ${i}`);
    }

    unmount();
  });
});

describe("EmailTab layout specifics", () => {
  beforeEach(async () => {
    await setupSourceTabTestHarness();
    mockUseEmailTab.mockReset();
  });

  afterEach(() => {
    teardownSourceTabTestHarness();
  });

  it("opens a detail dialog when a mailbox card is clicked", async () => {
    const mailbox = makeMailbox({
      username: "detail@gmail.com",
      imapHost: "imap.gmail.com",
      folders: ["INBOX", "Promotions"],
    });
    mockUseEmailTab.mockReturnValue(emailState({ mailboxes: [mailbox] }));
    renderSourceTab(EmailTab);

    const card = getTestContainer().querySelector('[aria-label="查看詳情：detail@gmail.com"]');
    expect(card).toBeTruthy();

    act(() => {
      card!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });

    expect(document.body.textContent).toContain("IMAP 連線");
    expect(document.body.textContent).toContain("imap.gmail.com");
    expect(document.body.textContent).toContain("INBOX");
    expect(document.body.textContent).toContain("Promotions");
  });
});

describe("HttpTab layout specifics", () => {
  beforeEach(async () => {
    await setupSourceTabTestHarness();
    mockUseHttpTab.mockReset();
  });

  afterEach(() => {
    teardownSourceTabTestHarness();
  });

  it("disables submit when URL is empty", () => {
    mockUseHttpTab.mockReturnValue(httpState());
    renderSourceTab(HttpTab);

    const submit = Array.from(getTestContainer().querySelectorAll("button")).find((btn) =>
      (btn.textContent || "").includes("新增定時抓取"),
    );
    expect(submit).toBeTruthy();
    expect(submit?.hasAttribute("disabled")).toBe(true);
  });

  it("enables submit when URL is present", () => {
    mockUseHttpTab.mockReturnValue(
      httpState({
        form: { ...INITIAL_HTTP_FORM, url: "https://example.com/api" },
      }),
    );
    renderSourceTab(HttpTab);

    const submit = Array.from(getTestContainer().querySelectorAll("button")).find((btn) =>
      (btn.textContent || "").includes("新增定時抓取"),
    );
    expect(submit?.hasAttribute("disabled")).toBe(false);
  });
});

describe("MqttTab layout specifics", () => {
  beforeEach(async () => {
    await setupSourceTabTestHarness();
    mockUseMqttTab.mockReset();
  });

  afterEach(() => {
    teardownSourceTabTestHarness();
  });

  it("renders the topic editor inside the add form", () => {
    mockUseMqttTab.mockReturnValue(mqttState());
    renderSourceTab(MqttTab);

    expect(getTestContainer().textContent).toContain("訂閱主題");
  });
});
