import { createCuratedGenericRssProvider } from "../shared/curatedGenericProvider";
import { validateGitHubFeedUrl } from "../rssUrlPatterns";
import { GitHubFeedForm } from "./GitHubFeedForm";

export const githubRssProvider = createCuratedGenericRssProvider({
  id: "github",
  labelKey: "rss.providers.github.label",
  pickerHintKey: "rss.providers.github.pickerHint",
  pickerGroupKey: "devTools",
  iconPlatform: "github",
  formTitleKey: "rss.providers.github.formTitle",
  formDescriptionKey: "rss.providers.github.formDescription",
  emptyHintKey: "rss.providers.github.emptyHint",
  validateForm: (fields) => validateGitHubFeedUrl(fields.feedUrl),
  AddForm: GitHubFeedForm,
});
