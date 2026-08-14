import { expect, vi } from "vitest";
import { act } from "react";

export function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

export async function pickMenuSelectOption(testId: string, value: string): Promise<void> {
  const trigger = document.body.querySelector(
    `[data-testid="${testId}-value"]`,
  ) as HTMLButtonElement | null;
  expect(trigger).toBeTruthy();
  await act(async () => {
    trigger!.click();
  });
  const option = document.body.querySelector(
    `[data-testid="${testId}-option-${value}"]`,
  ) as HTMLButtonElement | null;
  expect(option).toBeTruthy();
  await act(async () => {
    option!.click();
  });
}
