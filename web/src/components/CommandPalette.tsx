import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { OverlayPortal } from "./common/OverlayPortal";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { useCommandPalette } from "../hooks/useCommandPalette";
import type { CommandPaletteItem } from "../domain/commandPalette/commandPaletteCommands";

function groupItems(items: CommandPaletteItem[]): Map<string, CommandPaletteItem[]> {
  const map = new Map<string, CommandPaletteItem[]>();
  for (const item of items) {
    const list = map.get(item.group) ?? [];
    list.push(item);
    map.set(item.group, list);
  }
  return map;
}

/** Global Cmd/Ctrl+K command palette — Hermes / Codex style quick navigation. */
export function CommandPalette() {
  const { t } = useTranslation("common");
  const { open, query, setQuery, filtered, closePalette, runItem } = useCommandPalette();
  const focusTrapRef = useFocusTrap({ active: open, onEscape: closePalette });
  const inputRef = useRef<HTMLInputElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  if (!open) return null;

  const grouped = groupItems(filtered);
  const flatItems = filtered;

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(flatItems.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter" && flatItems[activeIndex]) {
      event.preventDefault();
      runItem(flatItems[activeIndex]);
    }
  };

  let itemIndex = -1;

  return (
    <OverlayPortal onOverlayClick={closePalette} lockBodyScroll role="dialog" aria-label={t("commandPalette.aria")}>
      <div
        ref={focusTrapRef}
        className="im-command-palette im-animate-in-scale"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="im-command-palette-input-row">
          <Search size={16} className="shrink-0 text-text-muted" aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            className="im-command-palette-input"
            placeholder={t("commandPalette.searchPlaceholder")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onInputKeyDown}
            aria-label={t("commandPalette.searchAria")}
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="im-command-kbd">Esc</kbd>
        </div>
        <div className="im-command-palette-list im-auto-scrollbar">
          {flatItems.length === 0 ? (
            <p className="px-md py-lg text-center text-sm text-text-muted">{t("commandPalette.empty")}</p>
          ) : (
            [...grouped.entries()].map(([group, items]) => (
              <div key={group} className="im-command-palette-group">
                <div className="im-command-palette-group-label">{group}</div>
                {items.map((item) => {
                  itemIndex += 1;
                  const idx = itemIndex;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`im-command-palette-item${idx === activeIndex ? " is-active" : ""}`}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => runItem(item)}
                    >
                      <Icon size={16} strokeWidth={2} aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
                      {item.hint ? (
                        <span className="truncate text-xs text-text-muted">{item.hint}</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
        <div className="im-command-palette-footer">
          <span className="text-[11px] text-text-muted">{t("commandPalette.hintSelect")}</span>
          <span className="text-[11px] text-text-muted">{t("commandPalette.hintOpen")}</span>
          <span className="ml-auto text-[11px] text-text-muted">
            <kbd className="im-command-kbd">⌘K</kbd>
          </span>
        </div>
      </div>
    </OverlayPortal>
  );
}
