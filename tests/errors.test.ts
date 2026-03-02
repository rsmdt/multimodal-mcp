import { describe, it, expect } from "vitest";
import { sanitizeError } from "../src/errors.js";

describe("sanitizeError", () => {
  it("strips OpenAI API keys from error messages", () => {
    const result = sanitizeError("Invalid API key: sk-proj-abc123def456");
    expect(result).not.toContain("sk-proj-");
    expect(result).not.toContain("abc123");
    expect(result).toContain("[REDACTED]");
  });

  it("strips xAI API keys from error messages", () => {
    const result = sanitizeError("Auth failed: xai-abc123def456ghi789");
    expect(result).not.toContain("xai-abc123");
    expect(result).toContain("[REDACTED]");
  });

  it("strips Google API keys from error messages", () => {
    const result = sanitizeError("Bad key: AIzaSyABC123def456");
    expect(result).not.toContain("AIzaSy");
    expect(result).toContain("[REDACTED]");
  });

  it("strips stack traces", () => {
    const result = sanitizeError(
      "Error happened\n    at Object.<anonymous> (/Users/me/code/src/file.ts:10:5)\n    at Module._compile",
    );
    expect(result).not.toContain("/Users/me");
    expect(result).not.toContain("at Object");
    expect(result).toBe("Error happened");
  });

  it("strips internal file paths", () => {
    const result = sanitizeError(
      "Failed at /Users/irudi/Code/personal/media-mcp/src/providers/openai.ts:45",
    );
    expect(result).not.toContain("/Users/irudi");
  });

  it("handles non-string errors", () => {
    const result = sanitizeError(42);
    expect(result).toBe("Unknown error");
  });

  it("handles Error objects", () => {
    const error = new Error("Something failed with key sk-test-123456");
    const result = sanitizeError(error);
    expect(result).not.toContain("sk-test-");
    expect(result).toContain("[REDACTED]");
  });

  it("preserves useful error context", () => {
    const result = sanitizeError("Rate limit exceeded for model gpt-image-1");
    expect(result).toBe("Rate limit exceeded for model gpt-image-1");
  });

  it("handles empty/null/undefined", () => {
    expect(sanitizeError(null)).toBe("Unknown error");
    expect(sanitizeError(undefined)).toBe("Unknown error");
    expect(sanitizeError("")).toBe("Unknown error");
  });
});
