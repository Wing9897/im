/**
 * Regression test for the stale localized「一般」workset label.
 *
 * `getGeneralWorksetLabel()` reads `i18n.t` imperatively, so a `useMemo` that
 * only lists `[tasks]` kept the label from the previously active language.
 * Consumers depend on `useGeneralWorksetLabel()` so the memo re-runs.
 */
import { act, createElement, useMemo } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import i18n from "../../i18n";
import { setAppLocale } from "../../i18n/locale";
import { getGeneralWorksetLabel } from "./userEvents";
import { useGeneralWorksetLabel } from "./useGeneralWorksetLabel";

describe("useGeneralWorksetLabel", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  /** Mirrors the real consumers: a memo keyed on the task list plus the label. */
  function MemoConsumer({ tasks }: { tasks: readonly string[] }) {
    const label = useGeneralWorksetLabel();
    const options = useMemo(() => [...tasks, label], [tasks, label]);
    return createElement("span", { "data-testid": "options" }, options.join("|"));
  }

  beforeEach(async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    setAppLocale("zh-Hant");
    await i18n.changeLanguage("zh-Hant");
  });

  afterEach(async () => {
    if (root) {
      act(() => {
        root!.unmount();
      });
      root = null;
    }
    container.remove();
    setAppLocale("zh-Hant");
    await i18n.changeLanguage("zh-Hant");
  });

  it("re-renders the memoized option list after a language change", async () => {
    const tasks = ["情報任務"];
    act(() => {
      root = createRoot(container);
      root.render(createElement(MemoConsumer, { tasks }));
    });

    const zhHant = getGeneralWorksetLabel();
    expect(container.querySelector('[data-testid="options"]')?.textContent).toBe(
      `情報任務|${zhHant}`,
    );

    await act(async () => {
      await i18n.changeLanguage("en");
    });

    const en = getGeneralWorksetLabel();
    expect(en).not.toBe(zhHant);
    expect(container.querySelector('[data-testid="options"]')?.textContent).toBe(
      `情報任務|${en}`,
    );
  });
});
