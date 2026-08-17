import { formatMessage } from "../../../i18n/formatMessage";
import i18n from "../../../i18n";
import { MSG_SPEAK_WITHOUT_TASK } from "../../../i18n/messageKeys";
import type { LeadOffsetMinutes } from "./settings";
import type { TimedKeyEventKind } from "./scannerTypes";

/** Phrase fragment for speak text / tests (follows UI locale). */
export function formatLeadSpeakPhrase(leadOffsetMinutes: number): string {
  switch (leadOffsetMinutes) {
    case 15:
      return String(i18n.t("messages.speakLead15"));
    case 60:
      return String(i18n.t("messages.speakLead60"));
    case 240:
      return String(i18n.t("messages.speakLead240"));
    case 1440:
      return String(i18n.t("messages.speakLead1440"));
    default:
      return String(i18n.t("messages.speakLeadMinutes", { minutes: leadOffsetMinutes }));
  }
}

function speakKindLabel(kind: TimedKeyEventKind | undefined): string {
  switch (kind) {
    case "recurring":
      return String(i18n.t("messages.speakKindRecurring"));
    case "user":
      return String(i18n.t("messages.speakKindUser"));
    default:
      return String(i18n.t("messages.speakKindEvent"));
  }
}

/**
 * Spoken reminder line — event title + lead phrase only (no workset / task / kind).
 * `taskName` is unused; kept so call sites stay stable.
 */
export function buildSpeakText(
  taskName: string,
  title: string,
  leadOffsetMinutes: number,
  kind: TimedKeyEventKind = "event",
): string {
  void taskName;
  const eventTitle = title.trim() || speakKindLabel(kind);
  const lead = formatLeadSpeakPhrase(leadOffsetMinutes);
  return formatMessage(MSG_SPEAK_WITHOUT_TASK, { eventTitle, lead });
}

/** Sample line for the panel「試播」button. */
export function buildPreviewSpeakText(
  _leadOffsetMinutes: LeadOffsetMinutes = 60,
): string {
  void _leadOffsetMinutes;
  return String(i18n.t("messages.speakPreview"));
}
