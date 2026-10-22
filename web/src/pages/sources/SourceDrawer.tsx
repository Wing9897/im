import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { dialogShellClass } from "../../components/dialogs/dialogShellClasses";
import { ModalDialog } from "../../components/ModalDialog";
import { Button } from "../../components/ui";

interface SourceDrawerProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

/** Create-source dialog. The page form is passed in as children. */
export function SourceDrawer({ open, onClose, children }: SourceDrawerProps) {
  const { t } = useTranslation(["sources", "common"]);

  return (
    <ModalDialog
      open={open}
      title={t("drawer.title")}
      closeAriaLabel={t("drawer.closeAria")}
      onClose={onClose}
      testId="source-drawer"
      size="form"
      shellClassName={`box-border w-[min(94vw,880px)] max-w-[min(94vw,880px)] max-h-[min(88vh,800px)] ${dialogShellClass} flex flex-col`}
      footer={
        <Button type="button" variant="secondary" onClick={onClose}>
          {t("common:dialog.cancel")}
        </Button>
      }
    >
      {children}
    </ModalDialog>
  );
}
