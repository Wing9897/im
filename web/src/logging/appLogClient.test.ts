import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../api/logs", () => ({
  appendAppLog: vi.fn(),
}));

import { appendAppLog } from "../api/logs";
import {
  APP_LOG_KIND,
  buildAppLogDetailsEnvelope,
  parseAppLogDetails,
  recordAppLog,
} from "./appLogClient";

const mockedAppend = vi.mocked(appendAppLog);

describe("appLogClient", () => {
  beforeEach(() => {
    mockedAppend.mockReset();
    mockedAppend.mockResolvedValue({
      id: "log-1",
      time: "2026-04-15T03:00:00.000Z",
      level: "error",
      category: "frontend",
      kind: APP_LOG_KIND.FRONTEND_CRITICAL,
      message: "boom",
      details: null,
    });
  });

  it("builds a v1 details envelope with messageKey and payload", () => {
    const details = buildAppLogDetailsEnvelope({
      messageKey: "logs:templates.analysisTrace",
      messageParams: { summary: "step" },
      source: "server.scheduler.batch",
      payload: { stage: "llm" },
    });
    expect(JSON.parse(details!)).toEqual({
      v: 1,
      messageKey: "logs:templates.analysisTrace",
      messageParams: { summary: "step" },
      source: "server.scheduler.batch",
      payload: { stage: "llm" },
    });
  });

  it("returns null envelope when there is no structured content", () => {
    expect(buildAppLogDetailsEnvelope({})).toBeNull();
  });

  it("posts through appendAppLog with flat LogCreate fields (no details)", async () => {
    await recordAppLog({
      level: "error",
      category: "frontend",
      kind: APP_LOG_KIND.FRONTEND_CRITICAL,
      message: "boom",
      messageKey: "logs:templates.frontendCritical",
      messageParams: { code: 1 },
      source: "frontend.critical",
      payload: { stack: "trace" },
    });

    expect(mockedAppend).toHaveBeenCalledWith({
      level: "error",
      category: "frontend",
      kind: APP_LOG_KIND.FRONTEND_CRITICAL,
      message: "boom",
      messageKey: "logs:templates.frontendCritical",
      messageParams: { code: 1 },
      source: "frontend.critical",
      payload: { stack: "trace" },
    });
  });

  it("parses legacy JSON details as payload", () => {
    const parsed = parseAppLogDetails('{"status":"subscribed"}');
    expect(parsed).toEqual({ v: 1, payload: { status: "subscribed" } });
  });
});
