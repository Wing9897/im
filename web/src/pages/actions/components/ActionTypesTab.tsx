import { useState } from "react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "../../../components/common/EmptyState";
import { EmptyStateGlyph } from "../../../components/common/EmptyStateGlyph";
import { BellRing } from "lucide-react";
import { RefreshIndicator } from "../../../components/common/RefreshIndicator";
import { SkeletonScreen } from "../../../components/common/SkeletonScreen";
import { DeleteConfirmDialog } from "../../../components/dialogs/DeleteConfirmDialog";
import { Button, PanelSection, StatCard } from "../../../components/ui";
import { useErrorToast } from "../../../hooks/useErrorToast";
import { MasterDetailSplit, useDetailSelection } from "../../../components/detail";
import { useListKeyboardNavigation } from "../../../hooks/useListKeyboardNavigation";
import { useDetailPresentation } from "../../../hooks/useDetailPresentation";
import type { Action } from "../../../types";
import { ActionCard } from "./ActionCard";
import { ActionDetailView } from "./ActionDetailDialog";
import { ActionFormDialog } from "../form/ActionFormDialog";
import { useActionsPage } from "../hooks/useActionsPage";

/**
 * Outbound notification rules (Telegram / Discord / HTTP / MQTT).
 * Mounted as the default tab under `/actions`.
 */
export function ActionTypesTab() {
  const { t } = useTranslation("actions");
  const {
    actions,
    tasks,
    initialLoading,
    isRefreshing,
    error,
    formOpen,
    editTarget,
    deleteTarget,
    deleting,
    handleToggle,
    handleEdit,
    handleCreate,
    handleFormClose,
    handleFormSaved,
    handleDeleteClick,
    handleDeleteConfirm,
    handleDeleteCancel,
    handleTest,
  } = useActionsPage();

  useErrorToast(error);
  const { selected: detailAction, select: selectAction, clear: clearAction } =
    useDetailSelection<Action>();
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const presentation = useDetailPresentation();

  useListKeyboardNavigation({
    items: actions,
    selectedId: focusedId ?? detailAction?.id ?? null,
    getItemId: (action) => action.id,
    onSelect: (action) => setFocusedId(action.id),
    onActivate: selectAction,
    onEscape: clearAction,
    enabled: !initialLoading && actions.length > 0,
  });

  const enabledCount = actions.filter((a) => a.isEnabled).length;
  const showCountBadge = !initialLoading || actions.length > 0;

  return (
    <>
      {!initialLoading && actions.length > 0 ? (
        <div className="mb-md grid grid-cols-2 gap-sm sm:max-w-xs">
          <StatCard label={t("types.statTotal")} value={actions.length} />
          <StatCard
            label={t("types.statEnabled")}
            value={<span className="text-success">{enabledCount}</span>}
          />
        </div>
      ) : null}

      <MasterDetailSplit
        split={presentation === "inline" && detailAction != null}
        list={
          <PanelSection
            title={t("types.rulesTitle")}
            itemCount={actions.length}
            showCount={showCountBadge}
            headerActions={
              <>
                {isRefreshing ? (
                  <RefreshIndicator label={t("types.refreshing")} />
                ) : null}
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleCreate}
                  aria-label={t("types.add")}
                >
                  {t("types.add")}
                </Button>
              </>
            }
          >
            {initialLoading ? <SkeletonScreen variant="list-rows" /> : null}

            {!initialLoading && actions.length === 0 && !error ? (
              <EmptyState
                illustration={<EmptyStateGlyph icon={BellRing} />}
                title={t("types.emptyTitle")}
                description={t("types.emptyDescription")}
                hint={t("types.emptyHint")}
                actions={
                  <Button
                    variant="primary"
                    onClick={handleCreate}
                    aria-label={t("types.add")}
                  >
                    {t("types.add")}
                  </Button>
                }
              />
            ) : null}

            {!initialLoading && actions.length > 0 ? (
              <div className="flex flex-col gap-md">
                {actions.map((action) => (
                  <ActionCard
                    key={action.id}
                    action={action}
                    isSelected={
                      focusedId === action.id || detailAction?.id === action.id
                    }
                    onToggle={(id, val) => void handleToggle(id, val).catch(() => {})}
                    onEdit={handleEdit}
                    onDelete={handleDeleteClick}
                    onTest={(a) => void handleTest(a).catch(() => {})}
                    onSelect={() => {
                      setFocusedId(action.id);
                      selectAction(action);
                    }}
                  />
                ))}
              </div>
            ) : null}
          </PanelSection>
        }
        detail={
          presentation === "inline" && detailAction ? (
            <ActionDetailView
              action={detailAction}
              onClose={clearAction}
              onEdit={() => {
                const target = detailAction;
                clearAction();
                handleEdit(target);
              }}
              presentation="inline"
            />
          ) : null
        }
      />

      <ActionFormDialog
        open={formOpen}
        editAction={editTarget}
        tasks={tasks}
        onClose={handleFormClose}
        onSaved={handleFormSaved}
      />

      <DeleteConfirmDialog
        open={!!deleteTarget}
        targetName={deleteTarget?.name ?? ""}
        deleting={deleting}
        title={t("types.deleteTitle")}
        entityLabel={t("types.deleteEntity")}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />

      {presentation === "drawer" && detailAction ? (
        <ActionDetailView
          action={detailAction}
          onClose={clearAction}
          onEdit={() => {
            const target = detailAction;
            clearAction();
            handleEdit(target);
          }}
          presentation="drawer"
        />
      ) : null}
    </>
  );
}
