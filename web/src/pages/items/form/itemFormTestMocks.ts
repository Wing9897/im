import { vi } from "vitest";

import "../../../test/i18nIdentityMock";

export const showToast = vi.fn();
export const listUserEventsPage = vi.fn(() =>
  Promise.resolve({ items: [] as unknown[], totalCount: 0, hasMore: false }),
);
export const listRecurringSeries = vi.fn(() =>
  Promise.resolve({ items: [] as unknown[], totalCount: 0, hasMore: false }),
);
export const updateUserEvent = vi.fn(() => Promise.resolve({}));
export const createUserEvent = vi.fn(() => Promise.resolve({}));
export const deleteUserEvent = vi.fn(() => Promise.resolve(undefined));
export const deleteRecurringSeries = vi.fn(() => Promise.resolve(undefined));
export const listItems = vi.fn(() => Promise.resolve([] as unknown[]));

vi.mock("../../../context/ToastContext", () => ({
  useToast: () => ({ showToast }),
}));

vi.mock("../../../api/userEvents", () => ({
  listUserEventsPage: (...args: unknown[]) =>
    (listUserEventsPage as (...a: unknown[]) => unknown)(...args),
  createUserEvent: (...args: unknown[]) =>
    (createUserEvent as (...a: unknown[]) => unknown)(...args),
  updateUserEvent: (...args: unknown[]) =>
    (updateUserEvent as (...a: unknown[]) => unknown)(...args),
  deleteUserEvent: (...args: unknown[]) =>
    (deleteUserEvent as (...a: unknown[]) => unknown)(...args),
}));

vi.mock("../../../api/items", async () => {
  const actual = await vi.importActual<typeof import("../../../api/items")>("../../../api/items");
  return {
    ...actual,
    listItems: (...args: unknown[]) =>
      (listItems as (...a: unknown[]) => unknown)(...args),
  };
});

vi.mock("../../../api/recurringSeries", () => ({
  listRecurringSeries: (...args: unknown[]) =>
    (listRecurringSeries as (...a: unknown[]) => unknown)(...args),
  deleteRecurringSeries: (...args: unknown[]) =>
    (deleteRecurringSeries as (...a: unknown[]) => unknown)(...args),
}));
