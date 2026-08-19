import { useTranslation } from "react-i18next";
import { Button, MenuSelect } from "../../../../components/ui";
import {
  PREAMBLE_CHIME_IDS,
  type PreambleChimeId,
} from "../../../../domain/notify/scanner/preambleChime";
import { NotifySection } from "./NotifySection";

export function PreambleSection({
  preambleChimeId,
  previewing,
  onChange,
  onPreview,
}: {
  preambleChimeId: PreambleChimeId;
  previewing: boolean;
  onChange: (next: PreambleChimeId) => void;
  onPreview: () => void;
}) {
  const { t } = useTranslation("actions");
  return (
    <NotifySection title={t("voice.sectionPreamble")} caption={t("voice.preambleCaption")}>
      <div className="flex min-w-0 flex-wrap items-center gap-sm" data-testid="voice-preamble">
        <MenuSelect
          variant="field"
          menuPortal
          aria-label={t("voice.preambleAria")}
          className="min-w-0 max-w-[20rem] flex-1"
          value={preambleChimeId}
          options={PREAMBLE_CHIME_IDS.map((id) => ({
            value: id,
            label: t(`voice.chime.${id}`),
          }))}
          onChange={(next) => onChange(next as PreambleChimeId)}
        />
        <Button
          type="button"
          variant="secondary"
          size="md"
          className="shrink-0"
          data-testid="voice-preamble-preview"
          onClick={onPreview}
          disabled={previewing}
          aria-label={t("voice.previewAria")}
        >
          {previewing ? t("voice.previewing") : t("voice.preview")}
        </Button>
      </div>
    </NotifySection>
  );
}
