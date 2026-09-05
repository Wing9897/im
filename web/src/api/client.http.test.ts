/**
 * ApiClient HTTP methods, token management, and error handling.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ApiClient, ApiRequestError, NetworkError } from "./client";
import type { ApiError } from "./client";
import { errorToastEmitter } from "./errorToastEmitter";
import { saveDeviceSession } from "../domain/connection/connectionStore";
import { _resetConnectionStoreForTests } from "../domain/connection/connectionStore.testing";
import { localStorageMock, mockFetch } from "./clientTestUtils";

describe("ApiClient", () => {
  let client: ApiClient;

  beforeEach(() => {
    vi.useRealTimers();
    localStorageMock.clear();
    _resetConnectionStoreForTests();
    client = new ApiClient("http://localhost:18820");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("uses provided base URL", async () => {
      const c = new ApiClient("http://example.com:8080");
      const fetchMock = mockFetch({
        ok: true,
        status: 200,
        json: () => Promise.resolve([]),
      });
      await c.get("/api/v1/tasks");
      expect(fetchMock).toHaveBeenCalledWith(
        "http://example.com:8080/api/v1/tasks",
        expect.anything(),
      );
    });

    it("strips trailing slashes from base URL", async () => {
      const c = new ApiClient("http://example.com:8080///");
      const fetchMock = mockFetch({
        ok: true,
        status: 200,
        json: () => Promise.resolve([]),
      });
      await c.get("/api/v1/tasks");
      expect(fetchMock).toHaveBeenCalledWith(
        "http://example.com:8080/api/v1/tasks",
        expect.anything(),
      );
    });
  });

  describe("token management", () => {
    it("setToken stores access in im:connection without inventing refresh", () => {
      client.setToken("my-secret-token");
      expect(client.getToken()).toBe("my-secret-token");
      expect(localStorageMock.getItem("im_api_token")).toBeNull();
      const raw = localStorageMock.getItem("im:connection");
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw!) as {
        accessToken: string;
        refreshToken: string | null;
      };
      expect(parsed.accessToken).toBe("my-secret-token");
      expect(parsed.refreshToken).toBeNull();
    });

    it("getToken returns access from im:connection", () => {
      saveDeviceSession({
        accessToken: "test-token",
        refreshToken: "refresh-token",
      });
      expect(client.getToken()).toBe("test-token");
    });

    it("getToken returns undefined when no token stored", () => {
      expect(client.getToken()).toBeUndefined();
    });

    it("clearToken removes device session", () => {
      saveDeviceSession({ accessToken: "to-remove", refreshToken: "r" });
      client.clearToken();
      expect(client.getToken()).toBeUndefined();
    });

    it("setToken with existing refresh updates access only", () => {
      saveDeviceSession({ accessToken: "old", refreshToken: "keep-refresh" });
      client.setToken("new-access");
      expect(client.getToken()).toBe("new-access");
      const parsed = JSON.parse(localStorageMock.getItem("im:connection")!) as {
        refreshToken: string;
      };
      expect(parsed.refreshToken).toBe("keep-refresh");
    });
  });

  describe("get()", () => {
    it("sends GET request and returns parsed JSON", async () => {
      const data = [{ id: "1", name: "Task 1" }];
      const fetchMock = mockFetch({
        ok: true,
        status: 200,
        json: () => Promise.resolve(data),
      });

      const result = await client.get("/api/v1/tasks");

      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:18820/api/v1/tasks",
        expect.objectContaining({ method: "GET" }),
      );
      expect(result).toEqual(data);
    });

    it("appends query parameters to URL", async () => {
      const fetchMock = mockFetch({
        ok: true,
        status: 200,
        json: () => Promise.resolve([]),
      });

      await client.get("/api/v1/tasks", { task_id: "abc" });

      const calledUrl = fetchMock.mock.calls[0][0] as string;
      expect(calledUrl).toContain("task_id=abc");
    });

    it("includes Authorization header when token is set", async () => {
      saveDeviceSession({ accessToken: "bearer-test", refreshToken: "r" });
      const fetchMock = mockFetch({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      });

      await client.get("/api/v1/tasks");

      const headers = (fetchMock.mock.calls[0][1] as RequestInit)
        .headers as Record<string, string>;
      expect(headers["Authorization"]).toBe("Bearer bearer-test");
    });

    it("omits Authorization header when no token", async () => {
      const fetchMock = mockFetch({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      });

      await client.get("/api/v1/tasks");

      const headers = (fetchMock.mock.calls[0][1] as RequestInit)
        .headers as Record<string, string>;
      expect(headers["Authorization"]).toBeUndefined();
    });
  });

  describe("post()", () => {
    it("sends POST request with JSON body", async () => {
      const body = { name: "New Task", prompt: "Test" };
      const responseData = { id: "2", ...body };
      const fetchMock = mockFetch({
        ok: true,
        status: 201,
        json: () => Promise.resolve(responseData),
      });

      const result = await client.post("/api/v1/tasks", body);

      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:18820/api/v1/tasks",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(body),
        }),
      );
      expect(result).toEqual(responseData);
    });

    it("sends POST without body when no body provided", async () => {
      const fetchMock = mockFetch({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      });

      await client.post("/api/v1/sources/refresh-all");

      const init = fetchMock.mock.calls[0][1] as RequestInit;
      expect(init.body).toBeUndefined();
    });
  });

  describe("put()", () => {
    it("sends PUT request with JSON body", async () => {
      const body = { name: "Updated Task" };
      const fetchMock = mockFetch({
        ok: true,
        status: 200,
        json: () => Promise.resolve(body),
      });

      await client.put("/api/v1/tasks/123", body);

      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:18820/api/v1/tasks/123",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify(body),
        }),
      );
    });
  });

  describe("patch()", () => {
    it("sends PATCH request", async () => {
      const fetchMock = mockFetch({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ isActive: true }),
      });

      await client.patch("/api/v1/tasks/123/active", { active: true });

      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:18820/api/v1/tasks/123/active",
        expect.objectContaining({ method: "PATCH" }),
      );
    });
  });

  describe("delete()", () => {
    it("sends DELETE request and handles 204 No Content", async () => {
      mockFetch({ ok: true, status: 204 });

      const result = await client.delete("/api/v1/tasks/123");

      expect(result).toBeUndefined();
    });
  });

  describe("error handling", () => {
    it("throws ApiRequestError with parsed error body on non-OK response", async () => {
      const errorBody: ApiError = {
        error: "not_found",
        message: "Task not found",
      };
      mockFetch({
        ok: false,
        status: 404,
        json: () => Promise.resolve(errorBody),
      });

      await expect(client.get("/api/v1/tasks/999")).rejects.toThrow(
        ApiRequestError,
      );

      try {
        await client.get("/api/v1/tasks/999");
      } catch (err) {
        const apiErr = err as ApiRequestError;
        expect(apiErr.status).toBe(404);
        expect(apiErr.errorCode).toBe("not_found");
        expect(apiErr.message).toBe("Task not found");
      }
    });

    it("handles non-JSON error responses gracefully", async () => {
      mockFetch({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error("not json")),
        text: () => Promise.resolve("Internal Server Error"),
      });

      try {
        await client.get("/api/v1/tasks");
      } catch (err) {
        const apiErr = err as ApiRequestError;
        expect(apiErr.status).toBe(500);
        expect(apiErr.errorCode).toBe("http_500");
        expect(apiErr.message).toBe("Internal Server Error");
      }
    });

    it("handles unexpected error body format", async () => {
      mockFetch({
        ok: false,
        status: 422,
        json: () => Promise.resolve({ unexpected: "format" }),
      });

      try {
        await client.get("/api/v1/config/settings");
      } catch (err) {
        const apiErr = err as ApiRequestError;
        expect(apiErr.status).toBe(422);
        expect(apiErr.errorCode).toBe("http_422");
      }
    });

    it("maps AbortError to NetworkError (timeout when no external signal)", async () => {
      const abortError = new DOMException("Aborted", "AbortError");
      globalThis.fetch = vi
        .fn()
        .mockRejectedValue(abortError) as unknown as typeof fetch;

      await expect(
        client.get("/api/v1/tasks", undefined, { timeoutMs: 0 }),
      ).rejects.toSatisfy(
        (error: unknown) =>
          error instanceof NetworkError &&
          error.message === "Request timed out",
      );
    });

    it("forwards external aborts and reports cancellation without retrying", async () => {
      const controller = new AbortController();
      const fetchMock = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        });
      });
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      const request = client.get("/api/v1/tasks", undefined, {
        signal: controller.signal,
        timeoutMs: 0,
      });
      controller.abort();

      await expect(request).rejects.toSatisfy(
        (error: unknown) =>
          error instanceof NetworkError &&
          error.message === "Request cancelled",
      );
      expect(fetchMock).toHaveBeenCalledOnce();
    });

    it("does not emit structured ErrorToast by default (list GET path)", async () => {
      const emitSpy = vi.spyOn(errorToastEmitter, "emit");
      mockFetch({
        ok: false,
        status: 400,
        json: () =>
          Promise.resolve({
            error_code: "VALIDATION_ERROR",
            message: "bad request",
            correlation_id: "corr-1",
            details: null,
          }),
      });

      await expect(client.get("/api/v1/tasks")).rejects.toThrow(
        ApiRequestError,
      );
      expect(emitSpy).not.toHaveBeenCalled();
    });

    it("emits structured ErrorToast when emitErrorToast is opted in", async () => {
      const emitSpy = vi.spyOn(errorToastEmitter, "emit");
      mockFetch({
        ok: false,
        status: 503,
        json: () =>
          Promise.resolve({
            error_code: "COLLECTOR_UNAVAILABLE",
            message: "down",
            correlation_id: "corr-2",
            details: null,
          }),
      });

      await expect(
        client.post(
          "/api/v1/sources",
          {},
          { emitErrorToast: true, timeoutMs: 0 },
        ),
      ).rejects.toThrow(ApiRequestError);
      expect(emitSpy).toHaveBeenCalledOnce();
      expect(emitSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          errorCode: "COLLECTOR_UNAVAILABLE",
          message: "down",
          correlationId: "corr-2",
        }),
      );
    });
  });
});
