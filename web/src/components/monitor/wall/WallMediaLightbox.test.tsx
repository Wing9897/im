import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nextProvider } from "react-i18next";

import i18n from "../../../i18n";
import { setAppLocale } from "../../../i18n/locale";
import { WallMediaLightbox } from "./WallMediaLightbox";

describe("WallMediaLightbox", () => {
  let root: Root | null = null;

  beforeEach(async () => {
    setAppLocale("zh-Hant");
    await i18n.changeLanguage("zh-Hant");
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
      root.render(<I18nextProvider i18n={i18n}>{node}</I18nextProvider>);
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
