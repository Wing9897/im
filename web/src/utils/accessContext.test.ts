import { describe, it, expect } from "vitest";
import { detectAccessContext } from "./accessContext";

describe("detectAccessContext", () => {
  it('returns "local" for localhost', () => {
    expect(detectAccessContext("localhost")).toBe("local");
  });

  it('returns "local" for 127.0.0.1', () => {
    expect(detectAccessContext("127.0.0.1")).toBe("local");
  });

  it('returns "local" for ::1 (IPv6 loopback)', () => {
    expect(detectAccessContext("::1")).toBe("local");
  });

  it('returns "remote" for a LAN IP address', () => {
    expect(detectAccessContext("192.168.1.100")).toBe("remote");
  });

  it('returns "remote" for a public domain', () => {
    expect(detectAccessContext("example.com")).toBe("remote");
  });

  it('returns "remote" for an empty string', () => {
    expect(detectAccessContext("")).toBe("remote");
  });

  it('returns "remote" for a non-standard loopback-like hostname', () => {
    expect(detectAccessContext("localhost.localdomain")).toBe("remote");
  });

  it("defaults to window.location.hostname when no argument is provided", () => {
    // jsdom defaults to "localhost"
    expect(detectAccessContext()).toBe("local");
  });
});

describe("detectAccessContext — exhaustive loopback rule", () => {
  const LOOPBACK_HOSTNAMES = ["localhost", "127.0.0.1", "::1"] as const;

  it.each(LOOPBACK_HOSTNAMES)("returns local for loopback hostname: %s", (hostname) => {
    expect(detectAccessContext(hostname)).toBe("local");
  });

  it.each([
    "192.168.1.100",
    "example.com",
    "",
    "localhost.localdomain",
    "127.0.0.2",
    "not-localhost",
    "0.0.0.0",
  ])("returns remote for non-loopback hostname: %s", (hostname) => {
    expect(detectAccessContext(hostname)).toBe("remote");
  });
});
