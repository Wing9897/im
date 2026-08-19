import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const layoutCss = readFileSync(resolve(here, "../../css/shared-layout.css"), "utf8");
const feedCss = readFileSync(resolve(here, "../../css/monitor-feed.css"), "utf8");

describe("monitor list contrast contract", () => {
  it("brightens list-row meta tokens without changing global --text-muted", () => {
    expect(layoutCss).toMatch(
      /\.im-monitor-list-item\s*\{[^}]*--text-muted:\s*color-mix\(in srgb, var\(--text-primary\) 70%/s,
    );
    expect(layoutCss).toMatch(
      /\.im-monitor-list-item\s*\{[^}]*--text-secondary:\s*color-mix\(in srgb, var\(--text-primary\) 82%/s,
    );
    expect(layoutCss).not.toMatch(/html\s*\{[^}]*--text-muted:\s*color-mix\(in srgb, var\(--text-primary\) 70%/s);
  });

  it("uses a denser row fill over photo BG and keeps hover/selected on the same surface", () => {
    expect(layoutCss).toMatch(
      /\.im-monitor-list-item\s*\{[^}]*background:\s*color-mix\(in srgb, var\(--surface-card\) 48%/s,
    );
    expect(layoutCss).toMatch(
      /html\[data-theme-bg="custom"\] \.im-monitor-list-item,\s*html\[data-theme-bg="focal"\] \.im-monitor-list-item\s*\{[^}]*--surface-card\) 82%/s,
    );
    expect(layoutCss).toMatch(
      /html\[data-theme-bg="custom"\] \.im-monitor-stream-list,\s*html\[data-theme-bg="focal"\] \.im-monitor-stream-list\s*\{[^}]*--surface-card\) 42%/s,
    );
    expect(layoutCss).toMatch(/\.im-monitor-list-item\.is-selected\s*\{[^}]*var\(--surface-card\)/s);
  });

  it("keeps source/body hooks on the remapped secondary token", () => {
    expect(feedCss).toMatch(/\.im-monitor-list-source\s*\{[^}]*var\(--text-secondary\)/s);
    expect(feedCss).toMatch(/\.im-monitor-list-body\s*\{[^}]*var\(--text-secondary\)/s);
    expect(feedCss).toMatch(/\.im-monitor-list-body\.is-unread\s*\{[^}]*var\(--text-primary\)/s);
    expect(feedCss).toMatch(/\.im-monitor-stream-status\s*\{[^}]*var\(--text-secondary\)/s);
  });
});
