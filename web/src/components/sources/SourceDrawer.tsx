import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { dialogShellClass } from "../dialogs/dialogShellClasses";
import { ModalDialog } from "../ModalDialog";
import { Button } from "../ui";

interface SourceDrawerProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

/** Create-source dialog. The page form is passed in so this file stays out of `pages/`. */
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
