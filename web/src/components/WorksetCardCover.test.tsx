import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_WORKSET_COVER_URL } from "../domain/worksets/worksetCover";
import { WorksetCardCover } from "./WorksetCardCover";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      if (key === "uploadCover") return "Upload cover";
      if (key === "resetCover") return "Remove cover";
      if (key === "changeCoverAria") return "Change cover";
      return key;
    },
  }),
}));

describe("WorksetCardCover", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;
  const onPickFile = vi.fn();
  const onClear = vi.fn();

  beforeEach(() => {
    onPickFile.mockClear();
    onClear.mockClear();
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

  async function renderCover(cover = "", props: Partial<Parameters<typeof WorksetCardCover>[0]> = {}) {
    await act(async () => {
      root = createRoot(container);
      root.render(
        createElement(WorksetCardCover, {
          cover,
          name: "Ops",
          onPickFile,
          onClear,
          ...props,
        }),
      );
    });
  }

  function uploadButton() {
    return container.querySelector('[data-testid="workset-card-cover-upload"]') as HTMLButtonElement | null;
  }

  function fileInput() {
    return container.querySelector('[data-testid="workset-card-cover-file"]') as HTMLInputElement | null;
  }

  it("shows an always-visible upload label on the cover strip", async () => {
    await renderCover();
    const label = container.querySelector('[data-testid="workset-card-cover-upload-label"]');
    expect(label).not.toBeNull();
    expect(label?.textContent ?? "").toContain("Upload cover");
    expect(label?.className ?? "").not.toContain("opacity-0");
    expect(label?.className ?? "").toContain("whitespace-nowrap");
    expect(uploadButton()?.className ?? "").toContain("h-full");
    expect(uploadButton()?.className ?? "").toContain("w-full");
    expect(uploadButton()?.className ?? "").not.toContain("aspect-[16/9]");
    const coverClass = container.querySelector('[data-testid="workset-card-cover"]')?.className ?? "";
    expect(coverClass).toContain("h-28");
    expect(coverClass).toContain("w-full");
    expect(coverClass).not.toContain("min-h-[7rem]");
  });

  it("uses the default placeholder when no custom cover is set", async () => {
    await renderCover();
    const preview = container.querySelector(
      '[data-testid="workset-card-cover-preview"]',
    ) as HTMLImageElement | null;
    expect(preview?.getAttribute("src")).toBe(DEFAULT_WORKSET_COVER_URL);
    expect(container.querySelector('[data-testid="workset-card-cover-reset"]')).toBeNull();
  });

  it("shows remove cover when a custom cover is set", async () => {
    await renderCover("data:image/png;base64,abc");
    expect(container.querySelector('[data-testid="workset-card-cover-reset"]')).not.toBeNull();
  });

  it("stays interactive after the file picker is cancelled", async () => {
    await renderCover();
    const upload = uploadButton();
    const input = fileInput();
    expect(upload).not.toBeNull();
    expect(input).not.toBeNull();

    await act(async () => {
      upload!.click();
    });

    await act(async () => {
      input!.dispatchEvent(new Event("cancel", { bubbles: true }));
    });

    expect(upload!.disabled).toBe(false);
    expect(upload!.getAttribute("aria-busy")).toBeNull();
    expect(container.querySelector('[data-testid="workset-card-cover-processing"]')).toBeNull();
    expect(onPickFile).not.toHaveBeenCalled();
  });

  it("clears processing when change fires with no file", async () => {
    await renderCover();
    const upload = uploadButton();
    const input = fileInput();

    await act(async () => {
      upload!.click();
    });

    Object.defineProperty(input!, "files", {
      configurable: true,
      value: { length: 0, item: () => null },
    });

    await act(async () => {
      input!.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(onPickFile).not.toHaveBeenCalled();
    expect(upload!.disabled).toBe(false);
    expect(container.querySelector('[data-testid="workset-card-cover-processing"]')).toBeNull();
  });

  it("shows processing while onPickFile is pending and clears after resolve", async () => {
    let resolvePick: (() => void) | undefined;
    onPickFile.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolvePick = resolve;
        }),
    );

    await renderCover();
    const upload = uploadButton();
    const input = fileInput();
    const file = new File(["x"], "cover.png", { type: "image/png" });

    Object.defineProperty(input!, "files", {
      configurable: true,
      value: {
        0: file,
        length: 1,
        item: (index: number) => (index === 0 ? file : null),
      },
    });

    await act(async () => {
      input!.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(upload!.disabled).toBe(true);
    expect(upload!.getAttribute("aria-busy")).toBe("true");
    expect(container.querySelector('[data-testid="workset-card-cover-processing"]')).not.toBeNull();

    await act(async () => {
      resolvePick?.();
      await Promise.resolve();
    });

    expect(upload!.disabled).toBe(false);
    expect(upload!.getAttribute("aria-busy")).toBeNull();
    expect(container.querySelector('[data-testid="workset-card-cover-processing"]')).toBeNull();
  });

  it("clears processing when onPickFile rejects", async () => {
    onPickFile.mockRejectedValue(new Error("read_failed"));
    await renderCover();
    const input = fileInput();
    const file = new File(["x"], "cover.png", { type: "image/png" });

    Object.defineProperty(input!, "files", {
      configurable: true,
      value: {
        0: file,
        length: 1,
        item: (index: number) => (index === 0 ? file : null),
      },
    });

    await act(async () => {
      input!.dispatchEvent(new Event("change", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(uploadButton()!.disabled).toBe(false);
    expect(container.querySelector('[data-testid="workset-card-cover-processing"]')).toBeNull();
  });
});
