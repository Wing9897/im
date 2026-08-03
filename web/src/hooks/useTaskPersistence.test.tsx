import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useTaskPersistence } from "./useTaskPersistence";
import { DEFAULT_FORM_STATE, type TaskFormState } from "./useTaskEditorState";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();
const mockRefreshTasks = vi.fn().mockResolvedValue(undefined);

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ taskId: undefined }),
}));

vi.mock("../context/ToastContext", async () =>
  (await import("../test/context-mocks")).toastContextModuleMock());

vi.mock("../context/TaskCatalogContext", () => ({
  useTaskCatalog: () => ({ refreshTasks: mockRefreshTasks }),
}));

vi.mock("../api/tasks", () => ({
  createTask: vi.fn(),
  createRecurringTask: vi.fn(),
  updateTask: vi.fn(),
  listTasks: vi.fn(),
}));

vi.mock("../utils/errors", () => ({
  handleCommandError: vi.fn((err: unknown) =>
    err instanceof Error ? err.message : String(err),
  ),
}));

import { mockShowToast } from "../test/context-mocks";
import { createRecurringTask, createTask, updateTask } from "../api/tasks";

const mockCreateTask = createTask as ReturnType<typeof vi.fn>;
const mockCreateRecurringTask = createRecurringTask as ReturnType<typeof vi.fn>;
const mockUpdateTask = updateTask as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

let latestResult: ReturnType<typeof useTaskPersistence> | null = null;

/** Filled create payload on top of editor SoT (keeps scheduleRrule in sync). */
const FILLED_FORM_STATE: TaskFormState = {
  ...DEFAULT_FORM_STATE,
  name: "My Task",
  description: "A test task",
  promptTemplate: "Analyze this",
  analysisMode: "leaderboard",
  channelIds: ["ch-1"],
};

function Harness({
  formState,
  onError,
}: {
  formState: TaskFormState;
  onError: (msg: string) => void;
}) {
  const setFormState = vi.fn();
  const isMountedRef = { current: true };

  latestResult = useTaskPersistence({
    formState,
    setFormState,
    isMountedRef,
    onError,
  } as Parameters<typeof useTaskPersistence>[0]);
  return null;
}

function renderHarness(props?: Partial<{ formState: TaskFormState; onError: (msg: string) => void }>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const onError = props?.onError ?? vi.fn();
  act(() => {
    root.render(<Harness formState={props?.formState ?? FILLED_FORM_STATE} onError={onError} />);
  });
  return { container, root, onError };
}

function cleanup(root: Root, container: HTMLElement) {
  act(() => {
    root.unmount();
  });
  container.remove();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useTaskPersistence", () => {
  beforeEach(() => {
    latestResult = null;
    mockNavigate.mockClear();
    mockShowToast.mockClear();
    mockRefreshTasks.mockClear();
    mockCreateTask.mockReset();
    mockCreateRecurringTask.mockReset();
    mockUpdateTask.mockReset();
  });

  afterEach(() => {
    latestResult = null;
  });

  it("success path: creates a task, shows toast, refreshes, and navigates to /tasks", async () => {
    mockCreateTask.mockResolvedValue({ id: "new-id" });

    const { container, root } = renderHarness();

    expect(latestResult!.isSaving).toBe(false);

    await act(async () => {
      await latestResult!.save();
    });

    expect(mockCreateTask).toHaveBeenCalledTimes(1);
    expect(mockCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({ name: "My Task", promptTemplate: "Analyze this" }),
    );
    expect(mockShowToast).toHaveBeenCalledWith("任務已建立", "success");
    expect(mockRefreshTasks).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/tasks");
    expect(latestResult!.isSaving).toBe(false);

    cleanup(root, container);
  });

  it("error path: calls onError when createTask throws", async () => {
    mockCreateTask.mockRejectedValue(new Error("Server Error"));

    const onError = vi.fn();
    const { container, root } = renderHarness({ onError });

    await act(async () => {
      await latestResult!.save();
    });

    expect(onError).toHaveBeenCalledWith("Server Error");
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(latestResult!.isSaving).toBe(false);

    cleanup(root, container);
  });

  it("recurring create uses atomic POST /tasks/recurring (not shell+PUT)", async () => {
    mockCreateRecurringTask.mockResolvedValue({ id: "rec-1" });

    const recurringForm: TaskFormState = {
      ...FILLED_FORM_STATE,
      analysisMode: "recurring",
      promptTemplate: "",
      webSearchQuery: "",
      channelIds: [],
      rrule: "FREQ=DAILY",
      eventStartTime: "22:00",
      eventEndTime: "06:00",
      worksetId: "ws-1",
    };
    const { container, root } = renderHarness({ formState: recurringForm });

    await act(async () => {
      await latestResult!.save();
    });

    expect(mockCreateRecurringTask).toHaveBeenCalledTimes(1);
    expect(mockCreateRecurringTask).toHaveBeenCalledWith({
      name: "My Task",
      description: "A test task",
      rrule: "FREQ=DAILY",
      eventStartTime: "22:00",
      eventEndTime: "06:00",
      eventIsAllDay: false,
      eventLocation: null,
      eventDescription: null,
      worksetId: "ws-1",
    });
    expect(mockCreateTask).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/tasks");

    cleanup(root, container);
  });

  it("recurring create failure does not call createTask (no orphan shell)", async () => {
    mockCreateRecurringTask.mockRejectedValue(new Error("schedule invalid"));
    const onError = vi.fn();
    const recurringForm: TaskFormState = {
      ...FILLED_FORM_STATE,
      analysisMode: "recurring",
      rrule: "FREQ=DAILY",
      eventStartTime: "09:00",
    };
    const { container, root } = renderHarness({ formState: recurringForm, onError });

    await act(async () => {
      await latestResult!.save();
    });

    expect(mockCreateRecurringTask).toHaveBeenCalled();
    expect(mockCreateTask).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith("schedule invalid");
    expect(mockNavigate).not.toHaveBeenCalled();

    cleanup(root, container);
  });

  it("returns isSaving=false initially", () => {
    const { container, root } = renderHarness();

    expect(latestResult!.isSaving).toBe(false);

    cleanup(root, container);
  });
});
