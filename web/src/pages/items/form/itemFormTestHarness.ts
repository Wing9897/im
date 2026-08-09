import { act, createElement, createRef } from "react";
import type { Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { expect, vi } from "vitest";

import type { TrackableItem } from "../../../api/items";
import { makeItemFormPassportItem, makeTrackableItem } from "../../../test/fixtures/trackableItem";
import { ItemForm, type ItemFormHandle } from "./ItemForm";
import {
  ITEM_FORM_TEST_CATEGORIES,
  ITEM_FORM_TEST_WORKSETS,
} from "./itemFormTestFixtures";
import {
  createUserEvent,
  listItems,
  listTasks,
  listUserEvents,
  showToast,
  updateUserEvent,
} from "./itemFormTestMocks";

export { makeItemFormPassportItem as makeItem, makeTrackableItem };
export { ITEM_FORM_TEST_CATEGORIES as CATEGORIES, ITEM_FORM_TEST_WORKSETS as WORKSETS };
export {
  createUserEvent,
  deleteUserEvent,
  deleteTask,
  listItems,
  listTasks,
  listUserEvents,
  showToast,
  updateUserEvent,
} from "./itemFormTestMocks";

export function resetItemFormTestMocks(): void {
  showToast.mockReset();
  listUserEvents.mockReset();
  listUserEvents.mockResolvedValue([]);
  listTasks.mockReset();
  listTasks.mockResolvedValue([]);
  updateUserEvent.mockReset();
  updateUserEvent.mockResolvedValue({});
  createUserEvent.mockReset();
  createUserEvent.mockResolvedValue({});
  listItems.mockReset();
  listItems.mockResolvedValue([
    makeTrackableItem({
      id: "item-42",
      title: "Passport",
      categoryId: null,
    }),
  ]);
}

export function createItemFormRenderer(root: Root) {
  return async function renderForm(opts?: {
    item?: TrackableItem | null;
    initialCategoryId?: string | null;
    worksets?: typeof ITEM_FORM_TEST_WORKSETS;
    onSave?: (draft: unknown) => Promise<void>;
  }) {
    const onSave = opts?.onSave ?? vi.fn(async () => undefined);
    const formRef = createRef<ItemFormHandle>();
    await act(async () => {
      root.render(
        createElement(
          MemoryRouter,
          null,
          createElement(ItemForm, {
            ref: formRef,
            item: opts?.item === undefined ? makeItemFormPassportItem() : opts.item,
            categories: ITEM_FORM_TEST_CATEGORIES,
            worksets: opts?.worksets ?? ITEM_FORM_TEST_WORKSETS,
            categoryLabel: (category) => category?.name ?? "none",
            initialCategoryId: opts?.initialCategoryId ?? null,
            onSave,
          }),
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    return { onSave, formRef };
  };
}

export function categorySelectTrigger(): HTMLButtonElement {
  const el = document.querySelector(
    '[data-testid="item-form-category-select-value"]',
  ) as HTMLButtonElement | null;
  expect(el).toBeTruthy();
  return el!;
}

export async function pickCategory(categoryId: string): Promise<void> {
  const trigger = categorySelectTrigger();
  await act(async () => {
    trigger.click();
  });
  const option = document.querySelector(
    `[data-testid="item-form-category-select-option-${categoryId}"]`,
  ) as HTMLButtonElement | null;
  expect(option).toBeTruthy();
  await act(async () => {
    option!.click();
  });
}


export function cleanupItemFormDialogs(): void {
  document.querySelectorAll('[role="dialog"]').forEach((node) => node.remove());
}

export async function commitItemTitle(value: string): Promise<void> {
  const editBtn = document.querySelector(
    '[data-testid="item-form-cv-title-edit"]',
  ) as HTMLButtonElement;
  await act(async () => {
    editBtn.click();
  });

  const title = document.getElementById("item-title") as HTMLInputElement;
  expect(title).toBeTruthy();

  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )?.set;
    setter?.call(title, value);
    title.dispatchEvent(new Event("input", { bubbles: true }));
    title.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
    );
  });
}

export async function flushDeferredEmojiGrid(): Promise<void> {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    if (document.querySelector('[data-testid="emoji-option-🍎"]')) return;
    await act(async () => {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
    });
  }
  throw new Error("emoji picker grid did not mount");
}

export async function waitForEmojiDialogDismiss(): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (!document.querySelector('[data-testid="emoji-picker-field-dialog"]')) return;
    await act(async () => {
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 20);
      });
    });
  }
  throw new Error("emoji picker dialog did not dismiss");
}
