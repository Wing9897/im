import ReactDOM from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import { App } from "./App";
import { clearLegacyPrefsIfNeeded } from "./domain/prefs";
import i18n, { applyDocumentLang } from "./i18n";
import { logError } from "./utils/logger";
import "./theme.css";
import "./tailwind.css";

// First launch of prefs schema v5: wipe prior-generation `im:*` local keys.
// Board layout SoT remains server ui_prefs (unaffected).
clearLegacyPrefsIfNeeded();
applyDocumentLang();

// Global listener for unhandled promise rejections.
// Logs via the logger utility so failures are visible during development
// without crashing the application.
window.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
  const reason = event.reason instanceof Error
    ? event.reason.message
    : String(event.reason ?? "Unknown rejection");
  logError("[unhandledrejection]", reason, event.reason);
});

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root not found in document");
}
ReactDOM.createRoot(rootElement).render(
  <I18nextProvider i18n={i18n}>
    <App />
  </I18nextProvider>,
);
