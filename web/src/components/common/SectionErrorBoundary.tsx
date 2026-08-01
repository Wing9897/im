import React from "react";
import { Button } from "../ui";
import i18n from "../../i18n";
import { logError } from "../../utils/logger";

interface SectionErrorBoundaryProps {
  sectionName: string;
  fallback?: React.ReactNode;
  children?: React.ReactNode;
}

interface SectionErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Section-level error boundary that catches errors in a page section
 * and renders a fallback UI without crashing the entire page.
 */
export class SectionErrorBoundary extends React.Component<
  SectionErrorBoundaryProps,
  SectionErrorBoundaryState
> {
  constructor(props: SectionErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): SectionErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logError(
      `[SectionErrorBoundary: ${this.props.sectionName}] ${error.message}`,
      info.componentStack,
    );
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="rounded-md border border-error bg-surface-card p-2xl text-center">
          <div className="mb-sm text-section-title font-semibold text-error">
            {i18n.t("sectionError.loadFailed", { name: this.props.sectionName })}
          </div>
          {this.state.error ? (
            <p className="mb-lg text-caption leading-normal text-text-secondary">
              {this.state.error.message}
            </p>
          ) : null}
          <Button type="button" variant="secondary" size="md" onClick={this.handleRetry}>
            {i18n.t("sectionError.retry")}
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
