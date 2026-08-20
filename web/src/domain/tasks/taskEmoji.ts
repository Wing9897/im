/**
 * Task / intel-event card glyphs live on entity ``emoji``.
 * Empty / missing → default product task logo (not the AI head).
 */

export function lookupTaskEmoji(emoji: string | null | undefined): string {
  return typeof emoji === "string" ? emoji.trim() : "";
}

export type TaskEmojiEventRef = {
  emoji?: string | null;
};

export function lookupTaskEmojiForEvent(event: TaskEmojiEventRef): string {
  return lookupTaskEmoji(event.emoji);
}
