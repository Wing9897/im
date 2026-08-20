import type { MouseEvent } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "../../../components/ui";

interface IntelligenceNotIntelButtonProps {
  disabled?: boolean;
  onClick: () => void;
}

export function IntelligenceNotIntelButton({
  disabled,
  onClick,
}: IntelligenceNotIntelButtonProps) {
  const { t } = useTranslation("intelligence");

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    event.preventDefault();
    onClick();
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={disabled}
      onClick={handleClick}
      data-testid="intel-not-intel"
    >
      {t("card.notIntel")}
    </Button>
  );
}
