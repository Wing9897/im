import { describe, it, expect } from "vitest";
import type { StructuredErrorResponse } from "./parseApiError";

function createMockResponse(body: unknown, status = 400): Response {
  const json = JSON.stringify(body);
  return new Response(json, {
    status,
    statusText: "Bad Request",
    headers: { "Content-Type": "application/json" },
  });
}

describe("Lenient frontend parsing of API responses", () => {
  it("extracts known fields without throwing when unknown fields are present at the top level", () => {
    const body = {
      error_code: "VALIDATION_ERROR",
      message: "Invalid input",
      correlation_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      details: null,
      extra_field: { nested: [1, 2, 3] },
      _meta: "ignored",
    };

    const parsed = JSON.parse(JSON.stringify(body));
    const isStructured =
      typeof parsed === "object" &&
      parsed !== null &&
      typeof parsed.error_code === "string" &&
      typeof parsed.message === "string" &&
      typeof parsed.correlation_id === "string";

    expect(isStructured).toBe(true);

    const structured: StructuredErrorResponse = {
      error_code: parsed.error_code,
      message: parsed.message,
      details: parsed.details ?? null,
      correlation_id: parsed.correlation_id,
    };

    expect(structured.error_code).toBe("VALIDATION_ERROR");
    expect(structured.message).toBe("Invalid input");
    expect(structured.correlation_id).toBe("a1b2c3d4-e5f6-7890-abcd-ef1234567890");
    expect(structured.details).toBeNull();
  });

  it("extracts known fields when unknown fields are nested in details", () => {
    const body = {
      error_code: "NOT_FOUND",
      message: "Resource missing",
      correlation_id: "00001111-2222-3333-4444-555566667777",
      details: { fields: [], custom: { deep: true } },
      trace_id: "xyz",
    };

    const parsed = JSON.parse(JSON.stringify(body));
    const structured: StructuredErrorResponse = {
      error_code: parsed.error_code,
      message: parsed.message,
      details: parsed.details ?? null,
      correlation_id: parsed.correlation_id,
    };

    expect(structured.error_code).toBe("NOT_FOUND");
    expect(structured.details).toHaveProperty("fields");
  });

  it("parseErrorResponse does not throw with unknown fields", async () => {
    const body = {
      error_code: "INTERNAL_ERROR",
      message: "Server error",
      correlation_id: "abcdef12-0000-0000-0000-000000000000",
      details: null,
      unknown: { a: 1, b: [2, 3] },
    };

    const response = createMockResponse(body);
    const { parseErrorResponse } = await import("./parseApiError");
    const result = await parseErrorResponse(response);

    expect(result.structured?.error_code).toBe("INTERNAL_ERROR");
    expect(result.structured?.message).toBe("Server error");
    expect(result.structured?.correlation_id).toBe(
      "abcdef12-0000-0000-0000-000000000000",
    );
  });
});
