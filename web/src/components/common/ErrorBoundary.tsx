import React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import i18n from "../../i18n";
import { APP_LOG_KIND, recordAppLog } from "../../api/appLogClient";
import { Button } from "../ui";
import { logError, logWarn } from "../../utils/logger";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  componentStack: string | null;
  showStack: boolean;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

/**
 * Global Error Boundary — catches unhandled component errors and
 * renders a recovery UI instead of a white screen.
 */
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, componentStack: null, showStack: false };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logError("[ErrorBoundary]", error, info.componentStack);

    this.setState({ componentStack: info.componentStack ?? null });

    recordAppLog({
      level: "error",
      category: "frontend",
      kind: APP_LOG_KIND.FRONTEND_REACT,
      message: String(
        i18n.t("ui.errorBoundary.logMessage", { message: error.message }),
      ),
      messageKey: "logs:templates.frontendReact",
      source: "frontend.ErrorBoundary",
      payload: {
        message: error.message,
        componentStack: info.componentStack ?? null,
      },
    }).catch((logErr) => {
      logWarn("[ErrorBoundary] recordAppLog failed:", logErr);
    });
  }

  handleReset = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
      return;
    }
    this.setState({ hasError: false, error: null, componentStack: null, showStack: false });
  };

  toggleStack = () => {
    this.setState((prev) => ({ showStack: !prev.showStack }));
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-surface-base p-3xl">
          <div className="im-surface-panel max-w-[480px] rounded-lg border border-error p-3xl text-center">
            <div className="mb-md text-page-title font-bold text-error">
              {i18n.t("ui.errorBoundary.title")}
            </div>
            <div className="mb-sm text-body leading-relaxed text-text-secondary">
              {i18n.t("ui.errorBoundary.body")}
            </div>
            {this.state.error ? (
              <pre className="im-surface-inset mb-lg max-h-[120px] overflow-auto whitespace-pre-wrap break-words rounded-md p-md text-left text-caption text-text-muted">
                {this.state.error.message}
              </pre>
            ) : null}
            {this.state.componentStack ? (
              <div className="mb-lg text-left">
                <button
                  type="button"
                  onClick={this.toggleStack}
                  data-testid="toggle-stack"
                  aria-expanded={this.state.showStack}
                  className="mb-xs inline-flex min-h-6 cursor-pointer items-center border-none bg-transparent p-0 text-caption font-medium text-text-secondary"
                >
                  {this.state.showStack ? (
                    <>
                      <ChevronDown size={18} strokeWidth={2} aria-hidden="true" className="mr-1" />
                      {i18n.t("ui.errorBoundary.hideStack")}
                    </>
                  ) : (
                    <>
                      <ChevronRight size={18} strokeWidth={2} aria-hidden="true" className="mr-1" />
                      {i18n.t("ui.errorBoundary.showStack")}
                    </>
                  )}
                </button>
                {this.state.showStack ? (
                  <pre
                    data-testid="component-stack"
                    className="im-surface-inset mt-xs max-h-[200px] overflow-auto whitespace-pre-wrap break-words rounded-md p-md text-[10px] text-text-muted"
                  >
                    {this.state.componentStack}
                  </pre>
                ) : null}
              </div>
            ) : null}
            <Button type="button" variant="primary" size="lg" onClick={this.handleReset}>
              {i18n.t("ui.errorBoundary.reload")}
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
