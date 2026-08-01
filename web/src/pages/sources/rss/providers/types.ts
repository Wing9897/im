import type { ComponentType } from "react";

import type { Account, Channel } from "../../../../types";

/** Known RSS sub-providers under the RSS sources tab. */
export type RssProviderId = "generic" | "github" | "hackernews" | "linuxdo" | "v2ex";

export type RssPickerGroupKey = "zhCommunity" | "techNews" | "devTools" | "custom";

export interface RssFormFields {
  feedUrl: string;
  name: string;
  pollIntervalMinutes: number;
}

/** Unified feed row for the RSS tab list (generic RSS + curated providers). */
export interface RssFeedItem {
  account: Account;
  channel: Channel | null;
  feedUrl: string;
  pollIntervalSeconds: number;
  lastError: string | null;
  lastSuccessAt: string | null;
  providerId: RssProviderId;
}

export interface RssAddFormProps {
  fields: RssFormFields;
  setFields: (
    updater: RssFormFields | ((prev: RssFormFields) => RssFormFields),
  ) => void;
  submitting: boolean;
  formError: string | null;
  onSubmit: () => void;
}

interface RssEditDialogProps {
  feed: RssFeedItem;
  form: RssFormFields;
  setForm: React.Dispatch<React.SetStateAction<RssFormFields>>;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onSave: () => void;
}

interface RssCreateResult {
  status: string;
  errorMessage: string | null;
}

export interface RssProviderDefinition {
  id: RssProviderId;
  /** i18n key under sources:rss.providers.<id>.label */
  labelKey: string;
  /** i18n key under sources:rss.providers.<id>.pickerHint */
  pickerHintKey: string;
  /** Stable group id; label resolved via sources:rss.pickerGroups.<id> */
  pickerGroupKey: RssPickerGroupKey;
  /** Platform icon key passed to PlatformIcon. */
  iconPlatform: string;
  formTitleKey: string;
  formDescriptionKey: string;
  emptyHintKey: string;
  validateForm: (fields: RssFormFields) => string | null;
  createFeed: (fields: RssFormFields) => Promise<RssCreateResult>;
  updateFeed: (feed: RssFeedItem, fields: RssFormFields) => Promise<RssCreateResult>;
  feedToForm: (feed: RssFeedItem) => RssFormFields;
  AddForm: ComponentType<RssAddFormProps>;
  EditDialog: ComponentType<RssEditDialogProps>;
}

export const INITIAL_RSS_FORM: RssFormFields = {
  feedUrl: "",
  name: "",
  pollIntervalMinutes: 5,
};
