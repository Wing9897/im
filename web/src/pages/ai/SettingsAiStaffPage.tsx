import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { Pencil, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AiStaffAvatar } from "../../components/aiStaff/AiStaffAvatar";
import { AssistantHistorySettingsDialog } from "../../components/aiStaff/AssistantHistorySettingsDialog";
import { Badge, Button, SurfaceCard, TextField } from "../../components/ui";
import {
  cardBodyClass,
  cardMetaClass,
  cardTitleClass,
  captionClass,
  formHelpClass,
} from "../../components/ui/pageTypography";
import { AI_STAFF_ROSTER } from "../../domain/aiStaff/aiStaff";
import {
  compressAvatarToDataUrl,
  resolveAssistantDisplayName,
  useAssistantIdentity,
} from "../../domain/aiStaff/assistantIdentity";
import type { SystemSettingsSnapshot } from "../../types";
import { SettingsContentCard } from "../../components/settings/SettingsFormLayout";
import {
  FRONTLINE_LINKS,
  LiaisonIntroCard,
  RosterStaffCard,
} from "./AiStaffIntroCards";
import { useSettingsPageState } from "../settings/SettingsShared";

const titleIconBtnClass =
  "im-icon-btn !h-7 !w-7 !rounded-md text-text-secondary transition-colors";

function AssistantStaffCard() {
  const { t } = useTranslation(["settings", "common"]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const skipRenameCommitRef = useRef(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const { identity, setDisplayName, setAvatarDataUrl, resetAvatar } = useAssistantIdentity();
  const { settings, saving, handleSave } = useSettingsPageState();
  const fallbackName = t("common:aiStaff.assistant");
  const displayName = resolveAssistantDisplayName(identity, fallbackName);
  const link = FRONTLINE_LINKS.assistant!;

  useEffect(() => {
    if (!renaming) return;
    const input = document.querySelector('[data-testid="assistant-display-name"]');
    if (input instanceof HTMLInputElement) {
      input.focus();
      input.select();
    }
  }, [renaming]);

  const startRename = () => {
    skipRenameCommitRef.current = false;
    setDraftName(identity.displayName);
    setRenaming(true);
  };

  const commitRename = () => {
    if (skipRenameCommitRef.current) {
      skipRenameCommitRef.current = false;
      setRenaming(false);
      return;
    }
    setDisplayName(draftName.trim());
    setRenaming(false);
  };

  const cancelRename = () => {
    skipRenameCommitRef.current = true;
    setDraftName(identity.displayName);
    setRenaming(false);
  };

  const onRenameKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitRename();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelRename();
    }
  };

  const onPickAvatar = () => {
    fileInputRef.current?.click();
  };

  const onAvatarFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setAvatarError(null);
    try {
      const dataUrl = await compressAvatarToDataUrl(file);
      setAvatarDataUrl(dataUrl);
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      setAvatarError(
        code === "too_large" ? t("staff.avatarTooLarge") : t("staff.avatarReadFailed"),
      );
    }
  };

  const onSaveHistory = async (patch: Partial<SystemSettingsSnapshot>) => {
    await handleSave({ patch });
    setHistoryDialogOpen(false);
  };

  return (
    <SurfaceCard
      material="panel"
      density="compact"
      className="flex flex-col gap-sm"
      data-testid="ai-staff-card-assistant"
    >
      <div className="flex items-start gap-sm">
        <div className="flex shrink-0 flex-col items-center gap-xs">
          <button
            type="button"
            className={[
              "group relative block overflow-hidden rounded-full border-0 bg-transparent p-0",
              "appearance-none shadow-none outline-none",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
            ].join(" ")}
            onClick={onPickAvatar}
            aria-label={t("staff.uploadAvatarAria")}
            title={t("staff.uploadAvatar")}
            data-testid="assistant-avatar-upload"
          >
            <AiStaffAvatar
              staffId="assistant"
              size="md"
              label={displayName}
              src={identity.avatarDataUrl}
            />
            <span
              className={[
                "pointer-events-none absolute inset-0 flex items-center justify-center rounded-full",
                "bg-[color-mix(in_srgb,var(--text-primary)_45%,transparent)] px-1 text-center text-[10px] font-medium leading-tight text-white",
                "opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100",
              ].join(" ")}
              aria-hidden
            >
              {t("staff.uploadAvatar")}
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            data-testid="assistant-avatar-file"
            onChange={(e) => {
              void onAvatarFile(e);
            }}
          />
          {identity.avatarDataUrl ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetAvatar}
              aria-label={t("staff.resetAvatarAria")}
              data-testid="assistant-avatar-reset"
            >
              {t("staff.resetAvatar")}
            </Button>
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-xs">
            {renaming ? (
              <TextField
                id="assistant-display-name"
                data-testid="assistant-display-name"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onBlur={commitRename}
                onKeyDown={onRenameKeyDown}
                placeholder={fallbackName}
                aria-label={t("staff.displayNameLabel")}
                className="!h-7 !min-h-7 max-w-[12rem] !text-caption"
              />
            ) : (
              <h3 className={`m-0 ${cardTitleClass}`}>{displayName}</h3>
            )}
            <button
              type="button"
              className={titleIconBtnClass}
              onMouseDown={(e) => {
                if (renaming) {
                  e.preventDefault();
                  commitRename();
                }
              }}
              onClick={() => {
                if (!renaming) startRename();
              }}
              aria-label={t("staff.editNameAria")}
              title={t("staff.editNameAria")}
              data-testid="assistant-edit-name"
            >
              <Pencil size={14} strokeWidth={2} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={titleIconBtnClass}
              onClick={() => setHistoryDialogOpen(true)}
              aria-label={t("staff.editHistoryAria")}
              title={t("staff.editHistoryAria")}
              data-testid="assistant-edit-history"
              disabled={!settings}
            >
              <Sparkles size={14} strokeWidth={2} aria-hidden="true" />
            </button>
            <Badge tone="info">{t("staff.kind.agent")}</Badge>
            <Badge tone="neutral">{t("staff.surface.frontline")}</Badge>
          </div>
          <p className={`mt-xs mb-0 ${cardBodyClass}`}>{t("staff.assistant.summary")}</p>
        </div>
      </div>

      {avatarError ? (
        <p className={`mb-0 ${formHelpClass} text-error`} role="alert">
          {avatarError}
        </p>
      ) : null}

      <div>
        <div className={cardMetaClass}>{t("staff.capabilitiesLabel")}</div>
        <ul className={`mt-xs mb-0 list-disc space-y-0.5 pl-4 ${captionClass}`}>
          {(
            t("staff.assistant.capabilities", {
              returnObjects: true,
            }) as string[]
          ).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

      <Link
        to={link.to}
        className={`${captionClass} font-medium text-accent no-underline hover:underline`}
      >
        {t(link.labelKey)}
      </Link>

      {settings ? (
        <AssistantHistorySettingsDialog
          open={historyDialogOpen}
          settings={settings}
          saving={saving}
          onClose={() => setHistoryDialogOpen(false)}
          onSave={onSaveHistory}
        />
      ) : null}
    </SurfaceCard>
  );
}

export function SettingsAiStaffPage() {
  const { t } = useTranslation(["settings", "common"]);

  return (
    <SettingsContentCard>
      <div className="flex flex-col gap-md">
        <p className={`mb-0 ${formHelpClass}`}>{t("staff.intro")}</p>

        <div className="grid gap-sm md:grid-cols-2">
          <AssistantStaffCard />
          <LiaisonIntroCard />

          {AI_STAFF_ROSTER.filter((staff) => staff.id !== "assistant").map((staff) => (
            <RosterStaffCard key={staff.id} staff={staff} />
          ))}
        </div>
      </div>
    </SettingsContentCard>
  );
}
