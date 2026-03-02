import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildGenerateVideoHandler } from "../../src/tools/generate-video.js";
import type { ProviderRegistry } from "../../src/providers/registry.js";
import type { FileManager } from "../../src/file-manager.js";
import type { MediaProvider, GeneratedMedia, ImageParams, VideoParams } from "../../src/providers/types.js";

const makeMedia = (): GeneratedMedia => ({
  data: Buffer.from("video-data"),
  mimeType: "video/mp4",
  metadata: { provider: "test-provider" },
});

const makeProvider = (name: string, overrides?: Partial<MediaProvider>): MediaProvider => ({
  name,
  capabilities: {
    supportsImageGeneration: false,
    supportsVideoGeneration: true,
    supportedImageAspectRatios: [],
    supportedVideoAspectRatios: ["16:9"],
    supportedVideoResolutions: ["720p", "1080p"],
    maxVideoDurationSeconds: 60,
  },
  generateImage: async (_params: ImageParams): Promise<GeneratedMedia> => makeMedia(),
  generateVideo: async (_params: VideoParams): Promise<GeneratedMedia> => makeMedia(),
  ...overrides,
});

const makeRegistry = (overrides?: Partial<ProviderRegistry>): ProviderRegistry => ({
  register: vi.fn(),
  getProvider: vi.fn(),
  getImageProviders: vi.fn().mockReturnValue([]),
  getVideoProviders: vi.fn().mockReturnValue([]),
  listCapabilities: vi.fn().mockReturnValue([]),
  ...overrides,
} as unknown as ProviderRegistry);

const makeFileManager = (overrides?: Partial<FileManager>): FileManager => ({
  save: vi.fn().mockResolvedValue("/output/video-123.mp4"),
  ...overrides,
} as unknown as FileManager);

describe("buildGenerateVideoHandler", () => {
  let registry: ProviderRegistry;
  let fileManager: FileManager;

  beforeEach(() => {
    registry = makeRegistry();
    fileManager = makeFileManager();
  });

  describe("successful generation", () => {
    it("returns text content with file path on success", async () => {
      const provider = makeProvider("test-provider");
      vi.mocked(registry.getProvider).mockReturnValue(provider);

      const handle = buildGenerateVideoHandler(registry, fileManager);
      const result = await handle({ prompt: "a cat running" });

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe("text");
      expect(result.content[0].text).toContain("/output/video-123.mp4");
    });

    it("does not set isError on success", async () => {
      const provider = makeProvider("test-provider");
      vi.mocked(registry.getProvider).mockReturnValue(provider);

      const handle = buildGenerateVideoHandler(registry, fileManager);
      const result = await handle({ prompt: "a dog running" });

      expect((result as { isError?: boolean }).isError).toBeUndefined();
    });
  });

  describe("default parameter values", () => {
    it("uses duration=5, aspectRatio=16:9, resolution=720p when not specified", async () => {
      const generateVideo = vi.fn().mockResolvedValue(makeMedia());
      const provider = makeProvider("test-provider", { generateVideo });
      vi.mocked(registry.getProvider).mockReturnValue(provider);

      const handle = buildGenerateVideoHandler(registry, fileManager);
      await handle({ prompt: "a sunset" });

      expect(generateVideo).toHaveBeenCalledWith(
        expect.objectContaining({
          duration: 5,
          aspectRatio: "16:9",
          resolution: "720p",
        }),
      );
    });

    it("respects overridden duration, aspectRatio, and resolution", async () => {
      const generateVideo = vi.fn().mockResolvedValue(makeMedia());
      const provider = makeProvider("test-provider", { generateVideo });
      vi.mocked(registry.getProvider).mockReturnValue(provider);

      const handle = buildGenerateVideoHandler(registry, fileManager);
      await handle({
        prompt: "a sunrise",
        duration: 10,
        aspectRatio: "9:16",
        resolution: "1080p",
      });

      expect(generateVideo).toHaveBeenCalledWith(
        expect.objectContaining({
          duration: 10,
          aspectRatio: "9:16",
          resolution: "1080p",
        }),
      );
    });
  });

  describe("providerOptions passthrough", () => {
    it("passes providerOptions through to provider.generateVideo", async () => {
      const generateVideo = vi.fn().mockResolvedValue(makeMedia());
      const provider = makeProvider("test-provider", { generateVideo });
      vi.mocked(registry.getProvider).mockReturnValue(provider);

      const handle = buildGenerateVideoHandler(registry, fileManager);
      const providerOptions = { seed: 42, style: "cinematic" };
      await handle({ prompt: "ocean waves", providerOptions });

      expect(generateVideo).toHaveBeenCalledWith(
        expect.objectContaining({ providerOptions }),
      );
    });
  });

  describe("provider selection", () => {
    it("auto-selects provider when none specified", async () => {
      const provider = makeProvider("auto-selected");
      vi.mocked(registry.getProvider).mockReturnValue(provider);

      const handle = buildGenerateVideoHandler(registry, fileManager);
      await handle({ prompt: "test" });

      expect(registry.getProvider).toHaveBeenCalledWith(undefined);
    });

    it("uses explicit provider when specified", async () => {
      const provider = makeProvider("my-provider");
      vi.mocked(registry.getProvider).mockReturnValue(provider);

      const handle = buildGenerateVideoHandler(registry, fileManager);
      await handle({ prompt: "test", provider: "my-provider" });

      expect(registry.getProvider).toHaveBeenCalledWith("my-provider");
    });
  });

  describe("error: no provider available", () => {
    it("returns isError when no video provider available (no name given)", async () => {
      vi.mocked(registry.getProvider).mockReturnValue(undefined);
      vi.mocked(registry.getVideoProviders).mockReturnValue([]);

      const handle = buildGenerateVideoHandler(registry, fileManager);
      const result = await handle({ prompt: "test" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("No video provider available");
    });

    it("returns isError mentioning provider name when explicit provider not found", async () => {
      vi.mocked(registry.getProvider).mockReturnValue(undefined);
      vi.mocked(registry.getVideoProviders).mockReturnValue([]);

      const handle = buildGenerateVideoHandler(registry, fileManager);
      const result = await handle({ prompt: "test", provider: "missing-provider" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("missing-provider");
    });
  });

  describe("error: timeout", () => {
    it("returns isError on timeout error", async () => {
      const generateVideo = vi.fn().mockRejectedValue(new Error("Request timed out"));
      const provider = makeProvider("test-provider", { generateVideo });
      vi.mocked(registry.getProvider).mockReturnValue(provider);

      const handle = buildGenerateVideoHandler(registry, fileManager);
      const result = await handle({ prompt: "test" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Request timed out");
    });
  });

  describe("error: API failure", () => {
    it("returns isError with sanitized message on API failure", async () => {
      const generateVideo = vi.fn().mockRejectedValue(new Error("API rate limit exceeded"));
      const provider = makeProvider("test-provider", { generateVideo });
      vi.mocked(registry.getProvider).mockReturnValue(provider);

      const handle = buildGenerateVideoHandler(registry, fileManager);
      const result = await handle({ prompt: "test" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Video generation failed");
      expect(result.content[0].text).toContain("API rate limit exceeded");
    });

    it("returns isError with sanitized message for non-Error throws", async () => {
      const generateVideo = vi.fn().mockRejectedValue("raw string error");
      const provider = makeProvider("test-provider", { generateVideo });
      vi.mocked(registry.getProvider).mockReturnValue(provider);

      const handle = buildGenerateVideoHandler(registry, fileManager);
      const result = await handle({ prompt: "test" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("raw string error");
    });
  });
});
