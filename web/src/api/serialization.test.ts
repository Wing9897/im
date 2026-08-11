import { describe, it, expect } from "vitest";

describe("JSON serialization round-trip consistency", () => {
  it("AnalysisTask survives JSON round-trip", () => {
    const task = {
      id: "task-uuid-1",
      name: "Daily Analysis",
      description: null,
      promptTemplate: "Analyze {{messages}}",
      analysisMode: "leaderboard",
      analysisTimeRange: "7d",
      version: 3,
      isActive: true,
      channelIds: ["ch-1", "ch-2"],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-15T00:00:00.000Z",
    };
    expect(JSON.parse(JSON.stringify(task))).toEqual(task);
  });

  it("Source survives JSON round-trip", () => {
    const source = {
      id: "acc-1",
      platform: "telegram",
      name: "Main Source",
      status: "connected",
      lastError: null,
      lastConnectedAt: "2026-01-10T12:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-10T12:00:00.000Z",
    };
    expect(JSON.parse(JSON.stringify(source))).toEqual(source);
  });

  it("Message survives JSON round-trip", () => {
    const message = {
      id: "msg-1",
      sourceId: "acc-1",
      channelId: "ch-1",
      channelName: "general",
      platform: "discord",
      platformMessageId: "pm-123",
      senderId: "user-1",
      senderName: "Alice",
      content: "Hello world",
      timestamp: "2026-01-15T08:00:00.000Z",
      rawData: null,
      createdAt: "2026-01-15T08:00:00.000Z",
    };
    expect(JSON.parse(JSON.stringify(message))).toEqual(message);
  });

  it("TrendingTopic survives JSON round-trip", () => {
    const topic = {
      id: "topic-1",
      taskId: "task-1",
      version: 2,
      batchId: "batch-1",
      rank: 1,
      topicName: "AI Trends",
      score: 85.5,
      summary: "Growing interest",
      taskName: "Daily",
      createdAt: "2026-01-15T00:00:00.000Z",
      updatedAt: "2026-01-15T00:00:00.000Z",
    };
    expect(JSON.parse(JSON.stringify(topic))).toEqual(topic);
  });

  it("Action survives JSON round-trip", () => {
    const action = {
      id: "action-1",
      name: "Notify",
      actionType: "discord_webhook",
      configuration: '{"url":"https://example.com"}',
      triggerConditions: null,
      isEnabled: true,
      lastTriggeredAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    expect(JSON.parse(JSON.stringify(action))).toEqual(action);
  });

  it("SystemSettingsSnapshot survives JSON round-trip", () => {
    const config = {
      analysisPaused: false,
      analysisBatchMessageLimit: "50",
      analysisMaxTotalChars: "10000",
      analysisMaxEstimatedInputTokens: "8000",
      analysisTraceVerbose: false,
      llmGenerationTimeout: "120",
      maxBatchRetries: "3",
      maxConcurrentBatches: "2",
      analysisStrategyMode: "incremental",
      analysisTriggerThreshold: "10",
      retentionMessagesDays: "30",
      retentionAnalysisDays: "30",
      retentionLeaderboardDays: "30",
      retentionAppLogsDays: "14",
      retentionUserEventsDays: "180",
      autoPauseOnRetriesExhausted: true,
      weatherLocation: "system",
      uiLocale: "zh-Hant",
      agentHistoryMaxMessages: "40",
      agentHistoryMaxChars: "48000",
      assistantDisplayName: "",
      assistantAvatar: "",
      userDisplayName: "",
      userAvatar: "",
      userBackground: "",
    };
    expect(JSON.parse(JSON.stringify(config))).toEqual(config);
  });
});
