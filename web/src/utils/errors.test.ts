import { describe, expect, it, vi } from "vitest";

import {
  toError,
  toErrorMessage,
  handleCommandError,
} from "./errors";
import { ApiRequestError } from "../api/parseApiError";

describe("toError", () => {
  it("returns the same Error instance when given an Error", () => {
    const err = new Error("test");
    expect(toError(err)).toBe(err);
  });

  it("wraps a string into an Error", () => {
    const result = toError("something went wrong");
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("something went wrong");
  });

  it("wraps a number into an Error with stringified message", () => {
    const result = toError(42);
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("42");
  });

  it("wraps null into an Error", () => {
    const result = toError(null);
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("null");
  });

  it("wraps undefined into an Error", () => {
    const result = toError(undefined);
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("undefined");
  });

  it("wraps an object into an Error", () => {
    const result = toError({ code: 500 });
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("[object Object]");
  });
});

describe("toErrorMessage", () => {
  it("extracts message from an Error", () => {
    expect(toErrorMessage(new Error("fail"))).toBe("fail");
  });

  it("converts a string directly", () => {
    expect(toErrorMessage("oops")).toBe("oops");
  });

  it("stringifies non-Error non-string values", () => {
    expect(toErrorMessage(123)).toBe("123");
  });

  it("maps known network failures to Chinese UX copy", () => {
    expect(toErrorMessage(new Error("Backend unreachable"))).toBe("無法連線到後端服務");
    expect(toErrorMessage(new Error("Calendar share request failed"))).toBe("日曆分享請求失敗，請稍後再試。");
    expect(toErrorMessage(new Error("Calendar share server unreachable"))).toBe("日曆分享服務連不上，請稍後再試。");
    expect(toErrorMessage(new Error("Request timed out"))).toBe("請求逾時，請稍後再試");
    expect(toErrorMessage(new Error("Request cancelled"))).toBe("請求已取消");
  });

  it("maps ApiRequestError error_code before raw message", () => {
    const err = new ApiRequestError(502, {
      error: "weather_timeout",
      message: "Weather provider timed out",
    });
    expect(toErrorMessage(err)).toBe("天氣來源回應過慢，請稍後再試");
    expect(
      toErrorMessage(
        new ApiRequestError(502, {
          error: "CALENDAR_SHARE_REQUEST_FAILED",
          message: "Calendar share request failed",
        }),
      ),
    ).toBe("日曆分享請求失敗，請稍後再試。");
  });

  it("maps IC 422 quota codes to Traditional Chinese copy", async () => {
    const { ensureZhHantLocale } = await import("../test/i18nHarness");
    await ensureZhHantLocale();
    expect(toErrorMessage("PUBLISH_CALENDAR_LIMIT")).toBe(
      "已達發佈日曆上限（每人 10 本）。請先取消上載一本再試。",
    );
    expect(toErrorMessage("SUBSCRIBE_LIMIT")).toBe(
      "已達訂閱上限（每人 50 本）。請先移除訂閱再試。",
    );
    expect(toErrorMessage("CALENDAR_EVENT_LIMIT")).toBe(
      "這本日曆事件超過 3000 筆上限。請減少事件後再發佈。",
    );
    expect(
      toErrorMessage(
        new ApiRequestError(422, {
          error: "PUBLISH_CALENDAR_LIMIT",
          message: "PUBLISH_CALENDAR_LIMIT",
        }),
      ),
    ).toBe("已達發佈日曆上限（每人 10 本）。請先取消上載一本再試。");
    expect(
      toErrorMessage(
        new ApiRequestError(422, {
          error: "SUBSCRIBE_LIMIT",
          message: "SUBSCRIBE_LIMIT",
        }),
      ),
    ).toBe("已達訂閱上限（每人 50 本）。請先移除訂閱再試。");
    expect(
      toErrorMessage(
        new ApiRequestError(422, {
          error: "CALENDAR_EVENT_LIMIT",
          message: "CALENDAR_EVENT_LIMIT",
        }),
      ),
    ).toBe("這本日曆事件超過 3000 筆上限。請減少事件後再發佈。");
  });

  it("maps INVALID_CALENDAR_SLUG and Invalid slug: IC detail to localized copy", () => {
    const err = new ApiRequestError(422, {
      error: "INVALID_CALENDAR_SLUG",
      message: "Invalid slug: 1–64 letters, digits, dot, underscore, or hyphen",
    });
    expect(toErrorMessage(err)).toBe("slug 須為 1–64 字元，以字母或數字開頭，其後可為字母、數字、點、底線或連字號。");
    expect(
      toErrorMessage("Invalid slug: 1–64 characters; start with a letter or digit; then letters, digits, dot, underscore, or hyphen"),
    ).toBe("slug 須為 1–64 字元，以字母或數字開頭，其後可為字母、數字、點、底線或連字號。");
  });

  it("maps agent_timeout soft-error code via message lookup", () => {
    expect(toErrorMessage(new Error("agent_timeout"))).toBe(
      "助手請求逾時，請稍後再試或縮短問題。",
    );
  });

  it("maps Gemini MAX_TOKENS strings to zh-Hant analysis copy", async () => {
    const { ensureZhHantLocale } = await import("../test/i18nHarness");
    const i18n = (await import("../i18n")).default;
    await ensureZhHantLocale();
    const expected = String(i18n.t("tasks:errors.geminiMaxTokens"));
    expect(
      toErrorMessage(
        new Error(
          "Gemini response was truncated (MAX_TOKENS). Increase max output tokens or shorten the prompt.",
        ),
      ),
    ).toBe(expected);
    expect(
      toErrorMessage("Gemini response has no usable candidates (MAX_TOKENS)"),
    ).toBe(expected);
    expect(expected).not.toMatch(/MAX_TOKENS/);
  });
});

describe("handleCommandError", () => {
  it("returns the error message", () => {
    const msg = handleCommandError(new Error("network error"));
    expect(msg).toBe("network error");
  });

  it("calls showToast with error tone when provided", () => {
    const showToast = vi.fn();
    handleCommandError(new Error("oops"), showToast);
    expect(showToast).toHaveBeenCalledWith("oops", "error");
  });

  it("does not throw when showToast is not provided", () => {
    expect(() => handleCommandError("some error")).not.toThrow();
  });
});
