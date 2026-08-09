import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WallMediaLightbox } from "./WallMediaLightbox";
import { ensureZhHantLocale, wrapWithI18n } from "../../../test/i18nHarness";

describe("WallMediaLightbox", () => {
  let root: Root | null = null;

  beforeEach(async () => {
    await ensureZhHantLocale();
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
    document.body.querySelectorAll('[role="dialog"]').forEach((node) => node.remove());
  });

  function renderLightbox(node: React.ReactNode) {
    const container = document.createElement("div");
    act(() => {
      root = createRoot(container);
      root.render(wrapWithI18n(node));
    });
    return container;
  }

  it("renders enlarged image and caption when open", () => {
    renderLightbox(
      <WallMediaLightbox
        open
        imageUrl="blob:preview"
        title="TG News · Telegram"
        caption="地震速報"
        onClose={vi.fn()}
      />,
    );

    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.body.querySelector("img")?.getAttribute("src")).toBe("blob:preview");
    expect(document.body.textContent).toContain("TG News · Telegram");
    expect(document.body.textContent).toContain("地震速報");
  });

  it("calls onClose when the close button is clicked", () => {
    const onClose = vi.fn();
    renderLightbox(
      <WallMediaLightbox open imageUrl="blob:preview" onClose={onClose} />,
    );

    act(() => {
      document.body.querySelector<HTMLButtonElement>('button[aria-label="關閉預覽"]')!.click();
    });

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("renders nothing when closed", () => {
    const container = renderLightbox(
      <WallMediaLightbox open={false} imageUrl="blob:preview" onClose={vi.fn()} />,
    );

    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });
});
