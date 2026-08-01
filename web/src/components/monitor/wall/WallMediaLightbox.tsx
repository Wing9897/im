import { X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { OverlayPortal } from "../../../components/common/OverlayPortal";
import { useFocusTrap } from "../../../hooks/useFocusTrap";
import {
  wallLightboxCaptionClass,
  wallLightboxCloseClass,
  wallLightboxImageClass,
  wallLightboxPanelClass,
  wallLightboxTitleClass,
} from "./wallCardClasses";

interface WallMediaLightboxProps {
  open: boolean;
  imageUrl: string;
  title?: string;
  caption?: string;
  onClose: () => void;
}

/** Full-screen preview for wall carousel media. */
export function WallMediaLightbox({
  open,
  imageUrl,
  title,
  caption,
  onClose,
}: WallMediaLightboxProps) {
  const { t } = useTranslation("monitor");
  const focusTrapRef = useFocusTrap({ active: open, onEscape: onClose });

  if (!open) return null;

  return (
    <OverlayPortal
      className="z-[3000] items-center pt-lg"
      onOverlayClick={onClose}
      lockBodyScroll
      role="dialog"
      aria-modal="true"
      aria-label={
        title
          ? t("wallCard.lightboxAriaTitled", { title })
          : t("wallCard.lightboxAria")
      }
    >
      <div
        ref={focusTrapRef}
        className={wallLightboxPanelClass}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className={wallLightboxCloseClass}
          aria-label={t("wallCard.closePreview")}
          onClick={onClose}
        >
          <X size={20} aria-hidden="true" />
        </button>
        {title ? <p className={wallLightboxTitleClass}>{title}</p> : null}
        <img
          src={imageUrl}
          alt={caption || title || t("wallCard.mediaAlt")}
          className={wallLightboxImageClass}
        />
        {caption ? <p className={wallLightboxCaptionClass}>{caption}</p> : null}
      </div>
    </OverlayPortal>
  );
}
