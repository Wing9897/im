import { useCallback, useState } from "react";
import {
  createDiscordBot,
  updateDiscordBot,
  listDiscordBots,
  deleteSource,
} from "../../../api/sources";
import type { DiscordBotInfo } from "../../../types";
import { useFormSubmit } from "../../../hooks/useFormSubmit";
import { useSourceListTab } from "../board/useSourceListTab";
import { formatSourceLabel } from "../../../utils/sourceDisplay";
import { toErrorMessage } from "../../../utils/errors";
import { MASKED_SECRET } from "../../../utils/configValidation";
import i18n from "../../../i18n";

const removeDiscordBot = (target: DiscordBotInfo) => deleteSource(target.source.id);

export function useDiscordTab() {
  const {
    items: bots,
    initialLoading,
    isRefreshing,
    error,
    retrying,
    fetchItems: fetchBots,
    handleRetry,
    removeTarget,
    setRemoveTarget,
    removing,
    confirmRemove: handleRemoveBot,
  } = useSourceListTab<DiscordBotInfo>({ listFn: listDiscordBots, removeFn: removeDiscordBot });

  // Add form state
  const [botToken, setBotToken] = useState("");
  const { submitting, error: formError, handleSubmit } = useFormSubmit();

  // Edit dialog state
  const [editTarget, setEditTarget] = useState<DiscordBotInfo | null>(null);
  const [editName, setEditName] = useState("");
  const [editToken, setEditToken] = useState(MASKED_SECRET);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const handleAddBot = useCallback(async () => {
    await handleSubmit(async () => {
      const token = botToken.trim();
      if (!token) {
        throw new Error(String(i18n.t("sources:discord.botTokenRequired")));
      }

      const resp = await createDiscordBot({ botToken: token });
      if (resp.status === "error" && resp.errorMessage) {
        throw new Error(resp.errorMessage);
      }
      setBotToken("");
      await fetchBots();
    });
  }, [botToken, fetchBots, handleSubmit]);

  const openEditDialog = useCallback((bot: DiscordBotInfo) => {
    setEditTarget(bot);
    setEditName(formatSourceLabel(bot.source) || String(i18n.t("sources:discord.fallbackName")));
    setEditToken(MASKED_SECRET);
    setEditError(null);
  }, []);

  const closeEditDialog = useCallback(() => {
    setEditTarget(null);
    setEditName("");
    setEditToken(MASKED_SECRET);
    setEditError(null);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editTarget) return;
    const trimmedName = editName.trim();
    if (!trimmedName) {
      setEditError(String(i18n.t("sources:discord.displayNameRequired")));
      return;
    }
    setEditSubmitting(true);
    setEditError(null);
    try {
      const patch: { name: string; botToken?: string } = { name: trimmedName };
      if (editToken && editToken !== MASKED_SECRET) {
        patch.botToken = editToken.trim();
      }
      const resp = await updateDiscordBot(editTarget.source.id, patch);
      if (resp.status === "error" && resp.errorMessage) {
        throw new Error(resp.errorMessage);
      }
      closeEditDialog();
      await fetchBots();
    } catch (e) {
      setEditError(toErrorMessage(e));
    } finally {
      setEditSubmitting(false);
    }
  }, [editTarget, editName, editToken, closeEditDialog, fetchBots]);

  return {
    bots,
    initialLoading,
    isRefreshing,
    error,
    botToken,
    setBotToken,
    submitting,
    formError,
    removeTarget,
    setRemoveTarget,
    removing,
    retrying,
    fetchBots,
    handleRetry,
    handleAddBot,
    handleRemoveBot,
    editTarget,
    editName,
    setEditName,
    editToken,
    setEditToken,
    editSubmitting,
    editError,
    openEditDialog,
    closeEditDialog,
    handleSaveEdit,
  };
}
