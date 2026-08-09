import { useTranslation } from "react-i18next";
import type { AppLogEntry } from "../../../context/appRuntimeShared";
import { formatOsDateTime } from "../../../utils/time";
import { levelTone } from "../../../utils/logLevelTone";
import { SelectableSurface } from "../../../components/detail";
import { Badge, ListRowMain, ListRowMeta, ListRowTime } from "../../../components/ui";
import { resolveLogDisplayMessage } from "../../../domain/logs/resolveLogDisplayMessage";

export function LogCard({
  entry,
  onSelect,
  isSelected = false,
}: {
  entry: AppLogEntry;
  onSelect: () => void;
  isSelected?: boolean;
}) {
  const { t } = useTranslation("logs");
  const displayMessage = resolveLogDisplayMessage(entry);
  return (
    <SelectableSurface
      variant="row"
      tag="article"
      onSelect={onSelect}
      isSelected={isSelected}
      selectAriaLabel={t("card.detailAria", { message: displayMessage })}
    >
      <ListRowTime>{formatOsDateTime(entry.time)}</ListRowTime>
      <Badge tone={levelTone(entry.level)}>{entry.level.toUpperCase()}</Badge>
      <ListRowMeta>
        {t(`category.${entry.category}`, { defaultValue: entry.category })}
      </ListRowMeta>
      <ListRowMain>{displayMessage}</ListRowMain>
    </SelectableSurface>
  );
}
