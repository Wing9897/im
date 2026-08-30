/**
 * Block (split-month) per-card accent. Stored by source identity
 * (`workset:<id>` / `subscribe:<handle/slug>` via {@link monthCardKey}).
 *
 * Persist shape is `{kind:"preset",id}` or `{kind:"hex",value}`. Bare palette
 * ids from older builds still parse.
 */

export const BLOCK_CARD_COLOR_IDS = [
  "sky",
  "teal",
  "amber",
  "rose",
  "violet",
  "coral",
  "crimson",
  "slate",
  "mint",
  "ocean",
  "gold",
  "ink",
  "indigo",
  "berry",
] as const;

export type BlockCardColorId = (typeof BLOCK_CARD_COLOR_IDS)[number];

/** Theme tokens / mixes so presets track light/dark. Custom hex is free-form. */
export const BLOCK_CARD_COLOR_CSS: Record<BlockCardColorId, string> = {
  sky: "var(--info)",
  teal: "var(--success)",
  amber: "var(--warning)",
  rose: "var(--accent-pink)",
  violet: "var(--lavender)",
  coral: "var(--peach)",
  crimson: "var(--error)",
  slate: "var(--text-secondary)",
  mint: "color-mix(in srgb, var(--success) 70%, var(--info))",
  ocean: "color-mix(in srgb, var(--info) 65%, var(--accent))",
  gold: "color-mix(in srgb, var(--warning) 70%, var(--peach))",
  ink: "var(--text-primary)",
  indigo: "color-mix(in srgb, var(--lavender) 65%, var(--info))",
  berry: "color-mix(in srgb, var(--accent-pink) 55%, var(--error))",
};

const COLOR_ID_SET = new Set<string>(BLOCK_CARD_COLOR_IDS);

export function isBlockCardColorId(value: unknown): value is BlockCardColorId {
  return typeof value === "string" && COLOR_ID_SET.has(value);
}

/** Native `<input type="color">` fallback when the card has no custom hex yet. */
export const BLOCK_CARD_CUSTOM_PICKER_FALLBACK = "#808080";

/** Normalize `#rgb` / `#rrggbb` to lowercase `#rrggbb`; reject others. */
export function normalizeBlockCardHex(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(v)) {
    const r = v[1];
    const g = v[2];
    const b = v[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return null;
}

export type BlockCardColorChoice =
  | { kind: "preset"; id: BlockCardColorId }
  | { kind: "hex"; value: string };

export type BlockCardColorMap = Partial<Record<string, BlockCardColorChoice>>;

export function parseBlockCardColorChoice(raw: unknown): BlockCardColorChoice | undefined {
  if (isBlockCardColorId(raw)) {
    return { kind: "preset", id: raw };
  }
  const bareHex = normalizeBlockCardHex(raw);
  if (bareHex) {
    return { kind: "hex", value: bareHex };
  }
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return undefined;
  }
  const rec = raw as Record<string, unknown>;
  if (rec.kind === "preset" && isBlockCardColorId(rec.id)) {
    return { kind: "preset", id: rec.id };
  }
  if (rec.kind === "hex") {
    const hex = normalizeBlockCardHex(rec.value);
    if (hex) return { kind: "hex", value: hex };
  }
  return undefined;
}

export function parseBlockCardColorMap(raw: unknown): BlockCardColorMap {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return {};
  const next: BlockCardColorMap = {};
  for (const [key, value] of Object.entries(raw)) {
    const cardKey = key.trim();
    if (!cardKey) continue;
    const choice = parseBlockCardColorChoice(value);
    if (!choice) continue;
    next[cardKey] = choice;
  }
  return next;
}

export function resolveBlockCardColor(
  map: BlockCardColorMap,
  cardKey: string,
): BlockCardColorChoice | undefined {
  return map[cardKey];
}

export function blockCardColorCss(choice: BlockCardColorChoice | undefined): string | undefined {
  if (!choice) return undefined;
  return choice.kind === "preset" ? BLOCK_CARD_COLOR_CSS[choice.id] : choice.value;
}

export function blockCardColorAttr(choice: BlockCardColorChoice | undefined): string | undefined {
  if (!choice) return undefined;
  return choice.kind === "preset" ? choice.id : choice.value;
}

export function isPresetBlockCardColor(
  choice: BlockCardColorChoice | undefined,
  id: BlockCardColorId,
): boolean {
  return choice?.kind === "preset" && choice.id === id;
}
