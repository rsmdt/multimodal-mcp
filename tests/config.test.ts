import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.OPENAI_API_KEY;
    delete process.env.XAI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.MEDIA_OUTPUT_DIR;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns detected API keys from environment", () => {
    process.env.OPENAI_API_KEY = "sk-test-123";
    process.env.XAI_API_KEY = "xai-test-456";
    const config = loadConfig();
    expect(config.openaiApiKey).toBe("sk-test-123");
    expect(config.xaiApiKey).toBe("xai-test-456");
  });

  it("handles GEMINI_API_KEY", () => {
    process.env.GEMINI_API_KEY = "gemini-key-123";
    const config = loadConfig();
    expect(config.googleApiKey).toBe("gemini-key-123");
  });

  it("handles GOOGLE_API_KEY as alias for Gemini", () => {
    process.env.GOOGLE_API_KEY = "google-key-456";
    const config = loadConfig();
    expect(config.googleApiKey).toBe("google-key-456");
  });

  it("prefers GEMINI_API_KEY over GOOGLE_API_KEY when both set", () => {
    process.env.GEMINI_API_KEY = "gemini-primary";
    process.env.GOOGLE_API_KEY = "google-fallback";
    const config = loadConfig();
    expect(config.googleApiKey).toBe("gemini-primary");
  });

  it("returns outputDirectory from MEDIA_OUTPUT_DIR", () => {
    process.env.MEDIA_OUTPUT_DIR = "/custom/output";
    const config = loadConfig();
    expect(config.outputDirectory).toBe("/custom/output");
  });

  it("defaults outputDirectory to os.tmpdir() when not set", () => {
    const config = loadConfig();
    expect(config.outputDirectory).toBeTruthy();
  });

  it("works when no keys are set", () => {
    const config = loadConfig();
    expect(config.openaiApiKey).toBeUndefined();
    expect(config.xaiApiKey).toBeUndefined();
    expect(config.googleApiKey).toBeUndefined();
    expect(config.outputDirectory).toBeTruthy();
  });
});
