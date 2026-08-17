/** Presentational switch track (no role). Pair with a single interactive ancestor. */
export function SwitchTrack({
  checked,
  size = "md",
  disabled = false,
}: {
  checked: boolean;
  size?: "sm" | "md";
  disabled?: boolean;
}) {
  const compact = size === "sm";
  return (
    <span
      className={[
        "relative shrink-0 rounded-full transition-colors duration-150",
        compact ? "h-4 w-7" : "h-6 w-11",
        checked ? "bg-accent" : "bg-surface-border",
        disabled ? "opacity-60" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden="true"
    >
      <span
        className={[
          "absolute rounded-full bg-[var(--text-on-accent,var(--surface-base))] shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-[left] duration-150",
          compact ? "top-0.5 h-3 w-3" : "top-0.5 h-5 w-5",
          checked ? (compact ? "left-[14px]" : "left-[22px]") : "left-0.5",
        ].join(" ")}
      />
    </span>
  );
}
