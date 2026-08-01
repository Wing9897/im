import { createCuratedGenericRssProvider } from "../shared/curatedGenericProvider";
import { validateLinuxDoFeedUrl } from "../rssUrlPatterns";
import { LinuxDoFeedForm } from "./LinuxDoFeedForm";

export const linuxdoRssProvider = createCuratedGenericRssProvider({
  id: "linuxdo",
  labelKey: "rss.providers.linuxdo.label",
  pickerHintKey: "rss.providers.linuxdo.pickerHint",
  pickerGroupKey: "zhCommunity",
  iconPlatform: "linuxdo",
  formTitleKey: "rss.providers.linuxdo.formTitle",
  formDescriptionKey: "rss.providers.linuxdo.formDescription",
  emptyHintKey: "rss.providers.linuxdo.emptyHint",
  validateForm: (fields) => validateLinuxDoFeedUrl(fields.feedUrl),
  AddForm: LinuxDoFeedForm,
});
