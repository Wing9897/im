import {
  createRssFeed,
  updateRssFeed,
} from "../../../../api/sources";
import i18n from "../../../../i18n";
import { RssFeedForm } from "../RssFeedForm";
import { feedToForm, formToCreatePayload, formToPatch, RssEditDialog } from "../rssFormModel";
import type { RssFormFields, RssProviderDefinition } from "./types";

function validateGenericForm(fields: RssFormFields): string | null {
  const url = fields.feedUrl.trim();
  if (!url) return String(i18n.t("sources:rssValidate.genericRequired"));
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return String(i18n.t("sources:rssValidate.genericHttp"));
  }
  return null;
}

export const genericRssProvider: RssProviderDefinition = {
  id: "generic",
  labelKey: "rss.providers.generic.label",
  pickerHintKey: "rss.providers.generic.pickerHint",
  pickerGroupKey: "custom",
  iconPlatform: "rss",
  formTitleKey: "rss.providers.generic.formTitle",
  formDescriptionKey: "rss.providers.generic.formDescription",
  emptyHintKey: "rss.providers.generic.emptyHint",
  validateForm: validateGenericForm,
  createFeed: async (fields) => {
    const resp = await createRssFeed(formToCreatePayload(fields));
    return { status: resp.status, errorMessage: resp.errorMessage };
  },
  updateFeed: async (feed, fields) => {
    const resp = await updateRssFeed(feed.source.id, formToPatch(fields));
    return { status: resp.status, errorMessage: resp.errorMessage };
  },
  feedToForm: (feed) => feedToForm(feed),
  AddForm: RssFeedForm,
  EditDialog: RssEditDialog,
};
