/** Turns callback events into an async iterable, so a generator can yield them as they arrive. */
export interface EventQueue<T> extends AsyncIterable<T> {
  push(item: T): void;
  close(): void;
}

export function createEventQueue<T>(): EventQueue<T> {
  const items: T[] = [];
  let closed = false;
  let wake: (() => void) | undefined;
  const notify = () => {
    wake?.();
    wake = undefined;
  };
  return {
    push(item) {
      if (closed) return;
      items.push(item);
      notify();
    },
    close() {
      closed = true;
      notify();
    },
    async *[Symbol.asyncIterator]() {
      for (;;) {
        if (items.length > 0) {
          yield items.shift() as T;
          continue;
        }
        if (closed) return;
        await new Promise<void>((resolve) => {
          wake = resolve;
        });
      }
    },
  };
}
