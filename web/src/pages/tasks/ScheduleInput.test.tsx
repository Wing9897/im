import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import i18n from "../../i18n";
import { setAppLocale } from "../../i18n/locale";
import { ScheduleInput, validateScheduleValue } from "./ScheduleInput";
import type { ScheduleType } from "./ScheduleInput";

/* ------------------------------------------------------------------ */
/*  validateScheduleValue unit tests                                   */
/* ------------------------------------------------------------------ */

describe("validateScheduleValue", () => {
  beforeEach(async () => {
    setAppLocale("zh-Hant");
    await i18n.changeLanguage("zh-Hant");
  });
  describe("seconds_10", () => {
    it("accepts null value", () => {
      expect(validateScheduleValue("seconds_10", null)).toBeNull();
    });
    it("accepts any value (ignored)", () => {
      expect(validateScheduleValue("seconds_10", "anything")).toBeNull();
    });
  });

  describe("hourly", () => {
    it("accepts null value", () => {
      expect(validateScheduleValue("hourly", null)).toBeNull();
    });
    it("accepts any value (ignored)", () => {
      expect(validateScheduleValue("hourly", "foo")).toBeNull();
    });
  });

  describe("daily", () => {
    it("accepts valid HH:MM format", () => {
      expect(validateScheduleValue("daily", "00:00")).toBeNull();
      expect(validateScheduleValue("daily", "23:59")).toBeNull();
      expect(validateScheduleValue("daily", "12:30")).toBeNull();
    });
    it("rejects null value", () => {
      expect(validateScheduleValue("daily", null)).not.toBeNull();
    });
    it("rejects empty string", () => {
      expect(validateScheduleValue("daily", "")).not.toBeNull();
    });
    it("rejects invalid format", () => {
      expect(validateScheduleValue("daily", "1:30")).not.toBeNull();
      expect(validateScheduleValue("daily", "abc")).not.toBeNull();
      expect(validateScheduleValue("daily", "24:00")).not.toBeNull();
    });
    it("rejects hour out of range", () => {
      expect(validateScheduleValue("daily", "25:00")).not.toBeNull();
    });
    it("rejects minute out of range", () => {
      expect(validateScheduleValue("daily", "12:60")).not.toBeNull();
    });
  });

  describe("weekly", () => {
    it("accepts valid D:HH:MM format", () => {
      expect(validateScheduleValue("weekly", "0:00:00")).toBeNull();
      expect(validateScheduleValue("weekly", "6:23:59")).toBeNull();
      expect(validateScheduleValue("weekly", "3:12:30")).toBeNull();
    });
    it("rejects null value", () => {
      expect(validateScheduleValue("weekly", null)).not.toBeNull();
    });
    it("rejects empty string", () => {
      expect(validateScheduleValue("weekly", "")).not.toBeNull();
    });
    it("rejects invalid format", () => {
      expect(validateScheduleValue("weekly", "abc")).not.toBeNull();
      expect(validateScheduleValue("weekly", "12:30")).not.toBeNull();
    });
    it("rejects day out of range", () => {
      expect(validateScheduleValue("weekly", "7:12:00")).not.toBeNull();
    });
    it("rejects hour out of range", () => {
      expect(validateScheduleValue("weekly", "0:24:00")).not.toBeNull();
    });
    it("rejects minute out of range", () => {
      expect(validateScheduleValue("weekly", "0:12:60")).not.toBeNull();
    });
  });

  describe("custom_seconds", () => {
    it("accepts positive integer", () => {
      expect(validateScheduleValue("custom_seconds", "1")).toBeNull();
      expect(validateScheduleValue("custom_seconds", "60")).toBeNull();
      expect(validateScheduleValue("custom_seconds", "3600")).toBeNull();
    });
    it("rejects null value", () => {
      expect(validateScheduleValue("custom_seconds", null)).not.toBeNull();
    });
    it("rejects empty string", () => {
      expect(validateScheduleValue("custom_seconds", "")).not.toBeNull();
    });
    it("rejects zero", () => {
      expect(validateScheduleValue("custom_seconds", "0")).not.toBeNull();
    });
    it("rejects negative number", () => {
      expect(validateScheduleValue("custom_seconds", "-5")).not.toBeNull();
    });
    it("rejects non-integer", () => {
      expect(validateScheduleValue("custom_seconds", "1.5")).not.toBeNull();
    });
    it("rejects non-numeric string", () => {
      expect(validateScheduleValue("custom_seconds", "abc")).not.toBeNull();
    });
  });
});

/* ------------------------------------------------------------------ */
/*  ScheduleInput component rendering tests                            */
/* ------------------------------------------------------------------ */

describe("ScheduleInput component", () => {
  beforeEach(async () => {
    setAppLocale("zh-Hant");
    await i18n.changeLanguage("zh-Hant");
  });

  function renderScheduleInput(props: {
    scheduleType: ScheduleType;
    scheduleValue: string | null;
    scheduleRrule?: string | null;
    onScheduleTypeChange?: (type: ScheduleType) => void;
    onScheduleValueChange?: (value: string | null) => void;
    validationError?: string | null;
    showProjectWaveInterval?: boolean;
    projectWaveIntervalSeconds?: string;
  }) {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(
          I18nextProvider,
          { i18n },
          createElement(ScheduleInput, {
            onScheduleTypeChange: props.onScheduleTypeChange ?? vi.fn(),
            onScheduleValueChange: props.onScheduleValueChange ?? vi.fn(),
            ...props,
          }),
        ),
      );
    });
    return container;
  }

  describe("schedule type dropdown", () => {
    it("renders a select with all 5 schedule type options", () => {
      const container = renderScheduleInput({
        scheduleType: "seconds_10",
        scheduleValue: null,
      });
      const select = container.querySelector('select[aria-label="排程類型"]') as HTMLSelectElement;
      expect(select).not.toBeNull();
      const options = select.querySelectorAll("option");
      expect(options.length).toBe(5);
      expect(options[0].value).toBe("seconds_10");
      expect(options[0].textContent).toBe("每 10 秒");
      expect(options[1].value).toBe("hourly");
      expect(options[1].textContent).toBe("每小時");
      expect(options[2].value).toBe("daily");
      expect(options[2].textContent).toBe("每日");
      expect(options[3].value).toBe("weekly");
      expect(options[3].textContent).toBe("每週");
      expect(options[4].value).toBe("custom_seconds");
      expect(options[4].textContent).toBe("自訂秒數");
    });

    it("shows read-only RRULE when wire value is not a FE preset", () => {
      const container = renderScheduleInput({
        scheduleType: "seconds_10",
        scheduleValue: null,
        scheduleRrule: "FREQ=HOURLY;INTERVAL=2",
      });
      const code = container.querySelector(
        '[data-testid="schedule-unmapped-rrule"]',
      ) as HTMLElement;
      expect(code).not.toBeNull();
      expect(code.textContent).toBe("FREQ=HOURLY;INTERVAL=2");
      expect(container.textContent).toContain("不在下方預設選項");
      const select = container.querySelector('select[aria-label="排程類型"]') as HTMLSelectElement;
      expect(select.value).toBe("");
      expect(select.querySelector('option[value=""]')?.textContent).toBe("自訂觸發 RRULE");
    });

    it("shows project wave interval after schedule type when enabled", () => {
      const container = renderScheduleInput({
        scheduleType: "hourly",
        scheduleValue: null,
        showProjectWaveInterval: true,
        projectWaveIntervalSeconds: "20",
      });
      const field = container.querySelector(
        '[data-testid="schedule-project-wave-interval"]',
      ) as HTMLInputElement;
      expect(field).not.toBeNull();
      expect(field.value).toBe("20");
      expect(container.textContent).toContain("專案波間間隔");
    });

    it("hides project wave interval by default", () => {
      const container = renderScheduleInput({
        scheduleType: "hourly",
        scheduleValue: null,
      });
      expect(container.querySelector('[data-testid="schedule-project-wave-interval"]')).toBeNull();
    });

    it("reflects the current scheduleType value", () => {
      const container = renderScheduleInput({
        scheduleType: "daily",
        scheduleValue: "12:00",
      });
      const select = container.querySelector('select[aria-label="排程類型"]') as HTMLSelectElement;
      expect(select.value).toBe("daily");
    });
  });

  describe("conditional inputs for seconds_10", () => {
    it("does NOT render additional inputs", () => {
      const container = renderScheduleInput({
        scheduleType: "seconds_10",
        scheduleValue: null,
      });
      const timeInput = container.querySelector('input[type="time"]');
      const numberInput = container.querySelector('input[type="number"]');
      expect(timeInput).toBeNull();
      expect(numberInput).toBeNull();
    });
  });

  describe("conditional inputs for hourly", () => {
    it("does NOT render additional inputs", () => {
      const container = renderScheduleInput({
        scheduleType: "hourly",
        scheduleValue: null,
      });
      const timeInput = container.querySelector('input[type="time"]');
      const numberInput = container.querySelector('input[type="number"]');
      expect(timeInput).toBeNull();
      expect(numberInput).toBeNull();
    });
  });

  describe("conditional inputs for daily", () => {
    it("renders a time picker input", () => {
      const container = renderScheduleInput({
        scheduleType: "daily",
        scheduleValue: "14:30",
      });
      const timeInput = container.querySelector('input[type="time"]') as HTMLInputElement;
      expect(timeInput).not.toBeNull();
      expect(timeInput.value).toBe("14:30");
    });

    it("does NOT render number input or day selector", () => {
      const container = renderScheduleInput({
        scheduleType: "daily",
        scheduleValue: "14:30",
      });
      const numberInput = container.querySelector('input[type="number"]');
      expect(numberInput).toBeNull();
      const daySelect = container.querySelector('select[aria-label="星期幾"]');
      expect(daySelect).toBeNull();
    });
  });

  describe("conditional inputs for weekly", () => {
    it("renders a day-of-week selector and time picker", () => {
      const container = renderScheduleInput({
        scheduleType: "weekly",
        scheduleValue: "3:14:30",
      });
      const daySelect = container.querySelector('select[aria-label="星期幾"]') as HTMLSelectElement;
      expect(daySelect).not.toBeNull();
      expect(daySelect.value).toBe("3");

      const timeInput = container.querySelector('input[type="time"]') as HTMLInputElement;
      expect(timeInput).not.toBeNull();
      expect(timeInput.value).toBe("14:30");
    });

    it("day selector has 7 options (Sunday through Saturday)", () => {
      const container = renderScheduleInput({
        scheduleType: "weekly",
        scheduleValue: "0:00:00",
      });
      const daySelect = container.querySelector('select[aria-label="星期幾"]') as HTMLSelectElement;
      const options = daySelect.querySelectorAll("option");
      expect(options.length).toBe(7);
      expect(options[0].textContent).toBe("星期日");
      expect(options[6].textContent).toBe("星期六");
    });

    it("does NOT render number input", () => {
      const container = renderScheduleInput({
        scheduleType: "weekly",
        scheduleValue: "0:12:00",
      });
      const numberInput = container.querySelector('input[type="number"]');
      expect(numberInput).toBeNull();
    });
  });

  describe("conditional inputs for custom_seconds", () => {
    it("renders a numeric input", () => {
      const container = renderScheduleInput({
        scheduleType: "custom_seconds",
        scheduleValue: "120",
      });
      const numberInput = container.querySelector('input[type="number"]') as HTMLInputElement;
      expect(numberInput).not.toBeNull();
      expect(numberInput.value).toBe("120");
    });

    it("does NOT render time picker or day selector", () => {
      const container = renderScheduleInput({
        scheduleType: "custom_seconds",
        scheduleValue: "60",
      });
      const timeInput = container.querySelector('input[type="time"]');
      const daySelect = container.querySelector('select[aria-label="星期幾"]');
      expect(timeInput).toBeNull();
      expect(daySelect).toBeNull();
    });
  });

  describe("validation error display", () => {
    it("shows validation error when externally provided", () => {
      const container = renderScheduleInput({
        scheduleType: "daily",
        scheduleValue: "14:30",
        validationError: "自訂錯誤訊息",
      });
      expect(container.textContent).toContain("自訂錯誤訊息");
    });

    it("shows validation error for invalid daily value when value is non-empty", () => {
      const container = renderScheduleInput({
        scheduleType: "daily",
        scheduleValue: "invalid",
      });
      expect(container.textContent).toContain("時間格式無效");
    });

    it("shows validation error for invalid custom_seconds value", () => {
      const container = renderScheduleInput({
        scheduleType: "custom_seconds",
        scheduleValue: "-5",
      });
      expect(container.textContent).toContain("秒數必須為正整數");
    });

    it("shows error for daily when scheduleValue is empty (just switched type)", () => {
      // Regression: H8 — after switching to daily and value is reset to "",
      // the user should see a hint explaining why Save is disabled.
      const container = renderScheduleInput({
        scheduleType: "daily",
        scheduleValue: "",
      });
      expect(container.textContent).toContain("請輸入時間");
    });

    it("shows error for weekly when scheduleValue is null/empty", () => {
      const container = renderScheduleInput({
        scheduleType: "weekly",
        scheduleValue: "",
      });
      // weekly with no value emits "格式無效" because day select defaults to "0"
      // and empty time produces "0:" which fails the D:HH:MM regex.
      // Either message is acceptable so long as something explains the problem.
      expect(container.textContent?.length).toBeGreaterThan(0);
      const hasError =
        container.textContent?.includes("請選擇") ||
        container.textContent?.includes("格式無效");
      expect(hasError).toBe(true);
    });

    it("shows error for custom_seconds when scheduleValue is empty", () => {
      const container = renderScheduleInput({
        scheduleType: "custom_seconds",
        scheduleValue: "",
      });
      expect(container.textContent).toContain("請輸入秒數");
    });

    it("does NOT show error for seconds_10 even when scheduleValue is empty", () => {
      const container = renderScheduleInput({
        scheduleType: "seconds_10",
        scheduleValue: null,
      });
      // No conditional input, so no error rendering.
      expect(container.textContent).not.toContain("請輸入");
      expect(container.textContent).not.toContain("格式無效");
    });
  });

  describe("type change callback", () => {
    it("calls onScheduleTypeChange when dropdown changes", () => {
      const onTypeChange = vi.fn();
      const container = renderScheduleInput({
        scheduleType: "seconds_10",
        scheduleValue: null,
        onScheduleTypeChange: onTypeChange,
      });
      const select = container.querySelector('select[aria-label="排程類型"]') as HTMLSelectElement;
      act(() => {
        select.value = "daily";
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });
      expect(onTypeChange).toHaveBeenCalledWith("daily");
    });
  });
});
