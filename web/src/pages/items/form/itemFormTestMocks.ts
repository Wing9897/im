import { vi } from "vitest";

import "../../../test/i18nIdentityMock";

export const showToast = vi.fn();
export const listUserEvents = vi.fn(async () => [] as unknown[]);
export const listTasks = vi.fn(async () => [] as unknown[]);
export const updateUserEvent = vi.fn(async () => ({}));
export const createUserEvent = vi.fn(async () => ({}));
export const deleteUserEvent = vi.fn(async () => undefined);
export const deleteTask = vi.fn(async () => ({}));
export const listItems = vi.fn(async () => [] as unknown[]);

vi.mock("../../../context/ToastContext", () => ({
  useToast: () => ({ showToast }),
}));

vi.mock("../../../api/userEvents", () => ({
  listUserEvents: (...args: unknown[]) => listUserEvents(...args),
  createUserEvent: (...args: unknown[]) => createUserEvent(...args),
  updateUserEvent: (...args: unknown[]) => updateUserEvent(...args),
  deleteUserEvent: (...args: unknown[]) => deleteUserEvent(...args),
}));

vi.mock("../../../api/items", async () => {
  const actual = await vi.importActual<typeof import("../../../api/items")>("../../../api/items");
  return {
    ...actual,
    listItems: (...args: unknown[]) => listItems(...args),
  };
});

vi.mock("../../../api/tasks", () => ({
  listTasks: (...args: unknown[]) => listTasks(...args),
  deleteTask: (...args: unknown[]) => deleteTask(...args),
}));
