import { act, createElement, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { useSlashFocusSearch } from "./useSlashFocusSearch";

function Harness() {
  useSlashFocusSearch();
  useEffect(() => {
    const input = document.createElement("input");
    input.setAttribute("data-im-search", "");
    document.body.appendChild(input);
    return () => {
      input.remove();
    };
  }, []);
  return null;
}

describe("useSlashFocusSearch", () => {
  afterEach(() => {
    document.body.querySelectorAll("[data-im-search]").forEach((node) => node.remove());
  });

  it("focuses data-im-search input when / is pressed", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    act(() => {
      createRoot(host).render(createElement(Harness));
    });

    const input = document.querySelector<HTMLInputElement>("input[data-im-search]")!;
    expect(input).toBeTruthy();

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "/", bubbles: true }));
    });

    expect(document.activeElement).toBe(input);
    host.remove();
  });
});
