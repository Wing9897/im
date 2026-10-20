type Listener = () => void;

const listeners = new Set<Listener>();

/** Channel pickers subscribe so closing `?source=new` refreshes their own hook instance. */
export function subscribeSourceDrawerClosed(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifySourceDrawerClosed(): void {
  for (const listener of listeners) listener();
}
