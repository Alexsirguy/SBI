import { describe, expect, it } from "vitest";
import { createEventQueue } from "./event-queue";

describe("createEventQueue", () => {
  it("yields items pushed before and after iteration starts, then ends on close", async () => {
    const queue = createEventQueue<number>();
    queue.push(1);
    const seen: number[] = [];
    const reading = (async () => {
      for await (const item of queue) seen.push(item);
    })();
    await Promise.resolve();
    queue.push(2);
    queue.push(3);
    queue.close();
    queue.push(4);
    await reading;
    expect(seen).toEqual([1, 2, 3]);
  });
});
