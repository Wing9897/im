import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { AddSourceDialog } from "../../components/dialogs/AddSourceDialog";
import { useErrorToast } from "../../hooks/useErrorToast";
import { SourceBoardShell } from "./SourceBoardShell";
import { SourceFormPanel } from "./SourceFormPanel";
import { SourceListSection } from "./SourceListSection";

interface SourceTabEmptyState {
  title: string;
  description: string;
  hint?: string;
}

interface SourceTabLayoutProps {
  error: string | null;
  retrying?: boolean;
  onRetry: () => void;
  formTitle: string;
  formDescription?: string;
  addForm: ReactNode;
  listTitle: string;
  itemCount: number;
  initialLoading: boolean;
  isRefreshing?: boolean;
  emptyState: SourceTabEmptyState;
  children: ReactNode;
  removeOpen: boolean;
  removeTitle: string;
  removing: boolean;
  removeMessage: string | null;
  onRemoveConfirm: () => void;
  onRemoveCancel: () => void;
  listContent?: ReactNode;
  /** Extra controls in the list header (e.g. HTTP mode toggle). */
  listHeaderActions?: ReactNode;
}


const removeMessageClass =
  "mb-md overflow-hidden text-ellipsis whitespace-nowrap text-body text-text-secondary";

export function SourceTabLayout({
  error,
  formTitle,
  formDescription,
  addForm,
  listTitle,
  itemCount,
  initialLoading,
  isRefreshing = false,
  emptyState,
  children,
  removeOpen,
  removeTitle,
  removing,
  removeMessage,
  onRemoveConfirm,
  onRemoveCancel,
  listContent,
  listHeaderActions,
}: SourceTabLayoutProps) {
  const { t } = useTranslation("sources");
  useErrorToast(error);

  return (
    <>
      <SourceBoardShell
        form={
          <SourceFormPanel
            title={formTitle}
            description={formDescription}
            itemCount={itemCount}
          >
            {addForm}
          </SourceFormPanel>
        }
        list={
          listContent ?? (
            <SourceListSection
              title={listTitle}
              itemCount={itemCount}
              initialLoading={initialLoading}
              isRefreshing={isRefreshing}
              refreshingLabel={t("layout.refreshing")}
              emptyState={emptyState}
              headerActions={listHeaderActions}
            >
              {children}
            </SourceListSection>
          )
        }
      />

      <AddSourceDialog
        open={removeOpen}
        title={removeTitle}
        onSubmit={onRemoveConfirm}
        onCancel={onRemoveCancel}
        submitLabel={t("layout.removeConfirm")}
        submittingLabel={t("layout.removing")}
        submitting={removing}
        danger
      >
        <p className={removeMessageClass} title={removeMessage ?? undefined}>
          {removeMessage}
        </p>
      </AddSourceDialog>
    </>
  );
}
