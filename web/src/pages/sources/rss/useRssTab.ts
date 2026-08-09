import { useCallback, useState } from "react";
import { deleteSource } from "../../../api/sources";
import { useFormSubmit } from "../../../hooks/useFormSubmit";
import { useSourceListTab } from "../board/useSourceListTab";
import { useSourceEditController } from "../board/useSourceEditController";
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

const removeFeed = (target: RssFeedItem) => deleteSource(target.source.id);
const feedToEditForm = (target: RssFeedItem) => resolveProviderForFeed(target).feedToForm(target);
const validateEditForm = (form: RssFormFields, target: RssFeedItem) =>
  resolveProviderForFeed(target).validateForm(form);
const formatEditError = (error: unknown) =>
  error instanceof Error ? error.message : String(i18n.t("sources:errors.updateFailed"));

async function saveFeed(target: RssFeedItem, form: RssFormFields) {
  const response = await resolveProviderForFeed(target).updateFeed(target, form);
  if (response.status === "error" && response.errorMessage) {
    throw new Error(response.errorMessage);
  }
}

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

  const edit = useSourceEditController<RssFeedItem, RssFormFields>({
    toForm: feedToEditForm,
    validate: validateEditForm,
    save: saveFeed,
    refresh: fetchFeeds,
    formatError: formatEditError,
  });

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

  const editProvider = edit.editTarget ? resolveProviderForFeed(edit.editTarget) : null;

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
    ...edit,
    editProvider,
  };
}
