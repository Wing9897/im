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
import { useSourceEditController } from "../board/useSourceEditController";
import { formatSourceLabel } from "../../../utils/sourceDisplay";
import { toErrorMessage } from "../../../utils/errors";
import { MASKED_SECRET } from "../../../utils/configValidation";
import i18n from "../../../i18n";

const removeDiscordBot = (target: DiscordBotInfo) => deleteSource(target.source.id);

interface DiscordEditForm {
  name: string;
  botToken: string;
}

function discordBotToForm(bot: DiscordBotInfo): DiscordEditForm {
  return {
    name: formatSourceLabel(bot.source) || String(i18n.t("sources:discord.fallbackName")),
    botToken: MASKED_SECRET,
  };
}

function validateDiscordEdit(form: DiscordEditForm): string | null {
  if (!form.name.trim()) {
    return String(i18n.t("sources:discord.displayNameRequired"));
  }
  return null;
}

async function saveDiscordEdit(target: DiscordBotInfo, form: DiscordEditForm) {
  const patch: { name: string; botToken?: string } = { name: form.name.trim() };
  if (form.botToken && form.botToken !== MASKED_SECRET) {
    patch.botToken = form.botToken.trim();
  }
  const resp = await updateDiscordBot(target.source.id, patch);
  if (resp.status === "error" && resp.errorMessage) {
    throw new Error(resp.errorMessage);
  }
}

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

  const [botToken, setBotToken] = useState("");
  const { submitting, error: formError, handleSubmit } = useFormSubmit();

  const {
    editTarget,
    editForm,
    setEditForm,
    editSubmitting,
    editError,
    openEditDialog,
    closeEditDialog,
    handleSaveEdit,
  } = useSourceEditController<DiscordBotInfo, DiscordEditForm>({
    toForm: discordBotToForm,
    validate: validateDiscordEdit,
    save: saveDiscordEdit,
    refresh: fetchBots,
    formatError: toErrorMessage,
  });

  const setEditName = useCallback((name: string) => {
    setEditForm((current) => (current ? { ...current, name } : current));
  }, [setEditForm]);

  const setEditToken = useCallback((token: string) => {
    setEditForm((current) => (current ? { ...current, botToken: token } : current));
  }, [setEditForm]);

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
    editName: editForm?.name ?? "",
    setEditName,
    editToken: editForm?.botToken ?? MASKED_SECRET,
    setEditToken,
    editSubmitting,
    editError,
    openEditDialog,
    closeEditDialog,
    handleSaveEdit,
  };
}
