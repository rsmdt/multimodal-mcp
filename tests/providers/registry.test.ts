import { describe, it, expect, beforeEach } from "vitest";
import { ProviderRegistry } from "../../src/providers/registry.js";
import type {
  MediaProvider,
  GeneratedMedia,
  ImageParams,
  VideoParams,
  AudioParams,
} from "../../src/providers/types.js";

const makeProvider = (
  name: string,
  supportsImage: boolean,
  supportsVideo: boolean,
  supportsAudio = false,
  supportsTranscription = false,
): MediaProvider => ({
  name,
  capabilities: {
    supportsImageGeneration: supportsImage,
    supportsVideoGeneration: supportsVideo,
    supportsAudioGeneration: supportsAudio,
    supportsTranscription,
    supportedImageAspectRatios: supportsImage ? ["1:1", "16:9"] : [],
    supportedVideoAspectRatios: supportsVideo ? ["16:9"] : [],
    supportedVideoResolutions: supportsVideo ? ["1080p"] : [],
    supportedAudioFormats: supportsAudio ? ["mp3"] : [],
    maxVideoDurationSeconds: supportsVideo ? 60 : 0,
  },
  generateImage: async (_params: ImageParams): Promise<GeneratedMedia> => ({
    data: Buffer.from("image"),
    mimeType: "image/png",
    metadata: {},
  }),
  generateVideo: async (_params: VideoParams): Promise<GeneratedMedia> => ({
    data: Buffer.from("video"),
    mimeType: "video/mp4",
    metadata: {},
  }),
  generateAudio: async (_params: AudioParams): Promise<GeneratedMedia> => ({
    data: Buffer.from("audio"),
    mimeType: "audio/mpeg",
    metadata: {},
  }),
});

describe("ProviderRegistry", () => {
  let registry: ProviderRegistry;

  beforeEach(() => {
    registry = new ProviderRegistry();
  });

  describe("register()", () => {
    it("adds a provider to the registry", () => {
      const provider = makeProvider("test-provider", true, false);
      registry.register(provider);
      expect(registry.getProvider("test-provider")).toBe(provider);
    });
  });

  describe("getProvider(name)", () => {
    it("returns the named provider when it exists", () => {
      const provider = makeProvider("my-provider", true, true);
      registry.register(provider);
      expect(registry.getProvider("my-provider")).toBe(provider);
    });

    it("returns undefined for an unknown provider name", () => {
      registry.register(makeProvider("existing", true, false));
      expect(registry.getProvider("nonexistent")).toBeUndefined();
    });
  });

  describe("getProvider() without name (auto-select)", () => {
    it("returns the first registered provider when no name given", () => {
      const first = makeProvider("first", true, false);
      const second = makeProvider("second", false, true);
      registry.register(first);
      registry.register(second);
      expect(registry.getProvider()).toBe(first);
    });

    it("returns undefined when registry is empty", () => {
      expect(registry.getProvider()).toBeUndefined();
    });
  });

  describe("getImageProviders()", () => {
    it("returns only providers with supportsImageGeneration: true", () => {
      const imageOnly = makeProvider("image-only", true, false);
      const videoOnly = makeProvider("video-only", false, true);
      const both = makeProvider("both", true, true);
      registry.register(imageOnly);
      registry.register(videoOnly);
      registry.register(both);

      const result = registry.getImageProviders();
      expect(result).toHaveLength(2);
      expect(result).toContain(imageOnly);
      expect(result).toContain(both);
      expect(result).not.toContain(videoOnly);
    });

    it("returns empty array when no image providers registered", () => {
      registry.register(makeProvider("video-only", false, true));
      expect(registry.getImageProviders()).toEqual([]);
    });
  });

  describe("getVideoProviders()", () => {
    it("returns only providers with supportsVideoGeneration: true", () => {
      const imageOnly = makeProvider("image-only", true, false);
      const videoOnly = makeProvider("video-only", false, true);
      const both = makeProvider("both", true, true);
      registry.register(imageOnly);
      registry.register(videoOnly);
      registry.register(both);

      const result = registry.getVideoProviders();
      expect(result).toHaveLength(2);
      expect(result).toContain(videoOnly);
      expect(result).toContain(both);
      expect(result).not.toContain(imageOnly);
    });

    it("returns empty array when no video providers registered", () => {
      registry.register(makeProvider("image-only", true, false));
      expect(registry.getVideoProviders()).toEqual([]);
    });
  });

  describe("getAudioProviders()", () => {
    it("returns only providers with supportsAudioGeneration: true", () => {
      const withAudio = makeProvider("with-audio", true, false, true);
      const withoutAudio = makeProvider("without-audio", true, true, false);
      registry.register(withAudio);
      registry.register(withoutAudio);

      const result = registry.getAudioProviders();
      expect(result).toHaveLength(1);
      expect(result).toContain(withAudio);
      expect(result).not.toContain(withoutAudio);
    });

    it("returns empty array when no audio providers registered", () => {
      registry.register(makeProvider("image-only", true, false, false));
      expect(registry.getAudioProviders()).toEqual([]);
    });
  });

  describe("getTranscriptionProviders()", () => {
    it("returns only providers with supportsTranscription: true", () => {
      const withTranscription = makeProvider("with-transcription", false, false, false, true);
      const withoutTranscription = makeProvider("without-transcription", true, true, false, false);
      registry.register(withTranscription);
      registry.register(withoutTranscription);

      const result = registry.getTranscriptionProviders();
      expect(result).toHaveLength(1);
      expect(result).toContain(withTranscription);
      expect(result).not.toContain(withoutTranscription);
    });

    it("returns empty array when no transcription providers registered", () => {
      registry.register(makeProvider("image-only", true, false, false, false));
      expect(registry.getTranscriptionProviders()).toEqual([]);
    });
  });

  describe("listCapabilities()", () => {
    it("returns ProviderInfo[] for all registered providers", () => {
      const p1 = makeProvider("provider-a", true, false);
      const p2 = makeProvider("provider-b", false, true);
      registry.register(p1);
      registry.register(p2);

      const result = registry.listCapabilities();
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ name: "provider-a", capabilities: p1.capabilities });
      expect(result[1]).toEqual({ name: "provider-b", capabilities: p2.capabilities });
    });

    it("returns empty array when no providers registered", () => {
      expect(registry.listCapabilities()).toEqual([]);
    });
  });
});
