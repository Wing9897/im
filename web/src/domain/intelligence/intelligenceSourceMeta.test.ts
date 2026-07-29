import { describe, expect, it } from "vitest";
import { makeAnalysisEvent } from "../../test/analysisEventFixtures";
import {
  buildIntelligenceHitSource,
  buildIntelligenceSourceMeta,
  buildIntelligenceSourceMetaTitle,
} from "./intelligenceSourceMeta";

describe("intelligenceSourceMeta", () => {
  it("falls back to createdAt when sourceMessageTime is missing", () => {
    const item = makeAnalysisEvent({
      sourceMessageTime: null,
      sourcePlatform: "telegram",
      sourceChannelName: "Channel",
      createdAt: "2026-04-17T12:00:00.000Z",
    });
    expect(buildIntelligenceSourceMeta(item)).toContain("2026");
    expect(buildIntelligenceHitSource(item)).toContain("2026");
  });

  it("prefers sourceMessageTime when present", () => {
    const item = makeAnalysisEvent({
      sourceMessageTime: "2026-03-01T08:00:00.000Z",
      createdAt: "2026-04-17T12:00:00.000Z",
      sourcePlatform: "telegram",
      sourceChannelName: "Channel",
    });
    const meta = buildIntelligenceSourceMeta(item);
    expect(meta).not.toContain("2026-04-17");
    expect(meta).toContain("2026");
  });

  it("uses platformDisplayLabel for known platforms", () => {
    const item = makeAnalysisEvent({
      sourcePlatform: "discord",
      sourceChannelName: "Channel",
      createdAt: "2026-04-17T12:00:00.000Z",
    });
    expect(buildIntelligenceSourceMeta(item)).toContain("Discord");
    expect(buildIntelligenceHitSource(item)).toContain("Discord");
  });

  it("buildIntelligenceSourceMetaTitle reuses buildIntelligenceHitSource for hit line", () => {
    const item = makeAnalysisEvent({
      sourcePlatform: "telegram",
      sourceChannelName: "News",
      createdAt: "2026-04-17T12:00:00.000Z",
    });
    const title = buildIntelligenceSourceMetaTitle(item);
    expect(title).toContain(`命中來源: ${buildIntelligenceHitSource(item)}`);
  });
});
