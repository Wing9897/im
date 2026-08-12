import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { MenuSelect } from "../ui";
import { buttonBaseClass, buttonSizeClass } from "../ui/controlStyles";
import { formHelpClass } from "../ui/pageTypography";
import {
  listLlmGlobalSlots,
  listLlmProfiles,
  type LlmGlobalSlotBinding,
  type LlmProfile,
} from "../../api/llmProfiles";
import { isLlmProfileComplete } from "../../domain/settings/llmProfileCompleteness";

/** Sentinel value: clear session override and follow the assistant global slot. */
export const ASSISTANT_LLM_FOLLOW_STAFF = "";

type AssistantSessionLlmProfileSelectProps = {
  value: string | null | undefined;
  onChange: (llmProfileId: string | null) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
};

function assistantSlotBoundAndComplete(
  slots: LlmGlobalSlotBinding[],
  profiles: LlmProfile[],
): boolean {
  const binding = slots.find((s) => s.slot === "assistant");
  const profileId = (binding?.profileId ?? "").trim();
  if (!profileId) return false;
  const profile = profiles.find((p) => p.id === profileId);
  return Boolean(profile && isLlmProfileComplete(profile));
}

/**
 * Per-session LLM profile picker for assistant chat chrome.
 * When the assistant global slot is unbound / incomplete → CTA to ``/ai/provider``.
 */
export function AssistantSessionLlmProfileSelect({
  value,
  onChange,
  disabled = false,
  id = "assistant-llm-profile",
  className,
}: AssistantSessionLlmProfileSelectProps) {
  const { t } = useTranslation("assistant");
  const [profiles, setProfiles] = useState<LlmProfile[]>([]);
  const [slots, setSlots] = useState<LlmGlobalSlotBinding[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setProfilesLoading(true);
    Promise.all([listLlmProfiles(), listLlmGlobalSlots()])
      .then(([list, slotRows]) => {
        if (cancelled) return;
        setProfiles(list);
        setSlots(slotRows);
      })
      .catch(() => {
        if (cancelled) return;
        setProfiles([]);
        setSlots([]);
      })
      .finally(() => {
        if (!cancelled) setProfilesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Drop a stale incomplete / deleted override once profiles load.
  useEffect(() => {
    if (profilesLoading) return;
    const current = (value ?? "").trim();
    if (!current) return;
    const selected = profiles.find((p) => p.id === current);
    if (!selected || !isLlmProfileComplete(selected)) {
      onChange(null);
    }
  }, [profiles, profilesLoading, value, onChange]);

  const slotReady = assistantSlotBoundAndComplete(slots, profiles);
  const hasCompleteProfile = profiles.some(isLlmProfileComplete);
  const profilesAllIncomplete =
    !profilesLoading && profiles.length > 0 && !hasCompleteProfile;

  const profileOptions = useMemo(
    () => [
      {
        value: ASSISTANT_LLM_FOLLOW_STAFF,
        label: t("llmProfile.followStaff"),
      },
      ...profiles.map((profile) => {
        const complete = isLlmProfileComplete(profile);
        const base = profile.isDefault
          ? `${profile.name} (${t("llmProfile.defaultBadge")})`
          : profile.name;
        return {
          value: profile.id,
          label: complete
            ? base
            : `${base} — ${t("llmProfile.incompleteBadge")}`,
          disabled: !complete,
        };
      }),
    ],
    [profiles, t],
  );

  if (profilesLoading) {
    return (
      <p className={`m-0 ${formHelpClass}`} data-testid="assistant-llm-profile-loading">
        {t("llmProfile.loading")}
      </p>
    );
  }

  if (!slotReady) {
    return (
      <div
        className="flex flex-col items-start gap-sm"
        data-testid="assistant-llm-profile-unbound"
      >
        <p className={`m-0 ${formHelpClass}`}>{t("llmProfile.slotUnbound")}</p>
        <a
          href="/ai/provider"
          data-testid="assistant-llm-profile-slot-cta"
          className={[
            buttonBaseClass,
            buttonSizeClass.sm,
            "inline-flex no-underline bg-accent border-accent text-[var(--text-on-accent)] font-medium hover:bg-[color-mix(in_srgb,var(--accent)_88%,var(--text-primary))]",
          ].join(" ")}
        >
          {t("llmProfile.slotCta")}
        </a>
      </div>
    );
  }

  return (
    <div className={["flex flex-col gap-sm", className].filter(Boolean).join(" ")}>
      <MenuSelect
        id={id}
        variant="field"
        menuPortal
        value={(value ?? "").trim() || ASSISTANT_LLM_FOLLOW_STAFF}
        options={profileOptions}
        placeholder={t("llmProfile.placeholder")}
        onChange={(next) => {
          const trimmed = next.trim();
          onChange(trimmed ? trimmed : null);
        }}
        className="min-w-0 w-full"
        aria-label={t("llmProfile.label")}
        data-testid="assistant-llm-profile"
        disabled={disabled || profilesAllIncomplete}
      />
      {profilesAllIncomplete ? (
        <div
          className="flex flex-wrap items-center gap-sm"
          data-testid="assistant-llm-profile-all-incomplete"
        >
          <p className={`m-0 ${formHelpClass}`}>{t("llmProfile.allIncomplete")}</p>
          <a
            href="/ai/provider"
            className={[
              buttonBaseClass,
              buttonSizeClass.sm,
              "inline-flex no-underline bg-accent border-accent text-[var(--text-on-accent)] font-medium hover:bg-[color-mix(in_srgb,var(--accent)_88%,var(--text-primary))]",
            ].join(" ")}
          >
            {t("llmProfile.slotCta")}
          </a>
        </div>
      ) : null}
    </div>
  );
}
