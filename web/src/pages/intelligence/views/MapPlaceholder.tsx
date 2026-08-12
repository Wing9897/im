import { useTranslation } from "react-i18next";

/** Fallback placeholder matching MapView dimensions while lazy-loading */
export function MapPlaceholder() {
  const { t } = useTranslation("intelligence");
  return (
    <div className="im-surface-panel relative flex flex-1 flex-col items-center justify-center rounded-md border border-surface-border">
      <span className="text-body text-text-muted">{t("map.loading")}</span>
    </div>
  );
}
