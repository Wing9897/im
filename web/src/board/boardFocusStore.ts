export interface BoardFocusTarget {
  eventId: string;
  lat?: number;
  lon?: number;
  /** Human-readable context for in-board event selection. */
  title?: string;
  body?: string | null;
  location?: string | null;
  at: number;
}

type Listener = () => void;

let current: BoardFocusTarget | null = null;
const listeners = new Set<Listener>();

export function focusBoardEvent(target: Omit<BoardFocusTarget, "at">): void {
  current = { ...target, at: Date.now() };
  listeners.forEach((listener) => listener());
}

export function getBoardFocusTarget(): BoardFocusTarget | null {
  return current;
}

export function subscribeBoardFocus(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
