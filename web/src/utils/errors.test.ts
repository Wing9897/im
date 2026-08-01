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
    expect(toErrorMessage(new Error("Request timed out"))).toBe("請求逾時，請稍後再試");
    expect(toErrorMessage(new Error("Request cancelled"))).toBe("請求已取消");
  });

  it("maps ApiRequestError error_code before raw message", () => {
    const err = new ApiRequestError(502, {
      error: "weather_timeout",
      message: "Weather provider timed out",
    });
    expect(toErrorMessage(err)).toBe("天氣來源回應過慢，請稍後再試");
  });

  it("maps agent_timeout soft-error code via message lookup", () => {
    expect(toErrorMessage(new Error("agent_timeout"))).toBe(
      "助手請求逾時，請稍後再試或縮短問題。",
    );
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
