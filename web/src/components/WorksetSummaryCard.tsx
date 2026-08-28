/**
 * Compact ownership workset card for the dashboard「工作集」grouping view.
 * Magazine layout: cover strip + title / description / counts (no emoji avatar).
 */

import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTaskCatalog } from "../context/TaskCatalogContext";
import { normalizeWorksetDescription } from "../domain/worksets/worksetFields";
import { normalizeWorksetCover } from "../domain/worksets/worksetCover";
import { WorksetCoverField } from "./WorksetCoverField";
import { WorksetPermissionToggles } from "./WorksetPermissionToggles";
import { AccentBarCard, Badge, TextField, cardTitleHeaderClass, cardTitleLeadClass } from "./ui";
import { cardBodyClass, cardTitleClass } from "./ui/pageTypography";

export interface WorksetSummaryCardProps {
  id: string;
  title: string;
  isSystem: boolean;
  taskCount: number;
  /** Active trackable items in this workset (optional count badge). */
  itemCount?: number;
  onOpen?: () => void;
  onRename?: (nextName: string) => void | Promise<void>;
  onDelete?: () => void;
}

const actionIconBtnClass =
  "im-icon-btn shrink-0 !h-7 !w-7 !rounded-md text-text-secondary transition-colors";

function stopCardActivation(event: { stopPropagation: () => void }) {
  event.stopPropagation();
}

/** First-class workset entity card (system「一般」or user-created). */
export function WorksetSummaryCard({
  id,
  title,
  isSystem,
  taskCount,
  itemCount,
  onOpen,
  onRename,
  onDelete,
}: WorksetSummaryCardProps) {
  const { t } = useTranslation(["common", "workset", "account"]);
  const { worksets } = useTaskCatalog();
  const ws = worksets.find((row) => row.id === id);
  const cover = normalizeWorksetCover(ws?.cover);
  const customDescription = normalizeWorksetDescription(ws?.description);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const [saving, setSaving] = useState(false);
  const skipCommitRef = useRef(false);
  const editingRef = useRef(false);

  useEffect(() => {
    if (!editing) setDraft(title);
  }, [title, editing]);

  useEffect(() => {
    if (!editing) return;
    const input = document.querySelector(`[data-testid="workset-card-rename-input-${id}"]`);
    if (input instanceof HTMLInputElement) {
      input.focus();
      input.select();
    }
  }, [editing, id]);

  const startRename = (event: MouseEvent) => {
    event.stopPropagation();
    skipCommitRef.current = false;
    editingRef.current = true;
    setDraft(title);
    setEditing(true);
  };

  const leaveEdit = () => {
    editingRef.current = false;
    setSaving(false);
    setEditing(false);
    setDraft(title);
  };

  const commitRename = async (raw?: string) => {
    if (!editingRef.current) return;
    if (skipCommitRef.current) {
      skipCommitRef.current = false;
      leaveEdit();
      return;
    }
    const cleaned = (raw ?? draft).trim();
    if (!cleaned || cleaned === title || !onRename) {
      leaveEdit();
      return;
    }
    editingRef.current = false;
    setSaving(true);
    try {
      await onRename(cleaned);
      setEditing(false);
    } catch {
      editingRef.current = true;
    } finally {
      setSaving(false);
    }
  };

  const cancelRename = () => {
    skipCommitRef.current = true;
    leaveEdit();
  };

  const onRenameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    event.stopPropagation();
    if (event.key === "Enter") {
      event.preventDefault();
      void commitRename(event.currentTarget.value);
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancelRename();
    }
  };

  const interactive = Boolean(onOpen) && !editing;

  return (
    <AccentBarCard
      accentClass={isSystem ? "bg-info" : "bg-accent"}
      enter="rise"
      interactive={interactive}
      data-testid={`workset-card-${id}`}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? onOpen : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpen?.();
              }
            }
          : undefined
      }
      aria-label={t("workset:openDetailAria", { name: title })}
    >
      <div className="flex flex-col gap-md">
        <WorksetCoverField worksetId={id} cover={cover} name={title} />
        <div className="flex min-w-0 flex-col gap-sm">
          <div className={cardTitleHeaderClass}>
            <span className={cardTitleLeadClass}>
              {editing ? (
                <TextField
                  value={draft}
                  disabled={saving}
                  autoFocus
                  onChange={(event) => setDraft(event.target.value)}
                  onBlur={(event) => {
                    void commitRename(event.currentTarget.value);
                  }}
                  onClick={stopCardActivation}
                  onKeyDown={onRenameKeyDown}
                  onPointerDown={stopCardActivation}
                  aria-label={t("workset:nameAria")}
                  className="min-w-0 flex-1 !h-7 !min-h-7 !text-caption"
                  data-testid={`workset-card-rename-input-${id}`}
                />
              ) : (
                <span className={`min-w-0 truncate ${cardTitleClass}`} title={title}>
                  {title}
                </span>
              )}
              {!isSystem && onRename ? (
                <button
                  type="button"
                  className={actionIconBtnClass}
                  aria-label={t("workset:renameAria", { name: title })}
                  title={t("workset:rename")}
                  data-testid={`workset-card-rename-${id}`}
                  onMouseDown={(event) => {
                    event.stopPropagation();
                    if (editing) {
                      event.preventDefault();
                      const input = document.querySelector(
                        `[data-testid="workset-card-rename-input-${id}"]`,
                      );
                      const raw = input instanceof HTMLInputElement ? input.value : draft;
                      void commitRename(raw);
                    }
                  }}
                  onClick={(event) => {
                    if (editing) return;
                    startRename(event);
                  }}
                  onKeyDown={stopCardActivation}
                  onPointerDown={stopCardActivation}
                >
                  <Pencil size={14} strokeWidth={2} aria-hidden="true" />
                </button>
              ) : null}
              {!isSystem && onDelete ? (
                <button
                  type="button"
                  className={actionIconBtnClass}
                  aria-label={t("workset:deleteAria", { name: title })}
                  title={t("workset:delete")}
                  data-testid={`workset-card-delete-${id}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete();
                  }}
                  onKeyDown={stopCardActivation}
                  onPointerDown={stopCardActivation}
                >
                  <Trash2 size={14} strokeWidth={2} aria-hidden="true" />
                </button>
              ) : null}
            </span>
            {isSystem ? (
              <Badge tone="info">{t("workset:systemBadge")}</Badge>
            ) : (
              <Badge tone="neutral">{t("workset:label")}</Badge>
            )}
          </div>
          {customDescription ? (
            <p className={`m-0 line-clamp-2 ${cardBodyClass}`} title={customDescription}>
              {customDescription}
            </p>
          ) : null}
          {isSystem ? (
            <p className={cardBodyClass}>{t("workset:systemDescription")}</p>
          ) : null}
          <p className={`${cardBodyClass} ${isSystem ? "opacity-90" : ""}`}>
            {t("workset:assetSummary", {
              tasks: taskCount,
              items: itemCount ?? 0,
            })}
          </p>
          <div className="mt-auto pt-xs">
            <WorksetPermissionToggles worksetId={id} worksetName={title} />
          </div>
        </div>
      </div>
    </AccentBarCard>
  );
}
