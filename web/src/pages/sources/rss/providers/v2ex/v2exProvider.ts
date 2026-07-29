import { createCuratedGenericRssProvider } from "../shared/curatedGenericProvider";
import { validateV2exFeedUrl } from "../rssUrlPatterns";
import { V2exFeedForm } from "./V2exFeedForm";

export const v2exRssProvider = createCuratedGenericRssProvider({
  id: "v2ex",
  labelKey: "rss.providers.v2ex.label",
  pickerHintKey: "rss.providers.v2ex.pickerHint",
  pickerGroupKey: "zhCommunity",
  iconPlatform: "v2ex",
  formTitleKey: "rss.providers.v2ex.formTitle",
  formDescriptionKey: "rss.providers.v2ex.formDescription",
  emptyHintKey: "rss.providers.v2ex.emptyHint",
  validateForm: (fields) => validateV2exFeedUrl(fields.feedUrl),
  AddForm: V2exFeedForm,
});
