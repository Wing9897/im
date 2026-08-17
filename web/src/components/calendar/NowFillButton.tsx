import { useTranslation } from "react-i18next";

import { Button } from "../ui";

/** Fills adjacent date/time inputs with the local clock (or today when all-day). */
export function NowFillButton({
  onClick,
  disabled = false,
  testId = "datetime-now",
}: {
  onClick: () => void;
  disabled?: boolean;
  testId?: string;
}) {
  const { t } = useTranslation("common");
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      className="shrink-0"
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      aria-label={t("ui.nowAria")}
    >
      {t("ui.now")}
    </Button>
  );
}
