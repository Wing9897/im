import { createCuratedGenericRssProvider } from "../shared/curatedGenericProvider";
import { validateHackerNewsFeedUrl } from "../rssUrlPatterns";
import { HackerNewsFeedForm } from "./HackerNewsFeedForm";

export const hackernewsRssProvider = createCuratedGenericRssProvider({
  id: "hackernews",
  labelKey: "rss.providers.hackernews.label",
  pickerHintKey: "rss.providers.hackernews.pickerHint",
  pickerGroupKey: "techNews",
  iconPlatform: "hackernews",
  formTitleKey: "rss.providers.hackernews.formTitle",
  formDescriptionKey: "rss.providers.hackernews.formDescription",
  emptyHintKey: "rss.providers.hackernews.emptyHint",
  validateForm: (fields) => validateHackerNewsFeedUrl(fields.feedUrl),
  AddForm: HackerNewsFeedForm,
});
