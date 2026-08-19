import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, TextField, captionClass } from "../../../../components/ui";
import {
  LEAD_OFFSET_MAX_MINUTES,
  LEAD_OFFSET_MIN_MINUTES,
  LEAD_OFFSET_OPTIONS,
  parseLeadOffsetMinutes,
  sanitizeLeadOffsets,
} from "../../../../domain/notify/scanner/settings";
import { NotifySection } from "./NotifySection";

const leadPillBase =
  "inline-flex cursor-pointer items-center rounded-md border text-body leading-snug transition-[border-color,background,color] duration-200 px-3 py-1.5";
const leadPillSelected =
  "border-accent bg-[color-mix(in_srgb,var(--accent)_12%,var(--surface-card))] font-medium text-text-primary shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_28%,transparent)]";
const leadPillIdle =
  "im-surface-inset border-surface-border text-text-secondary hover:border-[color-mix(in_srgb,var(--accent)_35%,var(--surface-border))] hover:text-text-primary";

function isPresetLeadOffset(offset: number): boolean {
  return (LEAD_OFFSET_OPTIONS as readonly number[]).includes(offset);
}

function LeadOffsetEditor({
  offsets,
  onChange,
}: {
  offsets: number[];
  onChange: (next: number[]) => void;
}) {
  const { t } = useTranslation("actions");
  const [draft, setDraft] = useState("");
  const [errorKey, setErrorKey] = useState<"invalid" | "duplicate" | null>(null);

  const addDraft = () => {
    const parsed = parseLeadOffsetMinutes(draft);
    if (parsed == null) {
      setErrorKey("invalid");
      return;
    }
    if (offsets.includes(parsed)) {
      setErrorKey("duplicate");
      return;
    }
    onChange(sanitizeLeadOffsets([...offsets, parsed]));
    setDraft("");
    setErrorKey(null);
  };

  const togglePreset = (offset: number) => {
    setErrorKey(null);
    const next = offsets.includes(offset)
      ? offsets.filter((item) => item !== offset)
      : [...offsets, offset];
    onChange(sanitizeLeadOffsets(next));
  };

  const customOffsets = offsets.filter((offset) => !isPresetLeadOffset(offset));

  return (
    <div className="flex min-w-0 flex-col gap-md" data-testid="voice-lead-offsets">
      <div
        className="flex flex-wrap items-center gap-sm"
        data-testid="voice-lead-row"
      >
        <label className="flex w-fit items-center gap-sm text-caption text-text-secondary">
          <span className="shrink-0">{t("voice.leadMinutesLabel")}</span>
          <TextField
            className="w-[9.5rem]"
            type="number"
            inputMode="numeric"
            min={LEAD_OFFSET_MIN_MINUTES}
            max={LEAD_OFFSET_MAX_MINUTES}
            step={1}
            value={draft}
            placeholder={String(LEAD_OFFSET_OPTIONS[0])}
            aria-label={t("voice.leadMinutesInputAria")}
            data-testid="voice-lead-minutes-input"
            onChange={(event) => {
              setDraft(event.target.value);
              setErrorKey(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addDraft();
              }
            }}
          />
        </label>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          data-testid="voice-lead-add"
          aria-label={t("voice.leadAddAria")}
          onClick={addDraft}
        >
          {t("voice.leadAdd")}
        </Button>
        <span className={`shrink-0 ${captionClass}`}>{t("voice.leadPresets")}</span>
        {LEAD_OFFSET_OPTIONS.map((offset) => {
          const label = t(`voice.lead.${offset}`);
          const selected = offsets.includes(offset);
          return (
            <button
              key={offset}
              type="button"
              className={[leadPillBase, selected ? leadPillSelected : leadPillIdle].join(" ")}
              data-testid={`voice-lead-preset-${offset}`}
              aria-pressed={selected}
              aria-label={t("voice.leadPresetAria", { label })}
              onClick={() => togglePreset(offset)}
            >
              {label}
            </button>
          );
        })}
        {customOffsets.map((offset) => {
          const label = t("voice.leadMinutesChip", { minutes: offset });
          return (
            <button
              key={offset}
              type="button"
              className={[leadPillBase, leadPillSelected, "w-fit"].join(" ")}
              data-testid={`voice-lead-chip-${offset}`}
              aria-label={t("voice.leadRemoveAria", { label })}
              onClick={() => onChange(sanitizeLeadOffsets(offsets.filter((item) => item !== offset)))}
            >
              {label}
            </button>
          );
        })}
      </div>
      {errorKey === "invalid" ? (
        <p className={`m-0 ${captionClass}`} data-testid="voice-lead-error">
          {t("voice.leadInvalid", { max: LEAD_OFFSET_MAX_MINUTES })}
        </p>
      ) : null}
      {errorKey === "duplicate" ? (
        <p className={`m-0 ${captionClass}`} data-testid="voice-lead-error">
          {t("voice.leadDuplicate")}
        </p>
      ) : null}
    </div>
  );
}

export function LeadOffsetSection({
  offsets,
  onChange,
}: {
  offsets: number[];
  onChange: (next: number[]) => void;
}) {
  const { t } = useTranslation("actions");
  return (
    <NotifySection title={t("voice.sectionLead")} caption={t("voice.leadCaption")}>
      <LeadOffsetEditor offsets={offsets} onChange={onChange} />
    </NotifySection>
  );
}
