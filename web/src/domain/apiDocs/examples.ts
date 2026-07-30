/** Shared HTTP examples for Settings → API (localizable demo strings via i18n). */

type Translate = (key: string) => string;

/** Webhook ingest sample; protocol/IDs stay fixed, demo `content` / `notes` follow UI locale. */
export function webhookIngestExample(t: Translate): string {
  const content = JSON.stringify(t("apiDocs.webhook.exampleContent"));
  const notes = JSON.stringify(t("apiDocs.webhook.exampleNotes"));
  return `POST /api/v1/messages
Authorization: Bearer <access_key>
Content-Type: application/json

{
  "account_id": "acct_api_1",
  "channel_id": "chan_api_1",
  "platform": "api",
  "platform_message_id": "msg_123",
  "content": ${content},
  "timestamp": "2026-05-05T12:00:00Z",
  "metadata": {
    "platform": "telegram",
    "group": "Whale Alert Asia",
    "channel": "Alpha News",
    "person": "Trader K",
    "location": "Dubai",
    "tags": ["exchange", "risk"],
    "notes": ${notes}
  }
}`;
}

/**
 * A2A agent sample. `locale` mirrors the active UI locale so the pasted
 * request matches what the server expects for output language.
 */
export function a2aAgentExample(t: Translate, locale: string): string {
  const input = JSON.stringify(t("apiDocs.liaison.exampleInput"));
  const message = JSON.stringify(t("apiDocs.liaison.exampleMessage"));
  const responseComment = t("apiDocs.liaison.exampleResponseComment");
  const localeJson = JSON.stringify(locale);
  return `POST /api/v1/a2a/agent
Authorization: Bearer <access_key>
Content-Type: application/json

{
  "input": ${input},
  "locale": ${localeJson}
}

# ${responseComment}
# {
#   "message": ${message},
#   "sessionId": null,
#   "toolCalls": [
#     { "name": "calendar.upcoming", "resultSummary": "…" },
#     { "name": "calendar.create_event", "resultSummary": "…" }
#   ]
# }`;
}

/**
 * Desktop calendar deep-link samples (protocol URLs — not HTTP).
 * Demo title follows UI locale; scheme/path/query keys stay fixed English.
 */
export function calendarDeepLinkExamples(t: Translate): string {
  const title = encodeURIComponent(t("apiDocs.deepLink.exampleTitle"));
  const urlComment = t("apiDocs.deepLink.exampleUrlComment");
  const inlineComment = t("apiDocs.deepLink.exampleInlineComment");
  return `# ${urlComment}
intelligencemonitor://calendar/import?url=https%3A%2F%2Fexample.com%2Fmeet.ics

# ${inlineComment}
intelligencemonitor://calendar/import?title=${title}&start=2026-07-29T10%3A00%3A00Z&end=2026-07-29T11%3A00%3A00Z&location=A&body=Hi&worksetId=ws-1`;
}
