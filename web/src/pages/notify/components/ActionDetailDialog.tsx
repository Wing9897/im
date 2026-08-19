import { useTranslation } from "react-i18next";
import type { Action } from "../../../types";
import {
  ACTION_TYPE_LABELS,
  formatTriggerSummary,
} from "../../../domain/actions/actionLabels";
import { Button } from "../../../components/ui";
import {
  DetailPresentationShell,
  buildActionDetailFields,
  type DetailPresentation,
} from "../../../components/detail";
import {
  actionDetailCardClass,
  actionDetailCardValueClass,
  actionDetailConfigGridClass,
  actionDetailConfigLabelClass,
  actionDetailConfigRowClass,
  actionDetailConfigValueClass,
  actionDetailEnabledClass,
  actionDetailTypeBadgeClass,
  detailChromeBodyGapFieldClass,
  detailChromeCardTitleClass,
  detailChromeFooterClass,
  detailChromeHeaderClass,
  detailChromeMetaLineClass,
  detailChromeTitleClass,
  detailChromeTitleRowClass,
  detailDialogFlexColClass,
  detailDialogShellClass,
} from "../../../components/detail/classes";
import { formatOptionalOsDateTime, formatOsDateTime } from "../../../utils/time";

interface ActionDetailViewProps {
  action: Action;
  onClose: () => void;
  onEdit: () => void;
  presentation?: DetailPresentation;
}

export function ActionDetailView({
  action,
  onClose,
  onEdit,
  presentation = "modal",
}: ActionDetailViewProps) {
  const { t } = useTranslation("actions");
  const allFields = buildActionDetailFields(action);
  const configFields = allFields.filter((field) => field.standalone);

  const content = (
    <>
      <header className={detailChromeHeaderClass}>
        <div className={detailChromeTitleRowClass}>
          <h2 className={detailChromeTitleClass}>{action.name}</h2>
          <span className={actionDetailTypeBadgeClass}>
            {ACTION_TYPE_LABELS[action.actionType] ?? action.actionType}
          </span>
        </div>
        <div className={actionDetailEnabledClass}>
          {action.isEnabled ? t("card.enabled") : t("card.disabled")}
        </div>
      </header>

      <div className={detailChromeBodyGapFieldClass}>
        <div className={actionDetailCardClass}>
          <div className={detailChromeCardTitleClass}>{t("detail.triggerConditions")}</div>
          <div className={actionDetailCardValueClass}>
            {formatTriggerSummary(action, (key, options) =>
              key === "specificTask"
                ? t("card.specificTaskWithId", options)
                : t(`card.${key}`, options),
            )}
          </div>
        </div>

        {configFields.length > 0 ? (
          <div className={actionDetailCardClass}>
            <div className={detailChromeCardTitleClass}>{t("detail.configMasked")}</div>
            <div className={actionDetailConfigGridClass}>
              {configFields.map((field) => (
                <div key={field.label} className={actionDetailConfigRowClass}>
                  <span className={actionDetailConfigLabelClass}>{field.label}</span>
                  <span className={actionDetailConfigValueClass}>{field.value || "—"}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className={detailChromeMetaLineClass}>
          {t("detail.lastTriggeredPrefix")}
          {formatOptionalOsDateTime(action.lastTriggeredAt, undefined, t("card.never"))}
        </div>
        <div className={detailChromeMetaLineClass}>
          {t("detail.createdUpdated", {
            created: formatOsDateTime(action.createdAt),
            updated: formatOsDateTime(action.updatedAt),
          })}
        </div>
      </div>

      <footer className={detailChromeFooterClass}>
        <Button variant="secondary" onClick={onEdit}>
          {t("detail.edit")}
        </Button>
        <Button variant="secondary" onClick={onClose}>
          {t("detail.close")}
        </Button>
      </footer>
    </>
  );

  return (
    <DetailPresentationShell
      presentation={presentation}
      onClose={onClose}
      className={
        presentation === "inline" ? detailDialogFlexColClass : detailDialogShellClass
      }
      aria-label={t("detail.ariaLabel", { name: action.name })}
    >
      {content}
    </DetailPresentationShell>
  );
}

export function ActionDetailDialog(props: ActionDetailViewProps) {
  return <ActionDetailView {...props} presentation={props.presentation ?? "modal"} />;
}
