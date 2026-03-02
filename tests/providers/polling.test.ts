import { describe, it, expect, vi } from "vitest";
import { pollForCompletion } from "../../src/providers/polling.js";

describe("pollForCompletion", () => {
  it("resolves when isComplete returns true immediately", async () => {
    const checkStatus = vi.fn().mockResolvedValue({ status: "done", data: "result" });
    const result = await pollForCompletion(
      checkStatus,
      (r) => r.status === "done",
      { timeoutMs: 5000, intervalMs: 100 },
    );
    expect(result.data).toBe("result");
    expect(checkStatus).toHaveBeenCalledTimes(1);
  });

  it("resolves after multiple polls", async () => {
    const checkStatus = vi
      .fn()
      .mockResolvedValueOnce({ status: "pending" })
      .mockResolvedValueOnce({ status: "pending" })
      .mockResolvedValueOnce({ status: "done", data: "final" });

    const result = await pollForCompletion(
      checkStatus,
      (r) => r.status === "done",
      { timeoutMs: 5000, intervalMs: 50 },
    );
    expect(result.data).toBe("final");
    expect(checkStatus).toHaveBeenCalledTimes(3);
  });

  it("throws on timeout", async () => {
    const checkStatus = vi.fn().mockResolvedValue({ status: "pending" });
    await expect(
      pollForCompletion(checkStatus, (r) => r.status === "done", {
        timeoutMs: 150,
        intervalMs: 50,
      }),
    ).rejects.toThrow(/timed out/i);
  });

  it("calls onPoll callback with attempt number", async () => {
    const onPoll = vi.fn();
    const checkStatus = vi
      .fn()
      .mockResolvedValueOnce({ status: "pending" })
      .mockResolvedValueOnce({ status: "done" });

    await pollForCompletion(checkStatus, (r) => r.status === "done", {
      timeoutMs: 5000,
      intervalMs: 50,
      onPoll,
    });
    expect(onPoll).toHaveBeenCalledWith(1);
    expect(onPoll).toHaveBeenCalledWith(2);
  });
});
