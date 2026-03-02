import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { rm, readFile, access } from "node:fs/promises";

// --- Mock openai SDK before any provider imports ---
const mockImagesGenerate = vi.fn();
const mockVideosCreate = vi.fn();
const mockVideosRetrieve = vi.fn();

vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      images: { generate: mockImagesGenerate },
      videos: { create: mockVideosCreate, retrieve: mockVideosRetrieve },
    };
  }),
}));

// --- Mock global fetch for HTTP-based providers (Google, video download) ---
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { ProviderRegistry } from "../../src/providers/registry.js";
import { OpenAIProvider } from "../../src/providers/openai.js";
import { GoogleProvider } from "../../src/providers/google.js";
import { FileManager } from "../../src/file-manager.js";
import { buildGenerateImageHandler } from "../../src/tools/generate-image.js";
import { buildGenerateVideoHandler } from "../../src/tools/generate-video.js";

const FAKE_IMAGE_CONTENT = "fake-image-bytes";
const FAKE_IMAGE_BASE64 = Buffer.from(FAKE_IMAGE_CONTENT).toString("base64");

describe("Integration: Media Generation Flows", () => {
  let testDir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    testDir = join(tmpdir(), `media-mcp-int-${randomBytes(4).toString("hex")}`);
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  // ─── 1. Full Image Generation Flow ────────────────────────────────────────

  describe("full image generation flow", () => {
    it("saves generated image to disk and returns file path", async () => {
      mockImagesGenerate.mockResolvedValue({ data: [{ b64_json: FAKE_IMAGE_BASE64 }] });

      const registry = new ProviderRegistry();
      registry.register(new OpenAIProvider("sk-fake-key"));
      const fileManager = new FileManager(testDir);
      const handler = buildGenerateImageHandler(registry, fileManager);

      const result = await handler({ prompt: "a sunlit beach" });

      expect(result).not.toHaveProperty("isError");
      const savedPath = result.content[0].text.replace("Image saved to ", "");
      const fileContent = await readFile(savedPath);
      expect(fileContent.toString()).toBe(FAKE_IMAGE_CONTENT);
    });
  });

  // ─── 2. Full Video Generation Flow ────────────────────────────────────────

  describe("full video generation flow", () => {
    it("polls until complete, downloads, saves video, and returns file path", async () => {
      const fakeJobId = "video-job-42";
      const fakeVideoUrl = "https://cdn.openai.com/videos/test.mp4";
      const fakeVideoArrayBuffer = new Uint8Array([1, 2, 3, 4, 5]).buffer;

      mockVideosCreate.mockResolvedValue({ id: fakeJobId, status: "pending" });
      // retrieve returns "completed" immediately so pollForCompletion exits on first check
      mockVideosRetrieve.mockResolvedValue({ status: "completed", url: fakeVideoUrl });
      mockFetch.mockResolvedValue({
        arrayBuffer: () => Promise.resolve(fakeVideoArrayBuffer),
      });

      const registry = new ProviderRegistry();
      registry.register(new OpenAIProvider("sk-fake-key"));
      const fileManager = new FileManager(testDir);
      const handler = buildGenerateVideoHandler(registry, fileManager);

      const result = await handler({ prompt: "a dolphin leaping" });

      expect(result).not.toHaveProperty("isError");
      const text = result.content[0].text;
      expect(text).toContain("Video saved to");
      expect(text).toContain(".mp4");

      const savedPath = text.replace("Video saved to ", "");
      await access(savedPath); // throws if file does not exist
      expect(mockFetch).toHaveBeenCalledWith(fakeVideoUrl);
    });
  });

  // ─── 3. Provider Auto-Selection ───────────────────────────────────────────

  describe("provider auto-selection with multiple providers registered", () => {
    it("uses the first registered provider when no provider is specified", async () => {
      mockImagesGenerate.mockResolvedValue({ data: [{ b64_json: FAKE_IMAGE_BASE64 }] });

      const registry = new ProviderRegistry();
      registry.register(new OpenAIProvider("sk-fake-openai")); // registered first
      registry.register(new GoogleProvider("google-fake-key")); // registered second
      const fileManager = new FileManager(testDir);
      const handler = buildGenerateImageHandler(registry, fileManager);

      const result = await handler({ prompt: "aurora borealis" });

      // OpenAI SDK was used (not fetch which Google uses)
      expect(mockImagesGenerate).toHaveBeenCalledTimes(1);
      expect(mockFetch).not.toHaveBeenCalled();
      expect(result).not.toHaveProperty("isError");
    });
  });

  // ─── 4. Explicit Provider Selection ──────────────────────────────────────

  describe("explicit provider selection", () => {
    it("routes request to Google provider when provider: 'google' is specified", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            generatedImages: [{ image: { bytesBase64Encoded: FAKE_IMAGE_BASE64 } }],
          }),
      });

      const registry = new ProviderRegistry();
      registry.register(new OpenAIProvider("sk-fake-openai"));
      registry.register(new GoogleProvider("google-fake-key"));
      const fileManager = new FileManager(testDir);
      const handler = buildGenerateImageHandler(registry, fileManager);

      const result = await handler({ prompt: "mount fuji", provider: "google" });

      // Google uses fetch; the URL should target imagen-4
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain("imagen-4");
      // OpenAI SDK was NOT used
      expect(mockImagesGenerate).not.toHaveBeenCalled();
      expect(result).not.toHaveProperty("isError");
    });
  });

  // ─── 5. Graceful Degradation (No API Keys) ────────────────────────────────

  describe("graceful degradation with no API keys configured", () => {
    it("returns isError with helpful message when no providers are registered", async () => {
      const registry = new ProviderRegistry();
      const fileManager = new FileManager(testDir);
      const handler = buildGenerateImageHandler(registry, fileManager);

      const result = await handler({ prompt: "a meadow" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("No image provider available");
      expect(result.content[0].text).toContain("OPENAI_API_KEY");
    });
  });

  // ─── 6. Error Propagation ─────────────────────────────────────────────────

  describe("error propagation from provider through handler to MCP response", () => {
    it("returns isError response when provider throws, without exposing API key", async () => {
      mockImagesGenerate.mockRejectedValue(new Error("Rate limit exceeded — try again later"));

      const registry = new ProviderRegistry();
      registry.register(new OpenAIProvider("sk-fake-key"));
      const fileManager = new FileManager(testDir);
      const handler = buildGenerateImageHandler(registry, fileManager);

      const result = await handler({ prompt: "a forest" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Image generation failed");
      expect(result.content[0].text).toContain("Rate limit exceeded");
      expect(result.content[0].text).not.toContain("sk-fake-key");
    });
  });

  // ─── 7. Output Directory Creation ─────────────────────────────────────────

  describe("output directory creation when missing", () => {
    it("creates nested directories automatically before saving the file", async () => {
      mockImagesGenerate.mockResolvedValue({ data: [{ b64_json: FAKE_IMAGE_BASE64 }] });

      const nestedDir = join(testDir, "a", "b", "c");
      const registry = new ProviderRegistry();
      registry.register(new OpenAIProvider("sk-fake-key"));
      const fileManager = new FileManager(nestedDir);
      const handler = buildGenerateImageHandler(registry, fileManager);

      const result = await handler({ prompt: "starry night" });

      expect(result).not.toHaveProperty("isError");
      const savedPath = result.content[0].text.replace("Image saved to ", "");
      expect(savedPath.startsWith(nestedDir)).toBe(true);
      const fileContent = await readFile(savedPath);
      expect(fileContent.toString()).toBe(FAKE_IMAGE_CONTENT);
    });
  });
});
