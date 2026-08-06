import { createElement } from "react";
import { vi } from "vitest";

/**
 * Shared vitest mock for emoji-picker-react.
 * Exposes 🍎 / 🥛 option buttons for click assertions.
 */
vi.mock("emoji-picker-react", () => {
  const Theme = { DARK: "dark", LIGHT: "light", AUTO: "auto" };
  const EmojiStyle = { NATIVE: "native" };
  function MockPicker(props: {
    onEmojiClick?: (data: { emoji: string }) => void;
    emojiStyle?: string;
  }) {
    return createElement(
      "div",
      {
        "data-testid": "emoji-picker-react-mock",
        "data-emoji-style": props.emojiStyle ?? "",
      },
      createElement(
        "button",
        {
          type: "button",
          "data-testid": "emoji-option-🍎",
          onClick: () => props.onEmojiClick?.({ emoji: "🍎" }),
        },
        "🍎",
      ),
      createElement(
        "button",
        {
          type: "button",
          "data-testid": "emoji-option-🥛",
          onClick: () => props.onEmojiClick?.({ emoji: "🥛" }),
        },
        "🥛",
      ),
    );
  }
  return {
    __esModule: true,
    default: MockPicker,
    Theme,
    EmojiStyle,
  };
});
