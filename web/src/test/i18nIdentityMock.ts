import { vi } from "vitest";

/**
 * Identity react-i18next mock: `t(key)` returns the key unchanged.
 * Side-effect import in vitest files replaces per-file vi.mock copies.
 */
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));
