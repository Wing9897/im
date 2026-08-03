/**
 * Shared board test wrappers.
 *
 * Board widgets read `useAnalysisStatus` / `useTaskCatalog` / monitor mode.
 * Always mock AnalysisStatus via:
 *
 * ```ts
 * vi.mock("../context/AnalysisStatusContext", async () =>
 *   (await import("../test/context-mocks")).analysisStatusModuleMock());
 * ```
 *
 * Then wrap UI with `wrapBoardProviders(node)` so MemoryRouter + MonitorMode
 * are present (and hard to forget as a pair).
 */
import { createElement, type ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";

import { MonitorModeProvider } from "../context/MonitorModeContext";

export type WrapBoardProvidersOptions = {
  /** Initial history entries for MemoryRouter (default `["/"]`). */
  initialEntries?: string[];
};

/** MemoryRouter + MonitorModeProvider — standard outer shell for board unit tests. */
export function wrapBoardProviders(
  node: ReactNode,
  options: WrapBoardProvidersOptions = {},
) {
  const { initialEntries = ["/"] } = options;
  return createElement(
    MemoryRouter,
    { initialEntries },
    createElement(MonitorModeProvider, null, node),
  );
}
