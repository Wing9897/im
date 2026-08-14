import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { listLlmProfiles, type LlmProfile } from "../../../api/llmProfiles";
import { useToast } from "../../../context/ToastContext";
import {
  firstCompleteProfile,
  isLlmProfileComplete,
} from "../../../domain/settings/llmProfileCompleteness";
import { toError } from "../../../utils/errors";

export type LlmProfileGate = {
  ready: boolean;
  reason: string | null;
};

type Options = {
  llmProfileId: string;
  onLlmProfileIdChange: (value: string) => void;
  onLlmProfileGateChange?: (gate: LlmProfileGate) => void;
};

/**
 * Chat editor LLM profile picker state: loads profiles, preselects a complete
 * default on create, clears stale ids, and reports the save gate upward.
 */
export function useChatEditorLlmProfiles({
  llmProfileId,
  onLlmProfileIdChange,
  onLlmProfileGateChange,
}: Options) {
  const { t } = useTranslation("common");
  const { showToast } = useToast();
  const [profiles, setProfiles] = useState<LlmProfile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setProfilesLoading(true);
    listLlmProfiles()
      .then((list) => {
        if (cancelled) return;
        setProfiles(list);
      })
      .catch((error) => {
        if (cancelled) return;
        showToast(toError(error).message, "error");
        setProfiles([]);
      })
      .finally(() => {
        if (!cancelled) setProfilesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showToast]);

  // Create path: preselect only a *complete* default (never invent a fake selection).
  useEffect(() => {
    if (llmProfileId.trim() || profilesLoading) return;
    const pick = firstCompleteProfile(profiles);
    if (pick) onLlmProfileIdChange(pick.id);
  }, [llmProfileId, profiles, profilesLoading, onLlmProfileIdChange]);

  // If the stored id points at an incomplete / missing profile, clear it on create-like empty pick.
  useEffect(() => {
    if (profilesLoading || !llmProfileId.trim()) return;
    const selected = profiles.find((p) => p.id === llmProfileId);
    if (selected && !isLlmProfileComplete(selected)) {
      // Keep id so edit mode can show the incomplete selection + block save;
      // do not auto-clear — user must pick a complete profile.
      return;
    }
    if (!selected && profiles.length > 0) {
      // Stale id after profile delete — clear so placeholder shows.
      onLlmProfileIdChange("");
    }
  }, [llmProfileId, profiles, profilesLoading, onLlmProfileIdChange]);

  const profileOptions = useMemo(
    () =>
      profiles.map((profile) => {
        const complete = isLlmProfileComplete(profile);
        return {
          value: profile.id,
          label: complete
            ? profile.name
            : `${profile.name} — ${t("tasks:editor.llmProfileIncompleteBadge")}`,
          disabled: !complete,
        };
      }),
    [profiles, t],
  );

  const selectedProfile = profiles.find((p) => p.id === llmProfileId) ?? null;
  const selectedComplete = selectedProfile ? isLlmProfileComplete(selectedProfile) : false;
  const hasCompleteProfile = profiles.some(isLlmProfileComplete);
  const profilesEmpty = !profilesLoading && profiles.length === 0;
  const profilesAllIncomplete =
    !profilesLoading && profiles.length > 0 && !hasCompleteProfile;

  useEffect(() => {
    if (!onLlmProfileGateChange) return;
    if (profilesLoading) {
      onLlmProfileGateChange({ ready: false, reason: t("tasks:editor.saveNeeds.llmProfileLoading") });
      return;
    }
    if (profilesEmpty) {
      onLlmProfileGateChange({
        ready: false,
        reason: t("tasks:editor.saveNeeds.llmProfileEmpty"),
      });
      return;
    }
    if (!llmProfileId.trim() || !selectedProfile) {
      onLlmProfileGateChange({
        ready: false,
        reason: t("tasks:editor.saveNeeds.llmProfile"),
      });
      return;
    }
    if (!selectedComplete) {
      onLlmProfileGateChange({
        ready: false,
        reason: t("tasks:editor.saveNeeds.llmProfileIncomplete"),
      });
      return;
    }
    onLlmProfileGateChange({ ready: true, reason: null });
  }, [
    llmProfileId,
    onLlmProfileGateChange,
    profilesEmpty,
    profilesLoading,
    selectedComplete,
    selectedProfile,
    t,
  ]);

  return {
    profilesLoading,
    profilesEmpty,
    profilesAllIncomplete,
    profileOptions,
    selectedProfile,
    selectedComplete,
  };
}
