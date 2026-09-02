import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  buildTaskCommandPaletteItems,
  buildWorksetCommandPaletteItems,
  filterCommandPaletteItems,
  runCommandPaletteAction,
  type CommandPaletteItem,
} from "../domain/commandPalette/commandPaletteCommands";
import { useMonitorMode } from "../context/MonitorModeContext";
import { useSimpleMode } from "../context/SimpleModeContext";
import { useTaskCatalog } from "../context/TaskCatalogContext";
import { useAssistantQuick } from "./useAssistantQuick";

interface CommandPaletteContextValue {
  open: boolean;
  query: string;
  setQuery: (value: string) => void;
  filtered: CommandPaletteItem[];
  openPalette: () => void;
  closePalette: () => void;
  shortcutHelpOpen: boolean;
  closeShortcutHelp: () => void;
  runItem: (item: CommandPaletteItem) => void;
}

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const { monitorMode, setMonitorMode, openInPages } = useMonitorMode();
  const { simpleMode } = useSimpleMode();
  const { tasks, worksets } = useTaskCatalog();
  const { openCaption } = useAssistantQuick();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);

  const openPalette = useCallback(() => {
    setQuery("");
    setShortcutHelpOpen(false);
    setOpen(true);
  }, []);

  const closePalette = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  const closeShortcutHelp = useCallback(() => setShortcutHelpOpen(false), []);

  const extraItems = useMemo(
    () => [
      ...buildTaskCommandPaletteItems(tasks, i18n.t.bind(i18n)),
      ...buildWorksetCommandPaletteItems(worksets ?? [], i18n.t.bind(i18n)),
    ],
    [tasks, worksets, i18n],
  );

  const filtered = useMemo(
    () => filterCommandPaletteItems(query, extraItems, i18n.t.bind(i18n), simpleMode),
    [query, extraItems, i18n, simpleMode],
  );

  const runItem = useCallback(
    (item: CommandPaletteItem) => {
      closePalette();
      if (item.action === "show-shortcuts") {
        setShortcutHelpOpen(true);
        return;
      }
      if (item.action === "open-assistant-quick") {
        openCaption();
        return;
      }
      if (item.action === "open-board") {
        setMonitorMode("canvas");
        return;
      }
      if (item.action) {
        runCommandPaletteAction(item.action);
      }
      if (item.to) {
        // In canvas mode the pages router is hidden — openInPages switches mode
        // and navigates so the user lands on the visible pages shell.
        if (monitorMode === "canvas") {
          openInPages(item.to);
        } else {
          navigate(item.to);
        }
      }
    },
    [closePalette, monitorMode, navigate, openInPages, openCaption, setMonitorMode],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ((event.metaKey || event.ctrlKey) && key === "k") {
        event.preventDefault();
        setShortcutHelpOpen(false);
        setOpen((current) => {
          if (current) setQuery("");
          return !current;
        });
        return;
      }
      if (key === "escape" && open) {
        event.preventDefault();
        closePalette();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closePalette, open]);

  const value = useMemo(
    () => ({
      open,
      query,
      setQuery,
      filtered,
      openPalette,
      closePalette,
      shortcutHelpOpen,
      closeShortcutHelp,
      runItem,
    }),
    [
      open,
      query,
      filtered,
      openPalette,
      closePalette,
      shortcutHelpOpen,
      closeShortcutHelp,
      runItem,
    ],
  );

  return (
    <CommandPaletteContext.Provider value={value}>{children}</CommandPaletteContext.Provider>
  );
}

export function useCommandPalette(): CommandPaletteContextValue {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) {
    throw new Error("useCommandPalette must be used within CommandPaletteProvider");
  }
  return ctx;
}
