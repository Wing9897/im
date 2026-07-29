import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestHarness, type TestHarness } from "../../test/render-helpers";
import { AssistantWebSearchPanel } from "./AssistantWebSearchPanel";

describe("AssistantWebSearchPanel", () => {
  let harness: TestHarness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  afterEach(() => {
    harness.cleanup();
  });

  it("hides provider controls when disabled", async () => {
    await harness.render(AssistantWebSearchPanel, {
      enabled: false,
      provider: "duckduckgo",
      braveApiKey: "",
      onEnabledChange: vi.fn(),
      onProviderChange: vi.fn(),
      onBraveApiKeyChange: vi.fn(),
    });
    expect(harness.container.querySelector("#web-search-provider")).toBeNull();
  });

  it("shows Brave API key field when provider is brave", async () => {
    await harness.render(AssistantWebSearchPanel, {
      enabled: true,
      provider: "brave",
      braveApiKey: "",
      onEnabledChange: vi.fn(),
      onProviderChange: vi.fn(),
      onBraveApiKeyChange: vi.fn(),
    });
    expect(harness.container.querySelector("#brave-search-api-key")).toBeTruthy();
  });

  it("does not show Brave key for DuckDuckGo", async () => {
    await harness.render(AssistantWebSearchPanel, {
      enabled: true,
      provider: "duckduckgo",
      braveApiKey: "",
      onEnabledChange: vi.fn(),
      onProviderChange: vi.fn(),
      onBraveApiKeyChange: vi.fn(),
    });
    expect(harness.container.querySelector("#brave-search-api-key")).toBeNull();
    expect(harness.container.querySelector("#web-search-provider")).toBeTruthy();
  });
});
