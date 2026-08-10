import { vi } from "vitest";

import "../../../test/i18nIdentityMock";

export const showToast = vi.fn();
export const listUserEvents = vi.fn(() => Promise.resolve([] as unknown[]));
export const listTasks = vi.fn(() => Promise.resolve([] as unknown[]));
export const updateUserEvent = vi.fn(() => Promise.resolve({}));
export const createUserEvent = vi.fn(() => Promise.resolve({}));
export const deleteUserEvent = vi.fn(() => Promise.resolve(undefined));
export const deleteTask = vi.fn(() => Promise.resolve({}));
export const listItems = vi.fn(() => Promise.resolve([] as unknown[]));

vi.mock("../../../context/ToastContext", () => ({
  useToast: () => ({ showToast }),
}));

vi.mock("../../../api/userEvents", () => ({
  listUserEvents: (...args: unknown[]) =>
    (listUserEvents as (...a: unknown[]) => unknown)(...args),
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

vi.mock("../../../api/tasks", () => ({
  listTasks: (...args: unknown[]) =>
    (listTasks as (...a: unknown[]) => unknown)(...args),
  deleteTask: (...args: unknown[]) =>
    (deleteTask as (...a: unknown[]) => unknown)(...args),
}));
