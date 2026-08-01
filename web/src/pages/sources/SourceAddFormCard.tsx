import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AlertBanner, Button } from "../../components/ui";
import { SourceScrollBody } from "./SourceScrollBody";

interface SourceAddFormCardProps {
  children: ReactNode;
  formError?: string | null;
  submitLabel: string;
  submittingLabel?: string;
  submitting?: boolean;
  submitDisabled?: boolean;
  onSubmit: () => void;
}

/**
 * Shared add-source form body used inside SourceFormPanel.
 * Scrollable fields/error + pinned submit footer (ModalDialog pattern).
 */
export function SourceAddFormCard({
  children,
  formError,
  submitLabel,
  submittingLabel,
  submitting = false,
  submitDisabled = false,
  onSubmit,
}: SourceAddFormCardProps) {
  const { t } = useTranslation("sources");
  const disabled = submitting || submitDisabled;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SourceScrollBody>
        {children}

        {formError ? (
          <AlertBanner
            variant="error"
            role="alert"
            className="mt-md max-h-28 overflow-y-auto break-words font-normal leading-snug"
          >
            {formError}
          </AlertBanner>
        ) : null}
      </SourceScrollBody>

      <div className="sources-add-form-footer mt-md flex shrink-0 justify-end pt-md">
        <Button
          variant="primary"
          disabled={disabled}
          onClick={() => void Promise.resolve(onSubmit()).catch(() => {})}
        >
          {submitting ? (submittingLabel ?? t("shared.processing")) : submitLabel}
        </Button>
      </div>
    </div>
  );
}
