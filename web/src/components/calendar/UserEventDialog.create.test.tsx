/**
 * UserEventDialog create / finance / recurring submit.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import { UserEventDialog } from "./UserEventDialog";
import { setInputValue } from "./UserEventDialog.testHarness";

describe("UserEventDialog create", () => {
  let root: Root | null = null;

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
  });

  it("renders create title and submits trimmed values with default __general__ workset", async () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();
    const host = document.createElement("div");
    document.body.appendChild(host);

    await act(async () => {
      root = createRoot(host);
      root.render(
        createElement(UserEventDialog, {
          open: true,
          mode: "create",
          worksetOptions: [
            { id: "ct-1", name: "日曆任務" },
            { id: "evt-1", name: "事件任務" },
          ],
          onClose,
          onSubmit,
        }),
      );
    });

    // ModalDialog portals into document.body
    expect(document.body.textContent).toContain("新增事件");
    const titleInput = document.body.querySelector(
      'input[aria-label="標題"]',
    ) as HTMLInputElement;
    expect(titleInput).toBeTruthy();

    const worksetTrigger = document.body.querySelector(
      '[data-testid="user-event-workset-select-value"]',
    ) as HTMLButtonElement;
    expect(worksetTrigger).toBeTruthy();
    expect(worksetTrigger.textContent).toContain("一般");

    await act(async () => {
      setInputValue(titleInput, "  測試  ");
    });

    const startInput = document.body.querySelector(
      '[data-testid="user-event-start"]',
    ) as HTMLInputElement | null;
    if (startInput) {
      await act(async () => {
        setInputValue(startInput, "2026-07-21T09:00");
      });
    }

    const buttons = Array.from(document.body.querySelectorAll("button"));
    const submit = buttons.find((b) => b.textContent === "新增");
    expect(submit).toBeTruthy();
    await act(async () => {
      submit!.click();
    });

    expect(onSubmit).toHaveBeenCalled();
    const arg = onSubmit.mock.calls[0][0];
    expect(arg.kind).toBe("one_off");
    expect(arg.title).toBe("測試");
    expect(arg.startTime).toBeTruthy();
    expect(arg.worksetId).toBe(SYSTEM_WORKSET_ID);
    expect(arg.isAllDay).toBe(false);
    expect(arg.taskId).toBeUndefined();
    expect(arg.amountInput).toBe("");
    expect(arg.direction).toBe("expense");
    expect(arg.calendarKind).toBe("normal");
    expect(arg.notifyPref).toBe("off");

    expect(document.body.querySelector('[data-testid="user-event-item-select"]')).toBeNull();
    expect(document.body.querySelector('[data-testid="user-event-parent-item"]')).toBeNull();

    host.remove();
  });

  it("defaults the notify checkbox to unchecked (notifyPref off)", async () => {
    const onSubmit = vi.fn();
    const host = document.createElement("div");
    document.body.appendChild(host);

    await act(async () => {
      root = createRoot(host);
      root.render(
        createElement(UserEventDialog, {
          open: true,
          mode: "create",
          onClose: vi.fn(),
          onSubmit,
        }),
      );
    });

    expect(document.body.querySelector('[data-testid="notify-pref-field"]')).toBeTruthy();
    expect(document.body.textContent).toContain("通知");
    expect(document.body.textContent).toContain("提前天數");
    expect(document.body.textContent).not.toContain("提前提醒");
    const remind = document.body.querySelector('[data-testid="user-event-remind-before"]');
    expect(remind?.className).toContain("w-24");
    const titleInput = document.body.querySelector(
      'input[aria-label="標題"]',
    ) as HTMLInputElement;
    await act(async () => {
      setInputValue(titleInput, "靜音提醒");
    });
    const startInput = document.body.querySelector(
      '[data-testid="user-event-start"]',
    ) as HTMLInputElement | null;
    if (startInput) {
      await act(async () => {
        setInputValue(startInput, "2026-07-21T09:00");
      });
    }
    const toggle = document.body.querySelector('[data-testid="notify-pref-field"]');
    expect(toggle?.getAttribute("role")).toBe("switch");
    expect(toggle?.getAttribute("aria-checked")).toBe("false");
    const submit = Array.from(document.body.querySelectorAll("button")).find(
      (btn) => btn.textContent === "新增",
    );
    await act(async () => {
      submit!.click();
    });
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "one_off", notifyPref: "off" }),
    );
    host.remove();
  });

  it("checking notify submits notifyPref inherit", async () => {
    const onSubmit = vi.fn();
    const host = document.createElement("div");
    document.body.appendChild(host);

    await act(async () => {
      root = createRoot(host);
      root.render(
        createElement(UserEventDialog, {
          open: true,
          mode: "create",
          onClose: vi.fn(),
          onSubmit,
        }),
      );
    });

    const titleInput = document.body.querySelector(
      'input[aria-label="標題"]',
    ) as HTMLInputElement;
    await act(async () => {
      setInputValue(titleInput, "要通知");
    });
    const startInput = document.body.querySelector(
      '[data-testid="user-event-start"]',
    ) as HTMLInputElement | null;
    if (startInput) {
      await act(async () => {
        setInputValue(startInput, "2026-07-21T09:00");
      });
    }
    const toggle = document.body.querySelector('[data-testid="notify-pref-field"]');
    expect(toggle?.getAttribute("aria-checked")).toBe("false");
    await act(async () => {
      (toggle as HTMLElement).click();
    });
    const submit = Array.from(document.body.querySelectorAll("button")).find(
      (btn) => btn.textContent === "新增",
    );
    await act(async () => {
      submit!.click();
    });
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "one_off", notifyPref: "inherit" }),
    );
    host.remove();
  });

  it("preserves initial notifyPref off on submit", async () => {
    const onSubmit = vi.fn();
    const host = document.createElement("div");
    document.body.appendChild(host);

    await act(async () => {
      root = createRoot(host);
      root.render(
        createElement(UserEventDialog, {
          open: true,
          mode: "create",
          initial: {
            title: "靜音",
            startTime: "2026-07-21T09:00",
            notifyPref: "off",
          },
          onClose: vi.fn(),
          onSubmit,
        }),
      );
    });

    const submit = Array.from(document.body.querySelectorAll("button")).find(
      (btn) => btn.textContent === "新增",
    );
    await act(async () => {
      submit!.click();
    });
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ notifyPref: "off" }),
    );
    host.remove();
  });

  it("hides finance fields for title Purchased when calendarKind is normal", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);

    await act(async () => {
      root = createRoot(host);
      root.render(
        createElement(UserEventDialog, {
          open: true,
          mode: "create",
          initial: { title: "購入", kind: "one_off", calendarKind: "normal" },
          onClose: vi.fn(),
          onSubmit: vi.fn(),
        }),
      );
    });

    expect(document.body.querySelector('[data-testid="user-event-finance-fields"]')).toBeNull();
    expect(
      document.body.querySelector('[data-testid="user-event-calendar-kind-banner"]'),
    ).toBeNull();
    host.remove();
  });

  it("shows special calendar-kind badge and keeps kind when title is renamed", async () => {
    const onSubmit = vi.fn();
    const host = document.createElement("div");
    document.body.appendChild(host);

    await act(async () => {
      root = createRoot(host);
      root.render(
        createElement(UserEventDialog, {
          open: true,
          mode: "edit",
          worksetMode: "hidden",
          parentItemMode: "readonly",
          initial: {
            title: "到期",
            kind: "one_off",
            calendarKind: "expires",
            itemId: "item-1",
            isAllDay: true,
            startTime: "2026-08-10",
            endTime: "2026-08-10",
          },
          onClose: vi.fn(),
          onSubmit,
        }),
      );
    });

    expect(
      document.body.querySelector('[data-testid="user-event-calendar-kind-badge-expires"]'),
    ).toBeTruthy();
    expect(document.querySelector('[data-testid="user-event-item-select"]')).toBeNull();
    const titleInput = document.body.querySelector(
      'input[aria-label="標題"]',
    ) as HTMLInputElement;
    expect(titleInput).toBeTruthy();
    expect(titleInput.readOnly).toBe(false);
    expect(titleInput.disabled).toBe(false);

    await act(async () => {
      setInputValue(titleInput, "保修到期");
    });

    const submit = Array.from(document.body.querySelectorAll("button")).find(
      (b) => b.textContent === "儲存",
    );
    expect(submit).toBeTruthy();
    await act(async () => {
      submit!.click();
    });

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "保修到期",
        calendarKind: "expires",
      }),
    );

    host.remove();
  });

  it("keeps purchase finance visible after renaming away from preset title", async () => {
    const onSubmit = vi.fn();
    const host = document.createElement("div");
    document.body.appendChild(host);

    await act(async () => {
      root = createRoot(host);
      root.render(
        createElement(UserEventDialog, {
          open: true,
          mode: "edit",
          worksetMode: "hidden",
          initial: {
            title: "購入",
            kind: "one_off",
            calendarKind: "purchase_effective",
            amountInput: "42",
            direction: "expense",
            startTime: "2026-08-10T10:00",
          },
          onClose: vi.fn(),
          onSubmit,
        }),
      );
    });

    expect(
      document.body.querySelector(
        '[data-testid="user-event-calendar-kind-badge-purchase-effective"]',
      ),
    ).toBeTruthy();
    expect(document.body.querySelector('[data-testid="user-event-finance-fields"]')).toBeTruthy();

    const titleInput = document.body.querySelector(
      'input[aria-label="標題"]',
    ) as HTMLInputElement;
    await act(async () => {
      setInputValue(titleInput, "双十一相机");
    });
    expect(document.body.querySelector('[data-testid="user-event-finance-fields"]')).toBeTruthy();

    const submit = Array.from(document.body.querySelectorAll("button")).find(
      (b) => b.textContent === "儲存",
    );
    await act(async () => {
      submit!.click();
    });

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "双十一相机",
        calendarKind: "purchase_effective",
        amountInput: "42",
        direction: "expense",
      }),
    );

    host.remove();
  });

  it("submits amount and income direction from finance fields", async () => {
    const onSubmit = vi.fn();
    const host = document.createElement("div");
    document.body.appendChild(host);

    await act(async () => {
      root = createRoot(host);
      root.render(
        createElement(UserEventDialog, {
          open: true,
          mode: "create",
          initial: { title: "購入", kind: "one_off", calendarKind: "purchase_effective" },
          onClose: vi.fn(),
          onSubmit,
        }),
      );
    });

    expect(document.body.querySelector('[data-testid="user-event-finance-fields"]')).toBeTruthy();
    const amountInput = document.body.querySelector(
      '[data-testid="user-event-amount-input"]',
    ) as HTMLInputElement;
    expect(amountInput).toBeTruthy();
    await act(async () => {
      setInputValue(amountInput, "128.5");
    });

    const incomeTab = Array.from(document.body.querySelectorAll('[role="tab"]')).find(
      (el) => el.textContent === "收入",
    ) as HTMLButtonElement | undefined;
    expect(incomeTab).toBeTruthy();
    await act(async () => {
      incomeTab!.click();
    });

    const startInput = document.body.querySelector(
      '[data-testid="user-event-start"]',
    ) as HTMLInputElement | null;
    if (startInput) {
      await act(async () => {
        setInputValue(startInput, "2026-08-10T10:00");
      });
    }

    const submit = Array.from(document.body.querySelectorAll("button")).find(
      (b) => b.textContent === "新增",
    );
    expect(submit).toBeTruthy();
    await act(async () => {
      submit!.click();
    });

    expect(onSubmit).toHaveBeenCalled();
    const arg = onSubmit.mock.calls[0][0];
    expect(arg.title).toBe("購入");
    expect(arg.amountInput).toBe("128.5");
    expect(arg.direction).toBe("income");

    host.remove();
  });

  it("preserves datetime across one_off ↔ recurring kind switches", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);

    await act(async () => {
      root = createRoot(host);
      root.render(
        createElement(UserEventDialog, {
          open: true,
          mode: "create",
          onClose: vi.fn(),
          onSubmit: vi.fn(),
        }),
      );
    });

    const startInput = document.body.querySelector(
      '[data-testid="user-event-start"]',
    ) as HTMLInputElement;
    const endInput = document.body.querySelector(
      '[data-testid="user-event-end"]',
    ) as HTMLInputElement;
    await act(async () => {
      setInputValue(startInput, "2026-08-15T14:30");
      setInputValue(endInput, "2026-08-15T16:00");
    });

    const tabs = Array.from(
      document.body.querySelectorAll('[data-testid="user-event-kind-tabs"] [role="tab"]'),
    ) as HTMLButtonElement[];
    const recurringTab = tabs.find((tab) => tab.textContent?.includes("週期"));
    const oneOffTab = tabs.find((tab) => tab.textContent?.includes("一般"));
    expect(recurringTab).toBeTruthy();
    expect(oneOffTab).toBeTruthy();

    await act(async () => {
      recurringTab!.click();
    });

    const startClock = document.body.querySelector(
      '[data-testid="user-event-event-start"]',
    ) as HTMLInputElement;
    const endClock = document.body.querySelector(
      '[data-testid="user-event-event-end"]',
    ) as HTMLInputElement;
    expect(startClock.value).toBe("14:30");
    expect(endClock.value).toBe("16:00");

    await act(async () => {
      setInputValue(startClock, "15:00");
      setInputValue(endClock, "17:30");
    });

    await act(async () => {
      oneOffTab!.click();
    });

    const startAfter = document.body.querySelector(
      '[data-testid="user-event-start"]',
    ) as HTMLInputElement;
    const endAfter = document.body.querySelector(
      '[data-testid="user-event-end"]',
    ) as HTMLInputElement;
    expect(startAfter.value).toBe("2026-08-15T15:00");
    expect(endAfter.value).toBe("2026-08-15T17:30");

    host.remove();
  });

  it("shows overnight hint when recurring end is before start", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);

    await act(async () => {
      root = createRoot(host);
      root.render(
        createElement(UserEventDialog, {
          open: true,
          mode: "create",
          onClose: vi.fn(),
          onSubmit: vi.fn(),
        }),
      );
    });

    const tabs = Array.from(
      document.body.querySelectorAll('[data-testid="user-event-kind-tabs"] [role="tab"]'),
    ) as HTMLButtonElement[];
    const recurringTab = tabs.find((tab) => tab.textContent?.includes("週期"));
    await act(async () => {
      recurringTab!.click();
    });

    expect(document.body.querySelector('[data-testid="user-event-overnight-hint"]')).toBeNull();

    const startClock = document.body.querySelector(
      '[data-testid="user-event-event-start"]',
    ) as HTMLInputElement;
    const endClock = document.body.querySelector(
      '[data-testid="user-event-event-end"]',
    ) as HTMLInputElement;
    await act(async () => {
      setInputValue(startClock, "22:00");
      setInputValue(endClock, "06:00");
    });

    const hint = document.body.querySelector(
      '[data-testid="user-event-overnight-hint"]',
    );
    expect(hint).toBeTruthy();
    expect(hint?.textContent).toContain("翌日");

    host.remove();
  });

  it("switches to recurring and submits RRULE + clock fields", async () => {
    const onSubmit = vi.fn();
    const host = document.createElement("div");
    document.body.appendChild(host);

    await act(async () => {
      root = createRoot(host);
      root.render(
        createElement(UserEventDialog, {
          open: true,
          mode: "create",
          onClose: vi.fn(),
          onSubmit,
        }),
      );
    });

    expect(document.body.querySelector('[data-testid="user-event-kind-tabs"]')).toBeTruthy();
    const tabs = Array.from(
      document.body.querySelectorAll('[data-testid="user-event-kind-tabs"] [role="tab"]'),
    ) as HTMLButtonElement[];
    const recurringTab = tabs.find((tab) => tab.textContent?.includes("週期"));
    expect(recurringTab).toBeTruthy();
    await act(async () => {
      recurringTab!.click();
    });

    expect(document.body.querySelector('[data-testid="user-event-recurrence"]')).toBeTruthy();
    expect(document.body.querySelector('[data-testid="user-event-days-1"]')).toBeNull();

    const titleInput = document.body.querySelector(
      'input[aria-label="標題"]',
    ) as HTMLInputElement;
    await act(async () => {
      setInputValue(titleInput, "週會");
    });

    const startClock = document.body.querySelector(
      '[data-testid="user-event-event-start"]',
    ) as HTMLInputElement;
    expect(startClock).toBeTruthy();
    await act(async () => {
      setInputValue(startClock, "09:30");
    });

    const buttons = Array.from(document.body.querySelectorAll("button"));
    const submit = buttons.find((b) => b.textContent === "新增");
    await act(async () => {
      submit!.click();
    });

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "recurring",
        title: "週會",
        isAllDay: false,
        eventStartTime: "09:30",
        rrule: expect.stringContaining("FREQ="),
        notifyPref: "off",
      }),
    );

    host.remove();
  });

  it("Now button fills local datetime into start and end", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 15, 13, 30, 0));
    const host = document.createElement("div");
    document.body.appendChild(host);

    await act(async () => {
      root = createRoot(host);
      root.render(
        createElement(UserEventDialog, {
          open: true,
          mode: "create",
          onClose: vi.fn(),
          onSubmit: vi.fn(),
        }),
      );
    });

    const nowBtn = document.body.querySelector(
      '[data-testid="datetime-now"]',
    ) as HTMLButtonElement;
    expect(nowBtn).toBeTruthy();
    expect(nowBtn.textContent).toBe("現在");
    await act(async () => {
      nowBtn.click();
    });
    const startInput = document.body.querySelector(
      '[data-testid="user-event-start"]',
    ) as HTMLInputElement;
    const endInput = document.body.querySelector(
      '[data-testid="user-event-end"]',
    ) as HTMLInputElement;
    expect(startInput.value).toBe("2026-08-15T13:30");
    expect(endInput.value).toBe("2026-08-15T14:30");
    host.remove();
  });

  it("Now button fills today only when all-day", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 15, 13, 30, 0));
    const host = document.createElement("div");
    document.body.appendChild(host);

    await act(async () => {
      root = createRoot(host);
      root.render(
        createElement(UserEventDialog, {
          open: true,
          mode: "create",
          onClose: vi.fn(),
          onSubmit: vi.fn(),
        }),
      );
    });

    const allDay = document.body.querySelector(
      '[data-testid="user-event-all-day"]',
    ) as HTMLInputElement;
    await act(async () => {
      allDay.click();
    });
    const nowBtn = document.body.querySelector(
      '[data-testid="datetime-now"]',
    ) as HTMLButtonElement;
    await act(async () => {
      nowBtn.click();
    });
    const startInput = document.body.querySelector(
      '[data-testid="user-event-start"]',
    ) as HTMLInputElement;
    const endInput = document.body.querySelector(
      '[data-testid="user-event-end"]',
    ) as HTMLInputElement;
    expect(startInput.type).toBe("date");
    expect(startInput.value).toBe("2026-08-15");
    expect(endInput.value).toBe("2026-08-15");
    host.remove();
  });

  it("Now button fills recurring start/end clocks", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 15, 13, 30, 0));
    const host = document.createElement("div");
    document.body.appendChild(host);

    await act(async () => {
      root = createRoot(host);
      root.render(
        createElement(UserEventDialog, {
          open: true,
          mode: "create",
          onClose: vi.fn(),
          onSubmit: vi.fn(),
        }),
      );
    });

    const tabs = Array.from(
      document.body.querySelectorAll('[data-testid="user-event-kind-tabs"] [role="tab"]'),
    ) as HTMLButtonElement[];
    const recurringTab = tabs.find((tab) => tab.textContent?.includes("週期"));
    await act(async () => {
      recurringTab!.click();
    });
    const nowBtn = document.body.querySelector(
      '[data-testid="datetime-now"]',
    ) as HTMLButtonElement;
    expect(nowBtn).toBeTruthy();
    await act(async () => {
      nowBtn.click();
    });
    const startClock = document.body.querySelector(
      '[data-testid="user-event-event-start"]',
    ) as HTMLInputElement;
    const endClock = document.body.querySelector(
      '[data-testid="user-event-event-end"]',
    ) as HTMLInputElement;
    expect(startClock.value).toBe("13:30");
    expect(endClock.value).toBe("14:30");
    host.remove();
  });
});
