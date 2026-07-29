import type React from "react";
import type { ThemeEntry } from "../../styles/themeData";

export const MAX_BG_SIZE = 2 * 1024 * 1024; // 2 MB

function ThemeCard({
  th,
  isActive,
  onSelect,
}: {
  th: ThemeEntry;
  isActive: boolean;
  onSelect: (id: string) => void;
}) {
  const cardBg = th.gradient ?? "var(--surface-card)";

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(th.id);
    }
  };

  return (
    <div
      tabIndex={0}
      role="button"
      aria-pressed={isActive}
      aria-label={th.name}
      onClick={() => onSelect(th.id)}
      onKeyDown={handleKeyDown}
      className={[
        "flex cursor-pointer flex-col items-center gap-xs rounded-md border-2 p-md transition-[border-color,box-shadow,transform] duration-150",
        isActive
          ? "border-accent shadow-[var(--shadow-glow-accent)]"
          : "border-transparent hover:-translate-y-px hover:border-[color-mix(in_srgb,var(--accent)_35%,transparent)] hover:shadow-[0_4px_12px_color-mix(in_srgb,var(--text-primary)_8%,transparent)]",
      ].join(" ")}
      style={{ background: cardBg }}
    >
      <div className="flex gap-1">
        {th.colors.map((c, i) => (
          <span
            key={i}
            className="inline-block h-3 w-3 rounded-full"
            style={{
              background: c,
              boxShadow: th.special ? `0 0 6px ${c}` : undefined,
            }}
          />
        ))}
      </div>
      <span
        className={[
          "text-center text-xs",
          isActive ? "font-semibold" : "font-normal",
          th.special ? "" : "text-text-secondary",
        ].join(" ")}
        style={th.special ? { color: th.colors[3] } : undefined}
      >
        {th.name}
      </span>
    </div>
  );
}

export function ThemeSection({
  title,
  themes,
  activeId,
  onSelect,
  showDivider = false,
}: {
  title: string;
  themes: readonly ThemeEntry[];
  activeId: string;
  onSelect: (id: string) => void;
  showDivider?: boolean;
}) {
  return (
    <section
      className={showDivider ? "mt-lg pt-lg" : ""}
      aria-label={title}
    >
      <h3 className="mb-sm text-caption font-semibold text-text-muted">{title}</h3>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-md">
        {themes.map((th) => (
          <ThemeCard
            key={th.id}
            th={th}
            isActive={activeId === th.id}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
}
