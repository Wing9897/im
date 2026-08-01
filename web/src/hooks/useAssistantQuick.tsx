import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "react-router-dom";
import { isEditableTarget } from "../utils/isEditableTarget";

/** Chrome-facing actions registered by the single `useAssistantChat` host. */
export type AssistantCaptionChatActions = {
  speaking: boolean;
  canClear: boolean;
  /** Runtime STT port available (false on Electron / unsupported browsers). */
  sttAvailable: boolean;
  clearChat: () => void;
  stopSpeaking: () => void;
};

interface AssistantQuickContextValue {
  /**
   * Global voice session armed (default on). False only on `/assistant`
   * where the full page owns chat.
   */
  captionActive: boolean;
  /** Translucent text composer (stays open for typing; Space PTT still works when unfocused). */
  composerOpen: boolean;
  /** True while focus is in an editable field (voice PTT paused). */
  editableFocused: boolean;
  /** Space PTT may run: armed and not typing in an editable field. Mic works regardless of this flag. */
  voiceLive: boolean;
  /** True while Space/mic is capturing (for trigger chrome). */
  captionListening: boolean;
  openCaption: () => void;
  closeCaption: () => void;
  openComposer: () => void;
  closeComposer: () => void;
  toggleComposer: () => void;
  setCaptionListening: (listening: boolean) => void;
  /** Live chat actions from the caption host (null until host mounts). */
  chatActions: AssistantCaptionChatActions | null;
  registerChatActions: (actions: AssistantCaptionChatActions | null) => void;
}

const AssistantQuickContext = createContext<AssistantQuickContextValue | null>(null);

function isAssistantPage(pathname: string): boolean {
  return pathname === "/assistant";
}

/** Global caption assistant (title-bar) — separate from the full `/assistant` page. */
export function AssistantQuickProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const onAssistantPage = isAssistantPage(location.pathname);
  const [captionActive, setCaptionActive] = useState(() => !onAssistantPage);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editableFocused, setEditableFocused] = useState(false);
  const [captionListening, setCaptionListeningState] = useState(false);
  const [chatActions, setChatActions] = useState<AssistantCaptionChatActions | null>(null);

  const setCaptionListening = useCallback((listening: boolean) => {
    setCaptionListeningState(listening);
  }, []);

  const registerChatActions = useCallback((actions: AssistantCaptionChatActions | null) => {
    setChatActions(actions);
  }, []);

  const openCaption = useCallback(() => {
    setCaptionActive(true);
  }, []);
  const closeCaption = useCallback(() => {
    setCaptionActive(false);
    setComposerOpen(false);
    setCaptionListeningState(false);
  }, []);
  const openComposer = useCallback(() => {
    setComposerOpen(true);
  }, []);
  const closeComposer = useCallback(() => {
    setComposerOpen(false);
    // Eagerly clear — activeElement may still be the composer until unmount.
    setEditableFocused(false);
    requestAnimationFrame(() => {
      setEditableFocused(isEditableTarget(document.activeElement));
    });
  }, []);
  const toggleComposer = useCallback(() => {
    setComposerOpen((open) => {
      if (open) {
        setEditableFocused(false);
        requestAnimationFrame(() => {
          setEditableFocused(isEditableTarget(document.activeElement));
        });
        return false;
      }
      return true;
    });
  }, []);

  // Composer may stay open for typing; only an editable focus pauses Space PTT.
  const voiceLive = captionActive && !editableFocused;

  // Pause voice whenever focus enters a text field; resume when it leaves.
  useEffect(() => {
    const syncEditable = () => {
      setEditableFocused(isEditableTarget(document.activeElement));
    };
    const onFocusIn = (event: FocusEvent) => {
      if (isEditableTarget(event.target)) setEditableFocused(true);
    };
    const onFocusOut = () => {
      // Defer so the next focus target (if any) is already active.
      requestAnimationFrame(syncEditable);
    };
    syncEditable();
    window.addEventListener("focusin", onFocusIn);
    window.addEventListener("focusout", onFocusOut);
    return () => {
      window.removeEventListener("focusin", onFocusIn);
      window.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ((event.metaKey || event.ctrlKey) && key === "j") {
        event.preventDefault();
        if (onAssistantPage) return;
        toggleComposer();
        return;
      }
      if (key === "escape" && composerOpen) {
        event.preventDefault();
        closeComposer();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeComposer, composerOpen, onAssistantPage, toggleComposer]);

  // Full assistant page owns chat; restore global voice when leaving it.
  useEffect(() => {
    if (onAssistantPage) {
      closeCaption();
    } else {
      openCaption();
    }
  }, [closeCaption, onAssistantPage, openCaption]);

  useEffect(() => {
    if (!captionActive) setCaptionListeningState(false);
  }, [captionActive]);

  // Do not clear captionListening on !voiceLive: mic PTT may still be
  // capturing while the draft is focused (Space is paused; mic is not).

  const value = useMemo(
    () => ({
      captionActive,
      composerOpen,
      editableFocused,
      voiceLive,
      captionListening,
      openCaption,
      closeCaption,
      openComposer,
      closeComposer,
      toggleComposer,
      setCaptionListening,
      chatActions,
      registerChatActions,
    }),
    [
      captionActive,
      composerOpen,
      editableFocused,
      voiceLive,
      captionListening,
      openCaption,
      closeCaption,
      openComposer,
      closeComposer,
      toggleComposer,
      setCaptionListening,
      chatActions,
      registerChatActions,
    ],
  );

  return (
    <AssistantQuickContext.Provider value={value}>{children}</AssistantQuickContext.Provider>
  );
}

export function useAssistantQuick(): AssistantQuickContextValue {
  const ctx = useContext(AssistantQuickContext);
  if (!ctx) {
    throw new Error("useAssistantQuick must be used within AssistantQuickProvider");
  }
  return ctx;
}
