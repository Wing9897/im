import { Copy, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { LlmProfile } from "../../api/llmProfiles";
import { EmptyState } from "../common/EmptyState";
import { AiStaffAvatar, type AiStaffAvatarId } from "../aiStaff/AiStaffAvatar";
import { Badge, Button, FormActions } from "../ui";
import {
  cardBodyClass,
  captionClass,
  formHelpClass,
  sectionTitleClass,
} from "../ui/pageTypography";
import { normalizeLlmProvider } from "../../domain/settings/llmProviderConfig";
import type { LlmProvider } from "../../types";
import { LLM_TASK_STAFF_CLASSES } from "../../types/llmProfiles";
import { profileToDraft, type LlmProfileDraft } from "./LlmProfileEditorDialog";

type LlmTaskProfilesSectionProps = {
  profiles: LlmProfile[];
  providerLabels: Record<LlmProvider, { label: string }>;
  testingId: string | "new" | null;
  onCreate: () => void;
  onEdit: (profile: LlmProfile) => void;
  onCopy: (profile: LlmProfile) => void;
  onSetDefault: (profile: LlmProfile) => void;
  onDelete: (profile: LlmProfile) => void;
  onTest: (draft: LlmProfileDraft, profileId: string) => void;
};

function taskStaffBadges(profile: LlmProfile): string[] {
  return profile.staffClasses.filter((c) =>
    (LLM_TASK_STAFF_CLASSES as readonly string[]).includes(c),
  );
}

export function LlmTaskProfilesSection({
  profiles,
  providerLabels,
  testingId,
  onCreate,
  onEdit,
  onCopy,
  onSetDefault,
  onDelete,
  onTest,
}: LlmTaskProfilesSectionProps) {
  const { t } = useTranslation("settings");

  return (
    <section className="flex flex-col gap-md" data-testid="llm-task-profiles">
      <div className="flex flex-wrap items-start justify-between gap-sm">
        <div className="min-w-0">
          <h2 className={sectionTitleClass}>{t("profiles.listTitle")}</h2>
          <p className={`mt-xs mb-0 ${formHelpClass}`}>{t("profiles.intro")}</p>
        </div>
        {profiles.length > 0 ? (
          <Button type="button" variant="primary" size="sm" onClick={onCreate}>
            <Plus size={14} aria-hidden />
            {t("profiles.create")}
          </Button>
        ) : null}
      </div>

      {profiles.length === 0 ? (
        <div
          className="im-surface-panel rounded-xl border border-surface-border/80"
          data-testid="llm-profiles-empty"
        >
          <EmptyState
            compact
            title={t("profiles.emptyTitle")}
            description={t("profiles.empty")}
            actions={
              <Button type="button" variant="primary" size="sm" onClick={onCreate}>
                <Plus size={14} aria-hidden />
                {t("profiles.create")}
              </Button>
            }
          />
        </div>
      ) : (
        <div className="im-surface-panel rounded-xl border border-surface-border/80 divide-y divide-surface-border/70">
          {profiles.map((profile) => {
            const provider = normalizeLlmProvider(String(profile.provider));
            const providerLabel = providerLabels[provider]?.label ?? profile.provider;
            const taskClasses = taskStaffBadges(profile);
            return (
              <div
                key={profile.id}
                className="flex flex-col gap-sm px-lg py-md"
                data-testid={`llm-profile-card-${profile.id}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-sm">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-xs">
                      <h3 className="m-0 text-card-title font-medium leading-snug text-text-primary">
                        {profile.name}
                      </h3>
                      {profile.isDefault ? (
                        <Badge tone="info">{t("profiles.defaultBadge")}</Badge>
                      ) : null}
                      <Badge tone="neutral">{providerLabel}</Badge>
                    </div>
                    <p className={`mt-xs mb-0 ${cardBodyClass}`}>
                      {profile.model || t("profiles.noModel")}
                    </p>
                    {profile.baseUrl ? (
                      <p className={`mt-xs mb-0 ${captionClass}`}>{profile.baseUrl}</p>
                    ) : null}
                    {taskClasses.length > 0 ? (
                      <div className="mt-sm flex flex-wrap items-center gap-xs">
                        {taskClasses.map((staffClass) => (
                          <span
                            key={staffClass}
                            className="inline-flex items-center gap-xs rounded-md border border-surface-border/70 px-xs py-px"
                          >
                            <AiStaffAvatar
                              staffId={staffClass as AiStaffAvatarId}
                              size="xs"
                              label={t(`profiles.staffClass.${staffClass}`, {
                                defaultValue: staffClass,
                              })}
                            />
                            <span className={captionClass}>
                              {t(`profiles.staffClass.${staffClass}`, {
                                defaultValue: staffClass,
                              })}
                            </span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className={`mt-sm mb-0 ${captionClass}`}>
                        {t("profiles.noStaffClasses")}
                      </p>
                    )}
                  </div>

                  <FormActions inline>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => onTest(profileToDraft(profile), profile.id)}
                      disabled={testingId === profile.id}
                      aria-label={t("provider.testButton")}
                    >
                      {testingId === profile.id
                        ? t("provider.testing")
                        : t("provider.testButton")}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(profile)}
                      aria-label={t("profiles.edit")}
                    >
                      <Pencil size={14} aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onCopy(profile)}
                      aria-label={t("profiles.copy")}
                    >
                      <Copy size={14} aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onSetDefault(profile)}
                      disabled={profile.isDefault}
                      aria-label={t("profiles.setDefault")}
                    >
                      <Star size={14} aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(profile)}
                      disabled={profile.isDefault}
                      aria-label={t("profiles.delete")}
                    >
                      <Trash2 size={14} aria-hidden />
                    </Button>
                  </FormActions>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
