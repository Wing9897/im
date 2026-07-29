import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

export interface PageBreadcrumbItem {
  label: string;
  to?: string;
}

interface PageBreadcrumbProps {
  items: readonly PageBreadcrumbItem[];
  className?: string;
}

/** Lightweight path trail for nested settings / AI workspaces. */
export function PageBreadcrumb({ items, className }: PageBreadcrumbProps) {
  const { t } = useTranslation("common");
  if (items.length === 0) return null;

  return (
    <nav
      aria-label={t("ui.breadcrumb")}
      className={["mb-sm flex flex-wrap items-center gap-1.5 text-[11px]", className ?? ""]
        .filter(Boolean)
        .join(" ")}
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={`${item.label}-${index}`} className="inline-flex items-center gap-1.5">
            {index > 0 ? (
              <span className="text-text-muted/70" aria-hidden="true">
                /
              </span>
            ) : null}
            {item.to && !isLast ? (
              <Link
                to={item.to}
                className="text-text-muted no-underline transition-colors hover:text-text-primary"
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={isLast ? "font-medium text-text-primary" : "text-text-muted"}
                aria-current={isLast ? "page" : undefined}
              >
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
