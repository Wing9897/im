/**
 * API error parsing for the IntelligenceMonitor REST client.
 *
 * Extracted from `client.ts` to keep the HTTP core lean. Contains the typed
 * error interfaces, the `ApiRequestError` class, and the lenient response
 * parser that maps backend error bodies (structured or flat) to a typed shape.
 */

/**
 * Standardized API error interface matching the backend's
 * flat `{ error: string, message: string }` wire shape, or the structured
 * `{ error_code, message, details, correlation_id }` format.
 */
export interface ApiError {
  /** Error code (e.g., "not_found", "validation_error") */
  error: string;
  /** Human-readable error description */
  message: string;
}

/**
 * Structured error response from the backend (new format).
 * Contains error_code, message, optional details, and correlation_id.
 */
export interface StructuredErrorResponse {
  error_code: string;
  message: string;
  details?: Record<string, unknown> | null;
  correlation_id: string;
}

/**
 * Custom error class thrown by ApiClient on non-OK responses.
 * Contains the HTTP status and parsed ApiError fields.
 * Extended to carry structured error fields when available.
 */
export class ApiRequestError extends Error {
  public readonly status: number;
  public readonly errorCode: string;
  /** Correlation ID from the structured error response (UUID) */
  public readonly correlationId: string | undefined;
  /** Additional details from the structured error response */
  public readonly details: Record<string, unknown> | null | undefined;

  constructor(status: number, apiError: ApiError, structured?: StructuredErrorResponse) {
    super(apiError.message);
    this.name = "ApiRequestError";
    this.status = status;
    this.errorCode = apiError.error;
    this.correlationId = structured?.correlation_id;
    this.details = structured?.details;
  }
}

/**
 * Parse a non-OK HTTP response body into a typed `ApiError` (and, when present,
 * the richer `StructuredErrorResponse`). Lenient: tolerates unknown extra
 * fields and falls back to status text when the body is not valid JSON.
 */
export async function parseErrorResponse(
  response: Response,
): Promise<{ apiError: ApiError; structured?: StructuredErrorResponse }> {
  try {
    const body: unknown = await response.json();

    // Check for new structured error format: { error_code, message, details?, correlation_id }
    if (
      typeof body === "object" &&
      body !== null &&
      "error_code" in body &&
      "message" in body &&
      "correlation_id" in body &&
      typeof (body as Record<string, unknown>).error_code === "string" &&
      typeof (body as Record<string, unknown>).message === "string" &&
      typeof (body as Record<string, unknown>).correlation_id === "string"
    ) {
      const rec = body as Record<string, unknown>;
      const structured: StructuredErrorResponse = {
        error_code: rec.error_code as string,
        message: rec.message as string,
        details: (rec.details as Record<string, unknown> | null) ?? null,
        correlation_id: rec.correlation_id as string,
      };
      // Dual wire format: also expose flat ApiError { error, message }
      const apiError: ApiError = {
        error: rec.error_code as string,
        message: rec.message as string,
      };
      return { apiError, structured };
    }

    // Flat format: { error, message }
    if (
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      "message" in body &&
      typeof (body as Record<string, unknown>).error === "string" &&
      typeof (body as Record<string, unknown>).message === "string"
    ) {
      const rec = body as Record<string, unknown>;
      return {
        apiError: {
          error: rec.error as string,
          message: rec.message as string,
        },
      };
    }

    // Fallback: body doesn't match expected format
    return {
      apiError: {
        error: `http_${response.status}`,
        message: JSON.stringify(body),
      },
    };
  } catch {
    // Could not parse JSON — use status text
    const text = await response.text().catch(() => response.statusText);
    return {
      apiError: {
        error: `http_${response.status}`,
        message: text || response.statusText,
      },
    };
  }
}
