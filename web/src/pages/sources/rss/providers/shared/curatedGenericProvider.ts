import {
  createRssFeed,
  updateRssFeed,
} from "../../../../../api/accounts";
import { feedToForm, formToCreatePayload, formToPatch, RssEditDialog } from "../../rssFormModel";
import type {
  RssFormFields,
  RssPickerGroupKey,
  RssProviderDefinition,
  RssProviderId,
} from "../types";
import type { ComponentType } from "react";
import type { RssAddFormProps } from "../types";

interface CuratedGenericRssProviderConfig {
  id: Exclude<RssProviderId, "generic">;
  labelKey: string;
  pickerHintKey: string;
  pickerGroupKey: RssPickerGroupKey;
  iconPlatform: string;
  formTitleKey: string;
  formDescriptionKey: string;
  emptyHintKey: string;
  validateForm: (fields: RssFormFields) => string | null;
  AddForm: ComponentType<RssAddFormProps>;
}

/** Curated provider backed by the generic ``platform=rss`` API. */
export function createCuratedGenericRssProvider(
  config: CuratedGenericRssProviderConfig,
): RssProviderDefinition {
  return {
    id: config.id,
    labelKey: config.labelKey,
    pickerHintKey: config.pickerHintKey,
    pickerGroupKey: config.pickerGroupKey,
    iconPlatform: config.iconPlatform,
    formTitleKey: config.formTitleKey,
    formDescriptionKey: config.formDescriptionKey,
    emptyHintKey: config.emptyHintKey,
    validateForm: config.validateForm,
    createFeed: async (fields) => {
      const resp = await createRssFeed(formToCreatePayload(fields));
      return { status: resp.status, errorMessage: resp.errorMessage };
    },
    updateFeed: async (feed, fields) => {
      const resp = await updateRssFeed(feed.account.id, formToPatch(fields));
      return { status: resp.status, errorMessage: resp.errorMessage };
    },
    feedToForm: (feed) => feedToForm(feed),
    AddForm: config.AddForm,
    EditDialog: RssEditDialog,
  };
}
