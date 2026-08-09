import { describe, expect, it } from "vitest";
import { ApiRequestError, NetworkError } from "../../api/client";
import { formatItemsError } from "./itemErrors";

const t = (key: string) => `i18n:${key}`;

describe("formatItemsError", () => {
  it("maps network and validation failures to friendly keys", () => {
    expect(formatItemsError(new NetworkError("down"), t)).toBe("i18n:errors.network");
    expect(
      formatItemsError(
        new ApiRequestError(422, {
          error: "validation_error",
          message: "attribute values must be <= 500 characters",
        }),
        t,
      ),
    ).toBe("i18n:errors.attributes");
    expect(
      formatItemsError(
        new ApiRequestError(422, {
          error: "validation_error",
          message: "emoji must be <= 16 characters",
        }),
        t,
      ),
    ).toBe("i18n:errors.emoji");
    expect(
      formatItemsError(
        new ApiRequestError(422, {
          error: "validation_error",
          message: "title must be <= 200 characters",
        }),
        t,
      ),
    ).toBe("i18n:errors.titleTooLong");
    expect(
      formatItemsError(
        new ApiRequestError(422, {
          error: "validation_error",
          message: "Request validation failed",
        }),
        t,
      ),
    ).toBe("i18n:errors.validation");
    expect(
      formatItemsError(
        new ApiRequestError(404, { error: "not_found", message: "item not found" }),
        t,
      ),
    ).toBe("i18n:errors.notFound");
  });
});
