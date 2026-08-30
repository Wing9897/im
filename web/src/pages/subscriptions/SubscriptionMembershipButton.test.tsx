import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";

import { ensureZhHantLocale, wrapWithI18n } from "../../test/i18nHarness";
import { SubscriptionMembershipButton } from "./SubscriptionMembershipButton";

describe("SubscriptionMembershipButton", () => {
  beforeAll(async () => {
    await ensureZhHantLocale();
  });

  it("renders subscribe as secondary icon+text button with aria-label", () => {
    const html = renderToStaticMarkup(
      wrapWithI18n(
        createElement(SubscriptionMembershipButton, {
          subscribed: false,
          canMutate: true,
          busy: false,
          actionsLocked: false,
          identityKey: "Alice/Work",
          onSubscribe: () => {},
          onUnsubscribe: () => {},
        }),
      ),
    );
    expect(html).toContain('data-testid="subscriptions-add-Alice/Work"');
    expect(html).toContain('aria-label="訂閱"');
    expect(html).toContain('title="訂閱"');
    expect(html).toContain(">訂閱<");
  });

  it("renders unsubscribe as secondary icon+text button with aria-label", () => {
    const html = renderToStaticMarkup(
      wrapWithI18n(
        createElement(SubscriptionMembershipButton, {
          subscribed: true,
          canMutate: true,
          busy: false,
          actionsLocked: false,
          identityKey: "DemoPub/Open",
          onSubscribe: () => {},
          onUnsubscribe: () => {},
        }),
      ),
    );
    expect(html).toContain('data-testid="subscriptions-unsubscribe-DemoPub/Open"');
    expect(html).toContain('aria-label="移除"');
    expect(html).toContain('title="移除"');
    expect(html).toContain(">移除<");
  });
});
