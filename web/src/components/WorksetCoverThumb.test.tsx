import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WorksetCoverThumb } from "./WorksetCoverThumb";

describe("WorksetCoverThumb", () => {
  it("renders the default placeholder when cover is empty", () => {
    const html = renderToStaticMarkup(
      createElement(WorksetCoverThumb, { name: "Ops", testId: "ws-cover" }),
    );
    expect(html).toContain('data-testid="ws-cover"');
    expect(html).toContain("data:image/svg+xml");
    expect(html).toContain('title="Ops"');
  });

  it("uses a custom cover src when provided", () => {
    const html = renderToStaticMarkup(
      createElement(WorksetCoverThumb, {
        name: "Ops",
        cover: "data:image/jpeg;base64,abc",
      }),
    );
    expect(html).toContain("data:image/jpeg;base64,abc");
  });
});
