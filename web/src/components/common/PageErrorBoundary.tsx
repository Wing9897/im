import React from "react";
import i18n from "../../i18n";
import { Button } from "../ui";
import { logError } from "../../utils/logger";

interface PageErrorBoundaryProps {
  children?: React.ReactNode;
  fallback?: React.ReactNode;
}

interface PageErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Page-level Error Boundary — wraps route-level components to catch
 * rendering errors and display a recovery UI instead of a blank page.
 */
export class PageErrorBoundary extends React.Component<
  PageErrorBoundaryProps,
  PageErrorBoundaryState
> {
  constructor(props: PageErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): Partial<PageErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logError("[PageErrorBoundary]", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          role="alert"
          className="flex min-h-[240px] flex-col items-center justify-center p-3xl"
        >
          <div className="im-material-panel max-w-[420px] rounded-lg p-3xl text-center">
            <div className="mb-md text-section-title font-semibold text-error">
              {i18n.t("ui.pageError.title")}
            </div>
            <div className="mb-lg text-body leading-relaxed text-text-secondary">
              {i18n.t("ui.pageError.body")}
            </div>
            {this.state.error ? (
              <pre className="im-surface-inset mb-lg max-h-[100px] overflow-auto whitespace-pre-wrap break-words rounded-md p-md text-left text-caption text-text-muted">
                {this.state.error.message}
              </pre>
            ) : null}
            <Button type="button" variant="primary" size="md" onClick={this.handleReset}>
              {i18n.t("ui.retry")}
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
