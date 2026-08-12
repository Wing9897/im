import React from "react";
import i18n from "../../i18n";
import { Button } from "../ui";
import { logError } from "../../utils/logger";

interface LazyLoadErrorBoundaryProps {
  children?: React.ReactNode;
  fallbackHeight?: number | string;
}

interface LazyLoadErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary designed for lazy-loaded (code-split) components.
 */
export class LazyLoadErrorBoundary extends React.Component<
  LazyLoadErrorBoundaryProps,
  LazyLoadErrorBoundaryState
> {
  constructor(props: LazyLoadErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): LazyLoadErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logError(`[LazyLoadErrorBoundary] ${error.message}`, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const { fallbackHeight } = this.props;
      const heightStyle =
        fallbackHeight != null ? { height: fallbackHeight } : undefined;

      return (
        <div
          data-testid="lazy-load-error-boundary"
          style={heightStyle}
          className={`im-material-panel flex flex-col items-center justify-center rounded-md p-2xl text-center${
            fallbackHeight == null ? " min-h-[120px]" : ""
          }`}
        >
          <div className="mb-md text-body leading-normal text-text-secondary">
            {i18n.t("ui.lazyLoadError")}
          </div>
          <Button
            type="button"
            data-testid="lazy-load-retry-button"
            variant="secondary"
            size="md"
            onClick={this.handleRetry}
          >
            {i18n.t("ui.retry")}
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
