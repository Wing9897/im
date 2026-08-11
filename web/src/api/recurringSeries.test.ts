import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "./client";
import {
  createRecurringSeries,
  deleteRecurringSeries,
  getRecurringSeries,
  listRecurringSeries,
  patchRecurringSeries,
} from "./recurringSeries";

vi.mock("./client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("recurringSeries API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists with calendar filters and paging", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      items: [],
      totalCount: 0,
      hasMore: false,
    });

    await listRecurringSeries({
      worksetId: "ws-1",
      itemId: "item-1",
      parentTaskId: "agent-1",
      topLevelOnly: true,
      search: "weekly",
      limit: 24,
      offset: 48,
    });

    expect(apiClient.get).toHaveBeenCalledWith("/api/v1/calendar/recurring", {
      worksetId: "ws-1",
      itemId: "item-1",
      parentTaskId: "agent-1",
      topLevelOnly: "true",
      search: "weekly",
      limit: "24",
      offset: "48",
    });
  });

  it("uses standalone CRUD endpoints", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ id: "series-1" });
    vi.mocked(apiClient.get).mockResolvedValue({ id: "series-1" });
    vi.mocked(apiClient.patch).mockResolvedValue({ id: "series-1" });
    vi.mocked(apiClient.delete).mockResolvedValue(undefined);

    await createRecurringSeries({ name: "Weekly", rrule: "FREQ=WEEKLY" });
    await getRecurringSeries("series-1");
    await patchRecurringSeries("series-1", { isActive: false });
    await deleteRecurringSeries("series-1");

    expect(apiClient.post).toHaveBeenCalledWith("/api/v1/calendar/recurring", {
      name: "Weekly",
      rrule: "FREQ=WEEKLY",
    });
    expect(apiClient.get).toHaveBeenCalledWith(
      "/api/v1/calendar/recurring/series-1",
    );
    expect(apiClient.patch).toHaveBeenCalledWith(
      "/api/v1/calendar/recurring/series-1",
      { isActive: false },
    );
    expect(apiClient.delete).toHaveBeenCalledWith(
      "/api/v1/calendar/recurring/series-1",
    );
  });
});
