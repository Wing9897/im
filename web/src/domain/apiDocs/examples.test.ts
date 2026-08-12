import {
  a2aAgentExample,
  calendarDeepLinkExamples,
  openClawMcpExample,
  webhookIngestExample,
} from "./examples";

describe("apiDocs examples", () => {
  const t = (key: string) => {
    const map: Record<string, string> = {
      "apiDocs.webhook.exampleContent": "Exchange XYZ suspended withdrawals",
      "apiDocs.webhook.exampleNotes": "For AI source context only",
      "apiDocs.liaison.exampleInput": "What's on tomorrow?",
      "apiDocs.liaison.exampleMessage": "Nothing tomorrow.",
      "apiDocs.liaison.exampleResponseComment": "One-shot response (example):",
      "apiDocs.deepLink.exampleTitle": "Team sync",
      "apiDocs.deepLink.exampleUrlComment": "Fetch remote ICS:",
      "apiDocs.deepLink.exampleInlineComment": "Inline event (no ICS):",
    };
    return map[key] ?? key;
  };

  it("localizes webhook demo content/notes while keeping protocol English", () => {
    const body = webhookIngestExample(t);
    expect(body).toContain("POST /api/v1/messages");
    expect(body).toContain('"content": "Exchange XYZ suspended withdrawals"');
    expect(body).toContain('"notes": "For AI source context only"');
    expect(body).not.toContain("某地交易所");
  });

  it("embeds the active UI locale in the A2A sample", () => {
    const body = a2aAgentExample(t, "en");
    expect(body).toContain('"locale": "en"');
    expect(body).toContain('"input": "What\'s on tomorrow?"');
    expect(body).toContain("One-shot response (example):");
    expect(body).toContain('"message": "Nothing tomorrow."');
  });

  it("keeps calendar deep-link scheme fixed and localizes demo title", () => {
    const body = calendarDeepLinkExamples(t);
    expect(body).toContain("intelligencemonitor://calendar/import?url=");
    expect(body).toContain("intelligencemonitor://calendar/import?title=Team%20sync");
    expect(body).toContain("start=2026-07-29T10%3A00%3A00Z");
    expect(body).toContain("worksetId=ws-1");
    expect(body).not.toContain("taskId=");
    expect(body).toContain("Fetch remote ICS:");
    expect(body).toContain("Inline event (no ICS):");
  });

  it("builds OpenClaw streamable-http MCP config with Bearer placeholder", () => {
    const body = openClawMcpExample("http://127.0.0.1:18820/api/v1/mcp");
    const parsed = JSON.parse(body) as {
      mcp: { servers: Record<string, { url: string; transport: string }> };
    };
    expect(parsed.mcp.servers["intelligence-monitor"]).toMatchObject({
      url: "http://127.0.0.1:18820/api/v1/mcp",
      transport: "streamable-http",
    });
    expect(body).toContain('"Authorization": "Bearer <access_key>"');
    expect(body).not.toContain("mcpServers");
  });
});

