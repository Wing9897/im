import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/uiPrefs", () => ({
  fetchAssistantSessions: vi.fn(async () => ({
    configured: false,
    sessions: null,
    activeSessionId: null,
  })),
  putAssistantSessions: vi.fn(async (body: {
    deviceId: string;
    sessions: unknown[];
    activeSessionId?: string | null;
  }) => ({
    configured: true,
    sessions: body.sessions,
    activeSessionId: body.activeSessionId ?? null,
  })),
}));

vi.mock("./clientInstanceId", () => ({
  getClientInstanceId: () => "test-device-id",
}));

import {
  createEmptySession,
  deleteSession,
  getActiveSessionId,
  getSession,
  listSessions,
  resetAssistantSessionsCacheForTests,
  setActiveSessionId,
  titleFromMessages,
  upsertSession,
} from "./assistantSessions";

describe("assistantSessions", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetAssistantSessionsCacheForTests();
  });

  it("creates, lists, and activates an empty session", () => {
    const created = createEmptySession();
    expect(created.title).toBe("新對話");
    expect(getActiveSessionId()).toBe(created.id);
    expect(listSessions()).toHaveLength(1);
    expect(getSession(created.id)?.messages).toEqual([]);
  });

  it("derives title from the first user message", () => {
    expect(
      titleFromMessages([
        { id: "1", role: "assistant", content: "hi" },
        { id: "2", role: "user", content: "  最近一星期有沒有家庭事務？  " },
      ]),
    ).toBe("最近一星期有沒有家庭事務？");
  });

  it("upserts messages and keeps newest sessions first", () => {
    const a = createEmptySession();
    upsertSession({
      id: a.id,
      messages: [{ id: "u1", role: "user", content: "第一則" }],
      sessionId: "srv-a",
    });
    const b = createEmptySession();
    upsertSession({
      id: b.id,
      messages: [{ id: "u2", role: "user", content: "第二則" }],
    });

    const listed = listSessions();
    expect(listed[0]?.id).toBe(b.id);
    expect(listed[0]?.title).toBe("第二則");
    expect(getSession(a.id)?.sessionId).toBe("srv-a");
  });

  it("caps stored sessions at 50", () => {
    for (let i = 0; i < 55; i += 1) {
      upsertSession({
        id: `s-${i}`,
        messages: [{ id: `m-${i}`, role: "user", content: `訊息 ${i}` }],
        updatedAt: i,
      });
    }
    expect(listSessions()).toHaveLength(50);
    expect(getSession("s-0")).toBeUndefined();
    expect(getSession("s-54")).toBeTruthy();
  });

  it("deletes a session and clears active id when needed", () => {
    const session = createEmptySession();
    setActiveSessionId(session.id);
    deleteSession(session.id);
    expect(getSession(session.id)).toBeUndefined();
    expect(getActiveSessionId()).toBeNull();
  });

  it("prunes other empty sessions when creating a new one", () => {
    createEmptySession();
    const second = createEmptySession();
    expect(listSessions()).toHaveLength(1);
    expect(listSessions()[0]?.id).toBe(second.id);
  });
});
