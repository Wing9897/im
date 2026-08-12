import { beforeEach, describe, expect, it, vi } from "vitest";
import { postAgentChat, streamAgentChat } from "./agent";
import { apiClient } from "./client";

vi.mock("./client", () => ({
  apiClient: {
    post: vi.fn(),
    getToken: vi.fn(() => undefined),
  },
  resolveBaseUrl: vi.fn(() => "http://127.0.0.1:18820"),
  ApiRequestError: class ApiRequestError extends Error {
    status: number;
    constructor(status: number, apiError: { message: string }) {
      super(apiError.message);
      this.status = status;
    }
  },
  NetworkError: class NetworkError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "NetworkError";
    }
  },
}));

describe("postAgentChat", () => {
  beforeEach(() => {
    vi.mocked(apiClient.post).mockReset();
  });

  it("posts messages and optional sessionId", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      message: "未來 7 天有 2 件事。",
      sessionId: "sess-1",
      toolCalls: [
        {
          name: "calendar.upcoming",
          arguments: { limit: 20 },
          resultSummary: "2 events",
        },
      ],
    });

    const result = await postAgentChat({
      messages: [{ role: "user", content: "未來七天有什麼？" }],
      sessionId: "sess-1",
      locale: "en",
    });

    expect(apiClient.post).toHaveBeenCalledWith("/api/v1/agent/chat", {
      messages: [{ role: "user", content: "未來七天有什麼？" }],
      sessionId: "sess-1",
      locale: "en",
    });
    expect(result.message).toContain("2 件事");
    expect(result.toolCalls).toHaveLength(1);
  });

  it("omits sessionId and locale when absent", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      message: "ok",
      sessionId: "new",
      toolCalls: [],
    });

    await postAgentChat({
      messages: [{ role: "user", content: "hi" }],
    });

    expect(apiClient.post).toHaveBeenCalledWith("/api/v1/agent/chat", {
      messages: [{ role: "user", content: "hi" }],
    });
  });

  it("forwards worksetId", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      message: "ok",
      sessionId: "new",
      toolCalls: [],
    });

    await postAgentChat({
      messages: [{ role: "user", content: "加日程" }],
      worksetId: "__user__",
    });

    expect(apiClient.post).toHaveBeenCalledWith("/api/v1/agent/chat", {
      messages: [{ role: "user", content: "加日程" }],
      worksetId: "__user__",
    });
  });

  it("forwards llmProfileId when set and omits blank", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      message: "ok",
      sessionId: "new",
      toolCalls: [],
    });

    await postAgentChat({
      messages: [{ role: "user", content: "hi" }],
      llmProfileId: "profile-or",
    });
    expect(apiClient.post).toHaveBeenCalledWith("/api/v1/agent/chat", {
      messages: [{ role: "user", content: "hi" }],
      llmProfileId: "profile-or",
    });

    await postAgentChat({
      messages: [{ role: "user", content: "hi" }],
      llmProfileId: "  ",
    });
    expect(apiClient.post).toHaveBeenLastCalledWith("/api/v1/agent/chat", {
      messages: [{ role: "user", content: "hi" }],
    });
  });

  it("forwards surface and currentTask when provided", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      message: "ok",
      sessionId: "new",
      toolCalls: [],
      taskConfig: { name: "patched" },
    });

    const result = await postAgentChat({
      messages: [{ role: "user", content: "改名稱" }],
      surface: "task_editor",
      currentTask: { name: "draft", promptTemplate: "p" },
    });

    expect(apiClient.post).toHaveBeenCalledWith("/api/v1/agent/chat", {
      messages: [{ role: "user", content: "改名稱" }],
      surface: "task_editor",
      currentTask: { name: "draft", promptTemplate: "p" },
    });
    expect(result.taskConfig).toEqual({ name: "patched" });
  });
});

describe("streamAgentChat", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("parses NDJSON tool events and resolves final response", async () => {
    const onToolStart = vi.fn();
    const onToolDone = vi.fn();
    const body = [
      '{"type":"llm_start","round":0}\n',
      '{"type":"tool_start","name":"calendar.upcoming","arguments":{"limit":5}}\n',
      '{"type":"tool_done","name":"calendar.upcoming","arguments":{"limit":5},"resultSummary":"2 items"}\n',
      '{"type":"final","message":"接下來幾天有週會。","sessionId":"s2","toolCalls":[{"name":"calendar.upcoming","arguments":{"limit":5},"resultSummary":"2 items"}]}\n',
    ].join("");

    vi.mocked(fetch).mockResolvedValue(
      new Response(body, {
        status: 200,
        headers: { "Content-Type": "application/x-ndjson" },
      }),
    );

    const result = await streamAgentChat(
      {
        messages: [{ role: "user", content: "未來有什麼？" }],
        sessionId: "s2",
        locale: "zh-Hant",
      },
      { onToolStart, onToolDone },
    );

    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:18820/api/v1/agent/chat/stream",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          messages: [{ role: "user", content: "未來有什麼？" }],
          sessionId: "s2",
          locale: "zh-Hant",
        }),
      }),
    );
    expect(onToolStart).toHaveBeenCalledWith({
      type: "tool_start",
      name: "calendar.upcoming",
      arguments: { limit: 5 },
    });
    expect(onToolDone).toHaveBeenCalledWith({
      type: "tool_done",
      name: "calendar.upcoming",
      arguments: { limit: 5 },
      resultSummary: "2 items",
    });
    expect(result.message).toContain("週會");
    expect(result.sessionId).toBe("s2");
    expect(result.toolCalls).toHaveLength(1);
  });

  it("forwards worksetId on the stream body", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('{"type":"final","message":"ok","sessionId":"s3","toolCalls":[]}\n', {
        status: 200,
        headers: { "Content-Type": "application/x-ndjson" },
      }),
    );

    await streamAgentChat({
      messages: [{ role: "user", content: "記一下" }],
      worksetId: "ct-1",
    });

    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:18820/api/v1/agent/chat/stream",
      expect.objectContaining({
        body: JSON.stringify({
          messages: [{ role: "user", content: "記一下" }],
          worksetId: "ct-1",
        }),
      }),
    );
  });

  it("forwards surface/currentTask and returns final taskConfig", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        `${JSON.stringify({
          type: "final",
          message: "已更新",
          sessionId: "s4",
          toolCalls: [
            {
              name: "tasks.consult_advisor",
              arguments: { instruction: "改名" },
              resultSummary: "ok",
            },
          ],
          taskConfig: { name: "新名稱", promptTemplate: "分析熱門話題" },
        })}\n`,
        {
          status: 200,
          headers: { "Content-Type": "application/x-ndjson" },
        },
      ),
    );

    const result = await streamAgentChat({
      messages: [{ role: "user", content: "改任務名" }],
      surface: "task_editor",
      currentTask: { name: "舊名", promptTemplate: "分析熱門話題" },
    });

    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:18820/api/v1/agent/chat/stream",
      expect.objectContaining({
        body: JSON.stringify({
          messages: [{ role: "user", content: "改任務名" }],
          surface: "task_editor",
          currentTask: { name: "舊名", promptTemplate: "分析熱門話題" },
        }),
      }),
    );
    expect(result.taskConfig).toEqual({
      name: "新名稱",
      promptTemplate: "分析熱門話題",
    });
  });
});
