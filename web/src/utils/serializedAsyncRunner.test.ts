import { describe, expect, it, vi } from "vitest";

import { createSerializedAsyncRunner } from "./serializedAsyncRunner";

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("createSerializedAsyncRunner", () => {
  it("runs only the latest queued call after the active one finishes", async () => {
    const first = createDeferred();
    const second = createDeferred();
    const calls: string[] = [];
    let invocationCount = 0;

    const task = async (value: string) => {
      invocationCount += 1;
      calls.push(value);
      if (invocationCount === 1) {
        await first.promise;
        return;
      }
      await second.promise;
    };

    const spy = vi.fn(task);
    const { run } = createSerializedAsyncRunner<[string]>(spy);

    void run("first");
    void run("second");
    void run("third");

    expect(spy).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(["first"]);

    first.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(spy).toHaveBeenCalledTimes(2);
    expect(calls).toEqual(["first", "third"]);

    second.resolve();
    await Promise.resolve();
  });

  it("can merge queued boolean flags instead of replacing them", async () => {
    const first = createDeferred();
    const second = createDeferred();
    const calls: boolean[] = [];
    let invocationCount = 0;

    const task = async (value: boolean) => {
      invocationCount += 1;
      calls.push(value);
      if (invocationCount === 1) {
        await first.promise;
        return;
      }
      await second.promise;
    };

    const spy = vi.fn(task);

    const { run } = createSerializedAsyncRunner<[boolean]>(spy, (current, next) => [
      Boolean(current?.[0] || next[0]),
    ]);

    void run(false);
    void run(true);
    void run(false);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(calls).toEqual([false]);

    first.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(spy).toHaveBeenCalledTimes(2);
    expect(calls).toEqual([false, true]);

    second.resolve();
    await Promise.resolve();
  });

  it("calls onError when a task throws and continues processing the queue", async () => {
    const errors: Error[] = [];
    const calls: string[] = [];
    const first = createDeferred();
    const second = createDeferred();
    let invocationCount = 0;

    const task = async (value: string) => {
      invocationCount += 1;
      calls.push(value);
      if (invocationCount === 1) {
        await first.promise;
        throw new Error("task-1-failed");
      }
      await second.promise;
    };

    const { run } = createSerializedAsyncRunner<[string]>(
      task,
      undefined,
      (error) => errors.push(error),
    );

    void run("first");
    void run("second");

    first.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // onError was called with the error from the first task
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe("task-1-failed");

    // The queued task still ran
    expect(calls).toEqual(["first", "second"]);

    second.resolve();
    await Promise.resolve();
  });

  it("calls onError for each consecutive failure", async () => {
    const errors: Error[] = [];
    let callCount = 0;

    const task = async (_value: string) => {
      callCount += 1;
      throw new Error(`fail-${callCount}`);
    };

    const { run } = createSerializedAsyncRunner<[string]>(
      task,
      undefined,
      (error) => errors.push(error),
    );

    // Run first task — it will fail, then the queued task runs and also fails
    void run("a");
    void run("b");

    // Let microtasks settle for both tasks
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(callCount).toBe(2);
    expect(errors).toHaveLength(2);
    expect(errors[0].message).toBe("fail-1");
    expect(errors[1].message).toBe("fail-2");
  });

  it("reports queueLength correctly", async () => {
    const deferred = createDeferred();

    const task = async (_value: string) => {
      await deferred.promise;
    };

    const { run, queueLength } = createSerializedAsyncRunner<[string]>(task);

    // Nothing running yet
    expect(queueLength()).toBe(0);

    // Start first task — it's in-flight, nothing queued
    void run("first");
    expect(queueLength()).toBe(0);

    // Queue a second call
    void run("second");
    expect(queueLength()).toBe(1);

    // Queue a third call — merges with existing queued args, still 1
    void run("third");
    expect(queueLength()).toBe(1);

    // Resolve the in-flight task — queued task starts, queue empties
    deferred.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // The queued task is now in-flight, queue is empty
    expect(queueLength()).toBe(0);
  });
});
