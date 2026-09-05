import React, { type ComponentType, type LazyExoticComponent } from "react";
import { useTranslation } from "react-i18next";
import { PageErrorBoundary } from "../components/common/PageErrorBoundary";
import { LoadingSpinner } from "../components/common/LoadingSpinner";

type ModuleRecord = Record<string, unknown>;

const lazyByExport = new Map<string, LazyExoticComponent<ComponentType<unknown>>>();

/**
 * Register a named page export as a stable React.lazy exotic type.
 *
 * Call once at module scope (see AppRoutes). Cache by exportName so accidental
 * double registration still returns the same type — changing the exotic type
 * identity mid-session remounts routes and breaks sidebar navigation.
 */
export function lazyNamed(
  loader: () => Promise<ModuleRecord>,
  exportName: string,
): LazyExoticComponent<ComponentType<unknown>> {
  let Lazy = lazyByExport.get(exportName);
  if (!Lazy) {
    Lazy = React.lazy(() =>
      loader().then((module) => {
        const page = module[exportName];
        if (typeof page !== "function" && (typeof page !== "object" || page === null)) {
          throw new Error(`lazyNamed: export "${exportName}" missing from module`);
        }
        return { default: page as ComponentType<unknown> };
      }),
    );
    lazyByExport.set(exportName, Lazy);
  }
  return Lazy;
}

/** Wrap a module-level lazyNamed page with Suspense + PageErrorBoundary. */
export function LazyPage({
  Page,
}: {
  Page: LazyExoticComponent<ComponentType<unknown>>;
}): React.ReactElement {
  const { t } = useTranslation("common");
  return (
    <PageErrorBoundary>
      <React.Suspense fallback={<LoadingSpinner text={t("ui.pageLoading")} />}>
        <Page />
      </React.Suspense>
    </PageErrorBoundary>
  );
}

/** Test-only: clear the lazy cache between cases. Production builds drop the body. */
export function resetLazyPageCacheForTests(): void {
  lazyByExport.clear();
}
