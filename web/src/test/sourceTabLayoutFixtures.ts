import { vi } from "vitest";

import type { Account } from "../types";
import type {
  DiscordBotInfo,
  HttpSourceInfo,
  MqttBrokerInfo,
  EmailMailboxInfo,
} from "../types/sources";
import type { RssFeedItem } from "../pages/sources/rss/providers/types";
import { getRssProvider, RSS_PROVIDERS } from "../pages/sources/rss/providers/registry";
import { INITIAL_RSS_FORM } from "../pages/sources/rss/providers/types";
import { INITIAL_EMAIL_FORM } from "../pages/sources/email/emailFormModel";
import { INITIAL_HTTP_FORM } from "../pages/sources/http/httpFormTypes";

export function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: "acc-1",
    platform: "rss",
    name: "Account",
    status: "connected",
    lastError: null,
    lastConnectedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function makeFeed(overrides: Partial<RssFeedItem> = {}): RssFeedItem {
  return {
    account: makeAccount({ id: "rss-1", platform: "rss", name: "My Feed" }),
    channel: null,
    feedUrl: "https://example.com/feed.xml",
    pollIntervalSeconds: 300,
    lastError: null,
    lastSuccessAt: null,
    providerId: "generic",
    ...overrides,
  };
}

export function makeBot(overrides: Partial<DiscordBotInfo> = {}): DiscordBotInfo {
  return {
    account: makeAccount({ id: "discord-1", platform: "discord", name: "My Bot" }),
    channels: [],
    ...overrides,
  };
}

export function makeBroker(overrides: Partial<MqttBrokerInfo> = {}): MqttBrokerInfo {
  return {
    account: makeAccount({ id: "mqtt-1", platform: "mqtt", name: "MQTT Broker" }),
    brokerUrl: "mqtt://broker.example.com:1883",
    topics: ["sensors/+/data"],
    lastError: null,
    lastSuccessAt: null,
    ...overrides,
  };
}

export function makeHttpSource(overrides: Partial<HttpSourceInfo> = {}): HttpSourceInfo {
  return {
    account: makeAccount({ id: "http-1", platform: "http", name: "HTTP Source" }),
    channel: null,
    url: "https://example.com/api",
    method: "GET",
    authType: "none",
    bearerToken: null,
    basicUsername: null,
    basicPassword: null,
    headers: {},
    bodyType: "none",
    body: null,
    pollIntervalSeconds: 300,
    maxContentChars: 32000,
    timeoutSeconds: 30,
    lastError: null,
    lastSuccessAt: null,
    ...overrides,
  };
}

export function makeMailbox(overrides: Partial<EmailMailboxInfo> = {}): EmailMailboxInfo {
  return {
    account: makeAccount({ id: "email-1", platform: "email", name: "user@gmail.com" }),
    imapHost: "imap.gmail.com",
    imapPort: 993,
    useSsl: true,
    username: "user@gmail.com",
    folders: ["INBOX"],
    pollIntervalSeconds: 300,
    initialSyncDays: 7,
    initialSyncMaxMessages: 100,
    senderAllowlist: [],
    markAsRead: false,
    folderCursors: {},
    channels: [],
    lastError: null,
    lastSuccessAt: null,
    ...overrides,
  };
}

export function rssState(overrides: Record<string, unknown> = {}) {
  const initialLoading = (overrides.initialLoading ?? overrides.loading ?? false) as boolean;
  return {
    feeds: [],
    providers: RSS_PROVIDERS,
    activeProviderId: "generic",
    activeProvider: getRssProvider("generic"),
    handleProviderChange: vi.fn(),
    initialLoading,
    isRefreshing: (overrides.isRefreshing ?? false) as boolean,
    error: null,
    form: INITIAL_RSS_FORM,
    setForm: vi.fn(),
    submitting: false,
    formError: null,
    removeTarget: null,
    setRemoveTarget: vi.fn(),
    removing: false,
    retrying: false,
    fetchFeeds: vi.fn(),
    handleRetry: vi.fn(),
    handleAddFeed: vi.fn(async () => {}),
    handleRemoveFeed: vi.fn(async () => {}),
    editTarget: null,
    editForm: null,
    setEditForm: vi.fn(),
    editProvider: null,
    editSubmitting: false,
    editError: null,
    openEditDialog: vi.fn(),
    closeEditDialog: vi.fn(),
    handleSaveEdit: vi.fn(async () => {}),
    ...overrides,
  };
}

export function discordState(overrides: Record<string, unknown> = {}) {
  const initialLoading = (overrides.initialLoading ?? overrides.loading ?? false) as boolean;
  return {
    bots: [],
    initialLoading,
    isRefreshing: (overrides.isRefreshing ?? false) as boolean,
    error: null,
    botToken: "",
    setBotToken: vi.fn(),
    submitting: false,
    formError: null,
    removeTarget: null,
    setRemoveTarget: vi.fn(),
    removing: false,
    retrying: false,
    fetchBots: vi.fn(),
    handleRetry: vi.fn(),
    handleAddBot: vi.fn(async () => {}),
    handleRemoveBot: vi.fn(async () => {}),
    editTarget: null,
    editName: "",
    setEditName: vi.fn(),
    editToken: "********",
    setEditToken: vi.fn(),
    editSubmitting: false,
    editError: null,
    openEditDialog: vi.fn(),
    closeEditDialog: vi.fn(),
    handleSaveEdit: vi.fn(async () => {}),
    ...overrides,
  };
}

export function mqttState(overrides: Record<string, unknown> = {}) {
  const initialLoading = (overrides.initialLoading ?? overrides.loading ?? false) as boolean;
  return {
    accounts: [],
    initialLoading,
    isRefreshing: (overrides.isRefreshing ?? false) as boolean,
    error: null,
    form: {
      brokerUrl: "",
      topics: [""],
      username: "",
      password: "",
      clientId: "",
    },
    setForm: vi.fn(),
    submitting: false,
    formError: null,
    removeTarget: null,
    setRemoveTarget: vi.fn(),
    removing: false,
    retrying: false,
    fetchMqttAccounts: vi.fn(),
    handleRetry: vi.fn(),
    handleAddMqttAccount: vi.fn(async () => {}),
    handleRemoveMqttAccount: vi.fn(async () => {}),
    editTarget: null,
    editForm: null,
    setEditForm: vi.fn(),
    editSubmitting: false,
    editError: null,
    openEditDialog: vi.fn(),
    closeEditDialog: vi.fn(),
    handleSaveEdit: vi.fn(async () => {}),
    ...overrides,
  };
}

export function httpState(overrides: Record<string, unknown> = {}) {
  const initialLoading = (overrides.initialLoading ?? overrides.loading ?? false) as boolean;
  return {
    sources: [],
    initialLoading,
    isRefreshing: (overrides.isRefreshing ?? false) as boolean,
    error: null,
    form: INITIAL_HTTP_FORM,
    setForm: vi.fn(),
    submitting: false,
    formError: null,
    removeTarget: null,
    setRemoveTarget: vi.fn(),
    removing: false,
    retrying: false,
    fetchHttpSources: vi.fn(),
    handleRetry: vi.fn(),
    handleAddHttpSource: vi.fn(async () => {}),
    handleRemoveHttpSource: vi.fn(async () => {}),
    editTarget: null,
    editForm: null,
    setEditForm: vi.fn(),
    editSubmitting: false,
    editError: null,
    openEditDialog: vi.fn(),
    closeEditDialog: vi.fn(),
    handleSaveEdit: vi.fn(async () => {}),
    ...overrides,
  };
}

export function emailState(overrides: Record<string, unknown> = {}) {
  const initialLoading = (overrides.initialLoading ?? overrides.loading ?? false) as boolean;
  return {
    mailboxes: [],
    initialLoading,
    isRefreshing: (overrides.isRefreshing ?? false) as boolean,
    error: null,
    form: INITIAL_EMAIL_FORM,
    setForm: vi.fn(),
    setPreset: vi.fn(),
    submitting: false,
    formError: null,
    removeTarget: null,
    setRemoveTarget: vi.fn(),
    removing: false,
    retrying: false,
    fetchMailboxes: vi.fn(),
    handleRetry: vi.fn(),
    handleAddMailbox: vi.fn(async () => {}),
    handleRemoveMailbox: vi.fn(async () => {}),
    editTarget: null,
    editForm: null,
    setEditForm: vi.fn(),
    editResetCursors: false,
    setEditResetCursors: vi.fn(),
    editSubmitting: false,
    editError: null,
    openEditDialog: vi.fn(),
    closeEditDialog: vi.fn(),
    handleSaveEdit: vi.fn(async () => {}),
    ...overrides,
  };
}
