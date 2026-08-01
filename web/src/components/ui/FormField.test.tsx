import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { FormField } from "./FormField";
import { TextField } from "./TextField";

describe("FormField", () => {
  it("renders children without error styling when error is absent", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(
          FormField,
          null,
          createElement(TextField, { "aria-label": "name" }),
        ),
      );
    });

    expect(container.querySelector("input[aria-label='name']")).not.toBeNull();
    expect(container.querySelector("[role='alert']")).toBeNull();
  });

  it("shows error message and applies border-error to child field", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(
          FormField,
          { error: "必填欄位" },
          createElement(TextField, { "aria-label": "email" }),
        ),
      );
    });

    const alert = container.querySelector("[role='alert']");
    expect(alert?.textContent).toBe("必填欄位");
    expect(container.querySelector("input[aria-label='email']")?.className).toContain(
      "border-error",
    );
  });
});
