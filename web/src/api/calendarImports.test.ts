import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPost } = vi.hoisted(() => ({ mockPost: vi.fn() }));

vi.mock("./client", () => ({
  apiClient: { post: mockPost },
}));

const { commitCalendarImport, previewCalendarImport } = await import("./calendarImports");

describe("calendar import API", () => {
  beforeEach(() => {
    mockPost.mockReset().mockResolvedValue({});
  });

  it("previews raw ICS using the generated request contract", async () => {
    await previewCalendarImport({ content: "BEGIN:VCALENDAR", sourceId: "ics" });

    expect(mockPost).toHaveBeenCalledWith(
      "/api/v1/calendar-imports/preview",
      { content: "BEGIN:VCALENDAR", sourceId: "ics" },
    );
  });

  it("commits the selected UID and preview fingerprint", async () => {
    await commitCalendarImport({
      content: "BEGIN:VCALENDAR",
      sourceId: "ics",
      selections: [{ uid: "event-1", fingerprint: "sha256" }],
    });

    expect(mockPost).toHaveBeenCalledWith(
      "/api/v1/calendar-imports/commit",
      {
        content: "BEGIN:VCALENDAR",
        sourceId: "ics",
        selections: [{ uid: "event-1", fingerprint: "sha256" }],
      },
    );
  });
});
