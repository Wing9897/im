import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("tailwind motion reduced-motion guard", () => {
  it("disables animations when prefers-reduced-motion is reduce", () => {
    const css = readFileSync(resolve(__dirname, "css/motion-utilities.css"), "utf8");

    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toMatch(/\.im-animate-in[\s\S]*animation:\s*none\s*!important/);
    expect(css).toMatch(/\.im-enter-rise[\s\S]*animation:\s*none\s*!important/);
    expect(css).toMatch(/\.im-enter-rise-soft[\s\S]*animation:\s*none\s*!important/);
    expect(css).toMatch(/\.im-enter-glow[\s\S]*animation:\s*none\s*!important/);
    expect(css).toMatch(/\.im-toast-in[\s\S]*animation:\s*none\s*!important/);
    expect(css).not.toContain("::view-transition-old(root)");
    expect(css).toContain("@keyframes im-fade-in");
    expect(css).toContain("@keyframes im-enter-rise-soft");
    expect(css).toContain("@keyframes im-enter-glow");
    expect(css).toContain('[data-theme="sakura"] .im-enter-rise');
    expect(css).toContain('[data-theme="cyberpunk"] .im-enter-rise');
  });
});
