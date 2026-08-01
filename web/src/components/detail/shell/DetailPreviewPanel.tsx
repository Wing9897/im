import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  detailDialogCloseClass,
  detailPreviewBodyClass,
  detailPreviewInlineShellClass,
} from "../classes";

interface DetailPreviewPanelProps {
  children: ReactNode;
  onClose: () => void;
  "aria-label": string;
}

/** Inline right-hand preview column (Codex-style, no overlay). */
export function DetailPreviewPanel({
  children,
  onClose,
  "aria-label": ariaLabel,
}: DetailPreviewPanelProps) {
  const { t } = useTranslation("common");
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        event.key !== "Escape" ||
        (target instanceof HTMLElement &&
          (target.isContentEditable ||
            target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.tagName === "SELECT"))
      ) {
        return;
      }
      event.preventDefault();
      onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className={detailPreviewInlineShellClass} role="complementary" aria-label={ariaLabel}>
      <button
        type="button"
        className={detailDialogCloseClass}
        aria-label={t("dialog.closePreview")}
        onClick={onClose}
      >
        <X size={18} strokeWidth={2} aria-hidden="true" />
      </button>
      <div className={detailPreviewBodyClass}>{children}</div>
    </div>
  );
}
