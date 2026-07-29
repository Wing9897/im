/** Resolve after `ms` milliseconds (browser timer). */
export function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
