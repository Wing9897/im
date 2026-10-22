import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SubscriptionCalendarCard } from "./SubscriptionCalendarCard";

describe("SubscriptionCalendarCard", () => {
  it("renders publisher avatar, cover strip, path title, and description", () => {
    const html = renderToStaticMarkup(
      createElement(SubscriptionCalendarCard, {
        title: "DemoPub/Open",
        ownerLabel: "DemoPub",
        ownerAvatar: "data:image/png;base64,avatar",
        cover: "data:image/jpeg;base64,cover",
        description: "Open to everyone",
        "data-testid": "subscription-card-demo",
      }),
    );
    expect(html).toContain('data-testid="subscription-card-cover"');
    expect(html).toContain('data-testid="subscription-card-cover-preview"');
    expect(html).toContain('data-testid="subscription-card-avatar"');
    expect(html).toContain('data-custom-src="true"');
    expect(html).toContain("DemoPub/Open");
    expect(html).toContain("Open to everyone");
    expect(html).not.toContain("subscription-card-emoji");
  });

  it("uses placeholder cover when cover is empty", () => {
    const html = renderToStaticMarkup(
      createElement(SubscriptionCalendarCard, {
        title: "Alice/Work",
        ownerLabel: "Alice",
        description: "",
      }),
    );
    expect(html).toContain('data-testid="subscription-card-cover-preview"');
    expect(html).toContain("data:image/svg+xml");
    expect(html).toContain('data-testid="subscription-card-avatar-initials"');
  });
});
