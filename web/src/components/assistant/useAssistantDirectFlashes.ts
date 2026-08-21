import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { AssistantSessionMessage } from "../../domain/assistant/assistantSessions";
import {
  latestOfRole,
  messagesAfterDirectBaseline,
} from "./assistantDirectBubbleSelectors";
import {
  AGENT_HIDE_MS,
  FADE_MS,
  READY_HINT_MS,
  USER_HIDE_MS,
  clearTimeoutHandle,
  scheduleFlashLifecycle,
  type TimedFlash,
} from "./assistantDirectBubbleTimers";

interface UseAssistantDirectFlashesOptions {
  messages: readonly AssistantSessionMessage[];
  /** Live STT / draft text (partial + final before send clears it). */
  draft: string;
  sending: boolean;
  listening: boolean;
  /** Space held before STT `listening` flips true — show feedback immediately. */
  holdArmed: boolean;
  showReadyHint: boolean;
  onReadyHintConsumed?: () => void;
}

interface UseAssistantDirectFlashesResult {
  /** Listening or armed — the mic lane and the live draft both key off this. */
  isListening: boolean;
  draftText: string;
  micFlash: boolean;
  micFading: boolean;
  userFlash: TimedFlash | null;
  /** Sending placeholder (`key === "sending"`) or a faded reply. */
  agentFlash: TimedFlash | null;
  readyVisible: boolean;
  readyFading: boolean;
  /** Latest assistant message of the current turn — carries the tool summary. */
  latestAssistant: AssistantSessionMessage | null;
  /** True when any lane has something to show. */
  showFlashes: boolean;
}

/**
 * Caption flash state machine for the current turn only.
 *
 * Until the user listens or sends once, message history is ignored (F5 /
 * always-on must show the ready hint — never replay the last session turn).
 * Each new listen re-freezes current ids so only this turn's user → sending →
 * reply may flash. AGENT_HIDE_MS starts only after a reply exists.
 */
export function useAssistantDirectFlashes({
  messages,
  draft,
  sending,
  listening,
  holdArmed,
  showReadyHint,
  onReadyHintConsumed,
}: UseAssistantDirectFlashesOptions): UseAssistantDirectFlashesResult {
  const isListening = listening || holdArmed;
  const draftText = draft.trim();

  /**
   * Gate: until first listen/send, keep freezing whatever is already in
   * `messages` (covers F5 hydrate). After arm, only newer ids may flash.
   */
  const [turnArmed, setTurnArmed] = useState(false);
  const [frozenIds, setFrozenIds] = useState<ReadonlySet<string>>(
    () => new Set(messages.map((m) => m.id)),
  );

  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const listenEdgeRef = useRef(false);

  useLayoutEffect(() => {
    if (turnArmed) return;
    setFrozenIds(new Set(messages.map((m) => m.id)));
  }, [messages, turnArmed]);

  useLayoutEffect(() => {
    if (!isListening) {
      listenEdgeRef.current = false;
      return;
    }
    if (!listenEdgeRef.current) {
      setFrozenIds(new Set(messagesRef.current.map((m) => m.id)));
      setTurnArmed(true);
    }
    listenEdgeRef.current = true;
  }, [isListening]);

  useEffect(() => {
    if (!isListening && !sending) return;
    setTurnArmed(true);
  }, [isListening, sending]);

  const viewMessages = useMemo(
    () => (turnArmed ? messagesAfterDirectBaseline(messages, frozenIds) : []),
    [frozenIds, messages, turnArmed],
  );
  const latestUser = useMemo(() => latestOfRole(viewMessages, "user"), [viewMessages]);
  const latestAssistant = useMemo(
    () => latestOfRole(viewMessages, "assistant"),
    [viewMessages],
  );

  const [micFlash, setMicFlash] = useState(isListening);
  const [micFading, setMicFading] = useState(false);
  const [userFlash, setUserFlash] = useState<TimedFlash | null>(null);
  const [agentFlash, setAgentFlash] = useState<TimedFlash | null>(null);
  const [readyVisible, setReadyVisible] = useState(false);
  const [readyFading, setReadyFading] = useState(false);

  const wasListeningRef = useRef(isListening);
  const latestUserRef = useRef(latestUser);
  latestUserRef.current = latestUser;
  const userHideTimerRef = useRef<number | null>(null);
  const userFadeTimerRef = useRef<number | null>(null);
  const agentHideTimerRef = useRef<number | null>(null);
  const agentFadeTimerRef = useRef<number | null>(null);
  const micFadeTimerRef = useRef<number | null>(null);
  const readyHideTimerRef = useRef<number | null>(null);
  const readyFadeTimerRef = useRef<number | null>(null);
  const readyHintConsumedRef = useRef(false);
  const onReadyHintConsumedRef = useRef(onReadyHintConsumed);
  onReadyHintConsumedRef.current = onReadyHintConsumed;

  const clearUserTimers = () => {
    userHideTimerRef.current = clearTimeoutHandle(userHideTimerRef.current);
    userFadeTimerRef.current = clearTimeoutHandle(userFadeTimerRef.current);
  };

  const clearAgentTimers = () => {
    agentHideTimerRef.current = clearTimeoutHandle(agentHideTimerRef.current);
    agentFadeTimerRef.current = clearTimeoutHandle(agentFadeTimerRef.current);
  };

  const clearMicTimers = () => {
    micFadeTimerRef.current = clearTimeoutHandle(micFadeTimerRef.current);
  };

  const clearReadyTimers = () => {
    readyHideTimerRef.current = clearTimeoutHandle(readyHideTimerRef.current);
    readyFadeTimerRef.current = clearTimeoutHandle(readyFadeTimerRef.current);
  };

  const consumeReadyHint = () => {
    if (readyHintConsumedRef.current) return;
    readyHintConsumedRef.current = true;
    onReadyHintConsumedRef.current?.();
  };

  const armUserFlashRef = useRef(
    (_key: string, _text: string, _hideMs?: number) => undefined as void,
  );
  armUserFlashRef.current = (key, text, hideMs = USER_HIDE_MS) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    clearUserTimers();
    setUserFlash({ key, text: trimmed, fading: false });
    userHideTimerRef.current = scheduleFlashLifecycle({
      key,
      hideMs,
      onFadeStart: (flashKey) => {
        setUserFlash((prev) =>
          prev && prev.key === flashKey ? { ...prev, fading: true } : prev,
        );
      },
      onClear: (flashKey) => {
        setUserFlash((prev) => (prev && prev.key === flashKey ? null : prev));
      },
      onFadeTimer: (id) => {
        userFadeTimerRef.current = id;
      },
    });
  };

  const armAgentReplyFlashRef = useRef((_key: string, _text: string) => undefined as void);
  armAgentReplyFlashRef.current = (key, text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    clearAgentTimers();
    setAgentFlash({ key, text: trimmed, fading: false });
    agentHideTimerRef.current = scheduleFlashLifecycle({
      key,
      hideMs: AGENT_HIDE_MS,
      onFadeStart: (flashKey) => {
        setAgentFlash((prev) =>
          prev && prev.key === flashKey ? { ...prev, fading: true } : prev,
        );
      },
      onClear: (flashKey) => {
        setAgentFlash((prev) => (prev && prev.key === flashKey ? null : prev));
      },
      onFadeTimer: (id) => {
        agentFadeTimerRef.current = id;
      },
    });
  };

  // Mic flash: always on during STT; fade mic chrome on release (transcript stays).
  useEffect(() => {
    if (isListening) {
      clearMicTimers();
      wasListeningRef.current = true;
      setMicFlash(true);
      setMicFading(false);
      // New hold must not stack under a lingering prior user bar, and must not
      // reuse last session’s draft snapshot as “live” text.
      clearUserTimers();
      setUserFlash(null);
      setReadyVisible(false);
      clearReadyTimers();
      setReadyFading(false);
      consumeReadyHint();
      return clearMicTimers;
    }

    if (wasListeningRef.current) {
      wasListeningRef.current = false;
      clearMicTimers();
      setMicFlash(true);
      setMicFading(true);
      // Only flash committed user turns here. Draft-only release flashes duplicated
      // the composer/live STT bar (the “second flashing bar”).
      const committed = latestUserRef.current?.content?.trim();
      if (committed && latestUserRef.current?.id) {
        armUserFlashRef.current(latestUserRef.current.id, committed, USER_HIDE_MS);
      }
      micFadeTimerRef.current = window.setTimeout(() => {
        setMicFlash(false);
        setMicFading(false);
      }, FADE_MS);
      return clearMicTimers;
    }

    return clearMicTimers;
  }, [isListening]);

  const userFlashRef = useRef(userFlash);
  userFlashRef.current = userFlash;

  // When user message lands after release (send path), refresh user flash text/key.
  // Do not depend on userFlash itself — clearing the fade would re-arm forever.
  useEffect(() => {
    if (isListening) return;
    if (!latestUser?.content?.trim()) return;
    const shown = userFlashRef.current;
    if (shown?.key === latestUser.id && shown.text === latestUser.content) return;
    armUserFlashRef.current(latestUser.id, latestUser.content);
  }, [isListening, latestUser?.content, latestUser?.id]);

  // Agent lane: sending indicator vs reply — independent of user flash.
  // Hide / pause agent flash while the user is speaking.
  // AGENT_HIDE_MS starts only once a reply exists — never while sending / waiting.
  useEffect(() => {
    if (isListening) {
      clearAgentTimers();
      setAgentFlash(null);
      return clearAgentTimers;
    }
    if (sending) {
      clearAgentTimers();
      setAgentFlash({ key: "sending", text: "", fading: false });
      return clearAgentTimers;
    }
    if (latestAssistant?.content?.trim()) {
      armAgentReplyFlashRef.current(latestAssistant.id, latestAssistant.content);
      return clearAgentTimers;
    }
    // Soft failures roll back the assistant turn — clear a stuck "sending" flash.
    clearAgentTimers();
    setAgentFlash(null);
    return clearAgentTimers;
  }, [isListening, latestAssistant?.content, latestAssistant?.id, sending]);

  // Ready hint when idle in caption mode — one-shot latch (no re-arm after fade / hold).
  useEffect(() => {
    clearReadyTimers();
    const idle =
      showReadyHint &&
      !readyHintConsumedRef.current &&
      !isListening &&
      !micFlash &&
      !userFlash &&
      !agentFlash &&
      !sending;
    if (!idle) {
      setReadyVisible(false);
      setReadyFading(false);
      return clearReadyTimers;
    }
    setReadyVisible(true);
    setReadyFading(false);
    readyHideTimerRef.current = window.setTimeout(() => {
      setReadyFading(true);
      readyFadeTimerRef.current = window.setTimeout(() => {
        setReadyVisible(false);
        setReadyFading(false);
        readyHintConsumedRef.current = true;
        onReadyHintConsumedRef.current?.();
      }, FADE_MS);
    }, READY_HINT_MS);
    return clearReadyTimers;
  }, [agentFlash, isListening, micFlash, sending, showReadyHint, userFlash]);

  useEffect(
    () => () => {
      clearUserTimers();
      clearAgentTimers();
      clearMicTimers();
      clearReadyTimers();
    },
    [],
  );

  const showFlashes =
    micFlash ||
    Boolean(userFlash) ||
    Boolean(agentFlash) ||
    readyVisible ||
    (isListening && Boolean(draftText));

  return {
    isListening,
    draftText,
    micFlash,
    micFading,
    userFlash,
    agentFlash,
    readyVisible,
    readyFading,
    latestAssistant,
    showFlashes,
  };
}
