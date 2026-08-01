/** Drain the microtask queue (Promise callbacks, queueMicrotask). */
export function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => {
    queueMicrotask(resolve);
  });
}

/** Drain macrotasks after microtasks (setTimeout(0)). */
export function flushPromises(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}
