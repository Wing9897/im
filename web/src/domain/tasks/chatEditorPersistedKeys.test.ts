import { beforeEach, describe, expect, it } from "vitest";
import {
  chatEditorFormStorageKey,
  chatEditorInputStorageKey,
  chatEditorMessagesStorageKey,
  clearChatEditorDrafts,
  hasMeaningfulChatEditorFormDraft,
} from "./chatEditorPersistedKeys";

describe("chatEditorPersistedKeys", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("scopes keys by new vs edit task id", () => {
    expect(chatEditorFormStorageKey(undefined)).toBe("im:tasks:chat-editor:form:new");
    expect(chatEditorFormStorageKey("t1")).toBe("im:tasks:chat-editor:form:t1");
    expect(chatEditorMessagesStorageKey("t1")).toBe("im:tasks:chat-editor:messages:t1");
    expect(chatEditorInputStorageKey(undefined)).toBe("im:tasks:chat-editor:input:new");
  });

  it("detects meaningful form drafts and clears all draft keys", () => {
    expect(hasMeaningfulChatEditorFormDraft("t1")).toBe(false);
    sessionStorage.setItem(
      chatEditorFormStorageKey("t1"),
      JSON.stringify({ name: "x", promptTemplate: "", description: "", channelIds: [] }),
    );
    expect(hasMeaningfulChatEditorFormDraft("t1")).toBe(true);

    sessionStorage.setItem(chatEditorMessagesStorageKey("t1"), "[]");
    sessionStorage.setItem(chatEditorInputStorageKey("t1"), '"hi"');
    clearChatEditorDrafts("t1");
    expect(sessionStorage.getItem(chatEditorFormStorageKey("t1"))).toBeNull();
    expect(sessionStorage.getItem(chatEditorMessagesStorageKey("t1"))).toBeNull();
    expect(sessionStorage.getItem(chatEditorInputStorageKey("t1"))).toBeNull();
  });
});
