import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WorksetNameDialog } from "./WorksetNameDialog";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "workset:createTitle": "Create workset",
        "workset:createHint": "Create hint",
        "workset:createSubmit": "Create",
        "workset:nameLabel": "Name",
        "workset:namePlaceholder": "Name",
        "workset:nameAria": "Name",
        "workset:label": "Workset",
        "workset:descriptionLabel": "Description",
        "workset:descriptionPlaceholder": "Description",
        "workset:descriptionAria": "Description",
        "workset:descriptionHint": "Hint",
        "workset:changeCoverAria": "Change cover",
        "workset:uploadCover": "Upload cover",
        "dialog.close": "Close",
        "dialog.cancel": "Cancel",
        "account:avatarTooLarge": "Too large",
        "account:avatarReadFailed": "Read failed",
      };
      return map[key] ?? key;
    },
  }),
}));

vi.mock("../../context/ToastContext", async () =>
  (await import("../../test/context-mocks")).toastContextModuleMock());

vi.mock("../../domain/worksets/worksetCover", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../domain/worksets/worksetCover")>();
  return {
    ...actual,
    compressWorksetCoverToDataUrl: vi.fn(),
  };
});

import { compressWorksetCoverToDataUrl } from "../../domain/worksets/worksetCover";

describe("WorksetNameDialog cover upload", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;
  const onSubmit = vi.fn();
  const onClose = vi.fn();
  const mockCompress = vi.mocked(compressWorksetCoverToDataUrl);

  beforeEach(() => {
    onSubmit.mockClear();
    onClose.mockClear();
    mockCompress.mockReset();
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
    container.remove();
  });

  async function renderDialog() {
    await act(async () => {
      root = createRoot(container);
      root.render(
        createElement(WorksetNameDialog, {
          open: true,
          mode: "create",
          onClose,
          onSubmit,
        }),
      );
    });
  }

  function dialogRoot() {
    return document.querySelector('[data-testid="workset-name-dialog"]');
  }

  function nameInput() {
    return document.querySelector('[data-testid="workset-name-input"]') as HTMLInputElement | null;
  }

  function submitButton() {
    return document.querySelector('[data-testid="workset-name-submit"]') as HTMLButtonElement | null;
  }

  function coverUpload() {
    return document.querySelector('[data-testid="workset-card-cover-upload"]') as HTMLButtonElement | null;
  }

  function coverFileInput() {
    return document.querySelector('[data-testid="workset-card-cover-file"]') as HTMLInputElement | null;
  }

  function typeInput(input: HTMLInputElement, value: string) {
    const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    act(() => {
      nativeSetter?.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  it("remains interactive after cancelling the cover file picker", async () => {
    await renderDialog();

    await act(async () => {
      coverUpload()!.click();
    });

    await act(async () => {
      coverFileInput()!.dispatchEvent(new Event("cancel", { bubbles: true }));
    });

    expect(coverUpload()!.disabled).toBe(false);
    expect(nameInput()!.disabled).toBe(false);
    expect(submitButton()!.disabled).toBe(true);

    await act(async () => {
      typeInput(nameInput()!, "Alpha");
    });

    expect(submitButton()!.disabled).toBe(false);
    expect(dialogRoot()).not.toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });
});
