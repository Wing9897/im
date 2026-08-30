import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CalendarShareConnectionStatusIcon } from "./CalendarShareConnectionStatusIcon";
import { ensureZhHantLocale, i18n, wrapWithI18n } from "../../test/i18nHarness";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("CalendarShareConnectionStatusIcon", () => {
  let mount: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    await ensureZhHantLocale();
    mockNavigate.mockReset();
    mount = document.createElement("div");
    document.body.appendChild(mount);
    root = createRoot(mount);
  });

  afterEach(() => {
    act(() => root.unmount());
    mount.remove();
  });

  function renderIcon(
    availability: "ok" | "loggedOut" | "offline",
    loggedOutTitle?: string,
  ) {
    act(() => {
      root.render(
        wrapWithI18n(
          createElement(
            MemoryRouter,
            null,
            createElement(CalendarShareConnectionStatusIcon, { availability, loggedOutTitle }),
          ),
        ),
      );
    });
  }

  it("maps the three availability states to data-availability and tooltips", () => {
    renderIcon("loggedOut");
    let btn = mount.querySelector('[data-testid="calendar-share-connection-status"]') as HTMLButtonElement;
    expect(btn.getAttribute("data-availability")).toBe("loggedOut");
    expect(btn.getAttribute("title")).toContain(i18n.t("subscriptions:filter.loggedOut"));

    renderIcon("offline");
    btn = mount.querySelector('[data-testid="calendar-share-connection-status"]') as HTMLButtonElement;
    expect(btn.getAttribute("data-availability")).toBe("offline");
    expect(btn.getAttribute("title")).toContain(i18n.t("subscriptions:filter.offline"));

    renderIcon("ok");
    btn = mount.querySelector('[data-testid="calendar-share-connection-status"]') as HTMLButtonElement;
    expect(btn.getAttribute("data-availability")).toBe("ok");
    expect(btn.getAttribute("title")).toContain(i18n.t("subscriptions:connectionIcon.ok"));
  });

  it("uses a custom logged-out tooltip on subscriptions pages", () => {
    const custom = "請先登入日曆分享服務，才能加入訂閱。";
    renderIcon("loggedOut", custom);
    const btn = mount.querySelector('[data-testid="calendar-share-connection-status"]') as HTMLButtonElement;
    expect(btn.getAttribute("title")).toContain(custom);
  });

  it("navigates to the calendar-share account tab on click", () => {
    renderIcon("loggedOut");
    const btn = mount.querySelector('[data-testid="calendar-share-connection-status"]') as HTMLButtonElement;
    act(() => btn.click());
    expect(mockNavigate).toHaveBeenCalledWith("/subscriptions/account");
  });
});
