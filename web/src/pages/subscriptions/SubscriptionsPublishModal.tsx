import { useTranslation } from "react-i18next";
import { Button, MenuSelect, SettingsRow } from "../../components/ui";
import { ModalDialog } from "../../components/ModalDialog";
import type { Workset } from "../../api/worksets";
import type { CalendarSharePublishResult } from "../../domain/calendarShare/publishWorkset";
import { CalendarSharePublishForm } from "./CalendarSharePublishForm";
import type { MutableRefObject } from "react";

type Props = {
  worksets: Workset[];
  selectedId: string;
  onSelectedId: (id: string) => void;
  formBusy: boolean;
  formReady: boolean;
  canMutate: boolean;
  publishSubmitRef: MutableRefObject<(() => Promise<boolean>) | null>;
  onBusyChange: (busy: boolean) => void;
  onReadyChange: (ready: boolean) => void;
  onSaved: (result: CalendarSharePublishResult) => void;
  onClose: () => void;
  onConfirm: () => void;
};

/** Workset picker + publish form inside the 我的發佈 modal. */
export function SubscriptionsPublishModal({
  worksets,
  selectedId,
  onSelectedId,
  formBusy,
  formReady,
  canMutate,
  publishSubmitRef,
  onBusyChange,
  onReadyChange,
  onSaved,
  onClose,
  onConfirm,
}: Props) {
  const { t } = useTranslation("subscriptions");
  const selected = worksets.find((row) => row.id === selectedId) ?? null;
  return (
    <ModalDialog
      open
      size="form"
      title={t("published.formTitle")}
      testId="subscriptions-publish-modal"
      onClose={onClose}
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={formBusy}
            onClick={onClose}
            data-testid="subscriptions-publish-cancel"
          >
            {t("common:dialog.cancel")}
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            loading={formBusy}
            disabled={!selected || !formReady || formBusy || !canMutate}
            onClick={() => void onConfirm()}
            data-testid="subscriptions-publish-confirm"
          >
            {formBusy ? t("published.form.syncing") : t("published.form.confirm")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-lg">
        <SettingsRow label={t("published.worksetLabel")} htmlFor="subscriptions-published-workset">
          <MenuSelect
            id="subscriptions-published-workset"
            variant="field"
            menuPortal
            data-testid="subscriptions-published-workset"
            className="max-w-[280px]"
            value={selectedId}
            placeholder={t("published.worksetPlaceholder")}
            options={[
              { value: "", label: t("published.worksetPlaceholder") },
              ...worksets.map((row) => ({ value: row.id, label: row.name })),
            ]}
            onChange={onSelectedId}
            aria-label={t("published.worksetLabel")}
          />
        </SettingsRow>
        {selected ? (
          <CalendarSharePublishForm
            key={selected.id}
            worksetId={selected.id}
            worksetTitle={selected.name}
            worksetCover={selected.cover}
            worksetDescription={selected.description}
            isSystem={selected.isSystem}
            submitRef={publishSubmitRef}
            onBusyChange={onBusyChange}
            onReadyChange={onReadyChange}
            onSaved={onSaved}
          />
        ) : null}
      </div>
    </ModalDialog>
  );
}
