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
    delete process.env.ELEVENLABS_API_KEY;
    delete process.env.BFL_API_KEY;
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

  it("defaults outputDirectory to cwd when not set", () => {
    const config = loadConfig();
    expect(config.outputDirectory).toBeTruthy();
  });

  it("handles ELEVENLABS_API_KEY", () => {
    process.env.ELEVENLABS_API_KEY = "xi-test-key";
    const config = loadConfig();
    expect(config.elevenlabsApiKey).toBe("xi-test-key");
  });

  it("handles BFL_API_KEY", () => {
    process.env.BFL_API_KEY = "bfl-test-key";
    const config = loadConfig();
    expect(config.bflApiKey).toBe("bfl-test-key");
  });

  it("works when no keys are set", () => {
    const config = loadConfig();
    expect(config.openaiApiKey).toBeUndefined();
    expect(config.xaiApiKey).toBeUndefined();
    expect(config.googleApiKey).toBeUndefined();
    expect(config.elevenlabsApiKey).toBeUndefined();
    expect(config.bflApiKey).toBeUndefined();
    expect(config.outputDirectory).toBeTruthy();
  });
});
