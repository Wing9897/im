import { useCallback, useState } from "react";
import { deleteAccount } from "../../../api/accounts";
import { useFormSubmit } from "../../../hooks/useFormSubmit";
import { useSourceListTab } from "../useSourceListTab";
import {
  DEFAULT_RSS_PROVIDER_ID,
  getRssProvider,
  listAllRssTabFeeds,
  resolveProviderForFeed,
  RSS_PROVIDERS,
} from "./providers/registry";
import type { RssFeedItem, RssFormFields, RssProviderId } from "./providers/types";
import { INITIAL_RSS_FORM } from "./providers/types";
import i18n from "../../../i18n";

const removeFeed = (target: RssFeedItem) => deleteAccount(target.account.id);

export function useRssTab() {
  const {
    items: feeds,
    initialLoading,
    isRefreshing,
    error,
    retrying,
    fetchItems: fetchFeeds,
    handleRetry,
    removeTarget,
    setRemoveTarget,
    removing,
    confirmRemove: handleRemoveFeed,
  } = useSourceListTab<RssFeedItem>({ listFn: listAllRssTabFeeds, removeFn: removeFeed });

  const [activeProviderId, setActiveProviderId] = useState<RssProviderId>(DEFAULT_RSS_PROVIDER_ID);
  const activeProvider = getRssProvider(activeProviderId);

  const [form, setForm] = useState<RssFormFields>(INITIAL_RSS_FORM);
  const { submitting, error: formError, handleSubmit } = useFormSubmit();

  const [editTarget, setEditTarget] = useState<RssFeedItem | null>(null);
  const [editForm, setEditForm] = useState<RssFormFields | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const handleProviderChange = useCallback((providerId: RssProviderId) => {
    setActiveProviderId(providerId);
    setForm(INITIAL_RSS_FORM);
  }, []);

  const handleAddFeed = useCallback(async () => {
    await handleSubmit(async () => {
      const validationError = activeProvider.validateForm(form);
      if (validationError) {
        throw new Error(validationError);
      }

      const resp = await activeProvider.createFeed(form);
      if (resp.status === "error" && resp.errorMessage) {
        throw new Error(resp.errorMessage);
      }
      setForm(INITIAL_RSS_FORM);
      await fetchFeeds();
    });
  }, [activeProvider, form, fetchFeeds, handleSubmit]);

  const openEditDialog = useCallback((feed: RssFeedItem) => {
    const provider = resolveProviderForFeed(feed);
    setEditTarget(feed);
    setEditForm(provider.feedToForm(feed));
    setEditError(null);
  }, []);

  const closeEditDialog = useCallback(() => {
    setEditTarget(null);
    setEditForm(null);
    setEditError(null);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editTarget || !editForm) return;
    const provider = resolveProviderForFeed(editTarget);
    setEditError(null);

    const validationError = provider.validateForm(editForm);
    if (validationError) {
      setEditError(validationError);
      return;
    }

    setEditSubmitting(true);
    try {
      const resp = await provider.updateFeed(editTarget, editForm);
      if (resp.status === "error" && resp.errorMessage) {
        throw new Error(resp.errorMessage);
      }
      closeEditDialog();
      await fetchFeeds();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : String(i18n.t("sources:errors.updateFailed")));
    } finally {
      setEditSubmitting(false);
    }
  }, [closeEditDialog, editForm, editTarget, fetchFeeds]);

  const editProvider = editTarget ? resolveProviderForFeed(editTarget) : null;

  return {
    feeds,
    providers: RSS_PROVIDERS,
    activeProviderId,
    activeProvider,
    handleProviderChange,
    initialLoading,
    isRefreshing,
    error,
    form,
    setForm,
    submitting,
    formError,
    removeTarget,
    setRemoveTarget,
    removing,
    retrying,
    fetchFeeds,
    handleRetry,
    handleAddFeed,
    handleRemoveFeed,
    editTarget,
    editForm,
    setEditForm,
    editProvider,
    editSubmitting,
    editError,
    openEditDialog,
    closeEditDialog,
    handleSaveEdit,
  };
}
