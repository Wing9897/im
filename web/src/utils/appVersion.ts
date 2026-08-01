/** Semver injected at build/dev time from repo-root VERSION (same as backend). */
export function formatAppVersion(): string {
  return `v${__APP_VERSION__}`;
}

/** Sidebar / settings label — DEV prefix only in Vite dev mode. */
export function formatAppVersionLabel(): string {
  const prefix = import.meta.env.DEV ? "DEV · " : "";
  return `${prefix}${formatAppVersion()}`;
}
