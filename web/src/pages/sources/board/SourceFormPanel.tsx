import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { sectionTitleClass } from "../../../components/ui/pageTypography";

interface SourceFormPanelProps {
  title: string;
  description?: string;
  itemCount: number;
  children: ReactNode;
}

export function SourceFormPanel({
  title,
  description,
  itemCount,
  children,
}: SourceFormPanelProps) {
  const { t } = useTranslation("sources");
  const [collapsed, setCollapsed] = useState(itemCount > 0);

  useEffect(() => {
    if (itemCount === 0) {
      setCollapsed(false);
    }
  }, [itemCount]);

  return (
    <section
      className="flex min-h-0 flex-col overflow-hidden bg-transparent"
      aria-label={title}
    >
      <div
        className={[
          "flex shrink-0 items-start justify-between gap-sm px-lg py-md",
          collapsed ? "" : "border-b border-[color-mix(in_srgb,var(--surface-border)_80%,transparent)]",
        ].join(" ")}
      >
        <div>
          <h2 className={sectionTitleClass}>{title}</h2>
          {description ? (
            <p className="mt-1 text-caption leading-snug text-text-muted">{description}</p>
          ) : null}
        </div>
        {itemCount > 0 ? (
          <button
            type="button"
            className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-text-muted transition-colors hover:bg-[color-mix(in_srgb,var(--surface-overlay)_55%,transparent)] hover:text-text-primary"
            aria-expanded={!collapsed}
            aria-label={collapsed ? t("layout.expandForm") : t("layout.collapseForm")}
            onClick={() => setCollapsed((value) => !value)}
          >
            <ChevronDown
              size={16}
              strokeWidth={2}
              aria-hidden="true"
              style={{
                transform: collapsed ? "none" : "rotate(180deg)",
                transition: "transform 150ms ease",
              }}
            />
          </button>
        ) : null}
      </div>
      {!collapsed ? (
        <div className="flex min-h-0 flex-1 flex-col px-lg py-md pb-lg">{children}</div>
      ) : null}
    </section>
  );
}
