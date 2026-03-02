import { describe, it, expect } from "vitest";
import type {
  MediaProvider,
  GeneratedMedia,
  ImageParams,
  VideoParams,
  AudioParams,
  ProviderCapabilities,
  ProviderInfo,
} from "../../src/providers/types.js";

describe("Provider types", () => {
  it("GeneratedMedia has required fields", () => {
    const media: GeneratedMedia = {
      data: Buffer.from("test"),
      mimeType: "image/png",
      metadata: { provider: "test" },
    };
    expect(media.data).toBeInstanceOf(Buffer);
    expect(media.mimeType).toBe("image/png");
    expect(media.metadata).toBeDefined();
  });

  it("ImageParams has required and optional fields", () => {
    const params: ImageParams = {
      prompt: "a sunset over the ocean",
      aspectRatio: "16:9",
      quality: "high",
    };
    expect(params.prompt).toBe("a sunset over the ocean");
    expect(params.aspectRatio).toBe("16:9");
    expect(params.quality).toBe("high");
    expect(params.providerOptions).toBeUndefined();
  });

  it("ImageParams accepts providerOptions", () => {
    const params: ImageParams = {
      prompt: "test",
      aspectRatio: "1:1",
      quality: "standard",
      providerOptions: { style: "vivid" },
    };
    expect(params.providerOptions).toEqual({ style: "vivid" });
  });

  it("VideoParams has required and optional fields", () => {
    const params: VideoParams = {
      prompt: "a timelapse of clouds",
      duration: 10,
      aspectRatio: "16:9",
      resolution: "1080p",
    };
    expect(params.prompt).toBe("a timelapse of clouds");
    expect(params.duration).toBe(10);
    expect(params.aspectRatio).toBe("16:9");
    expect(params.resolution).toBe("1080p");
    expect(params.providerOptions).toBeUndefined();
  });

  it("VideoParams accepts providerOptions", () => {
    const params: VideoParams = {
      prompt: "test",
      duration: 5,
      aspectRatio: "4:3",
      resolution: "720p",
      providerOptions: { fps: 30 },
    };
    expect(params.providerOptions).toEqual({ fps: 30 });
  });

  it("AudioParams has required and optional fields", () => {
    const params: AudioParams = {
      text: "Hello world",
    };
    expect(params.text).toBe("Hello world");
    expect(params.voice).toBeUndefined();
    expect(params.speed).toBeUndefined();
    expect(params.format).toBeUndefined();
    expect(params.providerOptions).toBeUndefined();
  });

  it("AudioParams accepts all optional fields", () => {
    const params: AudioParams = {
      text: "Hello world",
      voice: "alloy",
      speed: 1.5,
      format: "mp3",
      providerOptions: { instructions: "Speak cheerfully" },
    };
    expect(params.voice).toBe("alloy");
    expect(params.speed).toBe(1.5);
    expect(params.format).toBe("mp3");
    expect(params.providerOptions).toEqual({ instructions: "Speak cheerfully" });
  });

  it("ProviderCapabilities has all required fields", () => {
    const capabilities: ProviderCapabilities = {
      supportsImageGeneration: true,
      supportsVideoGeneration: false,
      supportsAudioGeneration: true,
      supportedImageAspectRatios: ["1:1", "16:9"],
      supportedVideoAspectRatios: [],
      supportedVideoResolutions: [],
      supportedAudioFormats: ["mp3", "wav"],
      maxVideoDurationSeconds: 0,
    };
    expect(capabilities.supportsImageGeneration).toBe(true);
    expect(capabilities.supportsVideoGeneration).toBe(false);
    expect(capabilities.supportsAudioGeneration).toBe(true);
    expect(capabilities.supportedImageAspectRatios).toEqual(["1:1", "16:9"]);
    expect(capabilities.supportedVideoAspectRatios).toEqual([]);
    expect(capabilities.supportedVideoResolutions).toEqual([]);
    expect(capabilities.supportedAudioFormats).toEqual(["mp3", "wav"]);
    expect(capabilities.maxVideoDurationSeconds).toBe(0);
  });

  it("ProviderInfo has name and capabilities fields", () => {
    const info: ProviderInfo = {
      name: "test-provider",
      capabilities: {
        supportsImageGeneration: true,
        supportsVideoGeneration: true,
        supportsAudioGeneration: false,
        supportedImageAspectRatios: ["1:1"],
        supportedVideoAspectRatios: ["16:9"],
        supportedVideoResolutions: ["1080p"],
        supportedAudioFormats: [],
        maxVideoDurationSeconds: 60,
      },
    };
    expect(info.name).toBe("test-provider");
    expect(info.capabilities).toBeDefined();
  });

  it("MediaProvider mock object satisfies interface", () => {
    const mockProvider: MediaProvider = {
      name: "mock-provider",
      capabilities: {
        supportsImageGeneration: true,
        supportsVideoGeneration: true,
        supportsAudioGeneration: true,
        supportedImageAspectRatios: ["1:1", "16:9"],
        supportedVideoAspectRatios: ["16:9"],
        supportedVideoResolutions: ["1080p"],
        supportedAudioFormats: ["mp3"],
        maxVideoDurationSeconds: 30,
      },
      generateImage: async (_params: ImageParams): Promise<GeneratedMedia> => ({
        data: Buffer.from("image-data"),
        mimeType: "image/png",
        metadata: { width: 1024, height: 1024 },
      }),
      generateVideo: async (_params: VideoParams): Promise<GeneratedMedia> => ({
        data: Buffer.from("video-data"),
        mimeType: "video/mp4",
        metadata: { duration: 10 },
      }),
      generateAudio: async (_params: AudioParams): Promise<GeneratedMedia> => ({
        data: Buffer.from("audio-data"),
        mimeType: "audio/mpeg",
        metadata: { voice: "alloy" },
      }),
    };

    expect(mockProvider.name).toBe("mock-provider");
    expect(mockProvider.capabilities.supportsImageGeneration).toBe(true);
    expect(typeof mockProvider.generateImage).toBe("function");
    expect(typeof mockProvider.generateVideo).toBe("function");
    expect(typeof mockProvider.generateAudio).toBe("function");
  });

  it("MediaProvider generateImage returns GeneratedMedia", async () => {
    const mockProvider: MediaProvider = {
      name: "test",
      capabilities: {
        supportsImageGeneration: true,
        supportsVideoGeneration: false,
        supportsAudioGeneration: false,
        supportedImageAspectRatios: ["1:1"],
        supportedVideoAspectRatios: [],
        supportedVideoResolutions: [],
        supportedAudioFormats: [],
        maxVideoDurationSeconds: 0,
      },
      generateImage: async (): Promise<GeneratedMedia> => ({
        data: Buffer.from("img"),
        mimeType: "image/jpeg",
        metadata: {},
      }),
      generateVideo: async (): Promise<GeneratedMedia> => ({
        data: Buffer.from("vid"),
        mimeType: "video/mp4",
        metadata: {},
      }),
      generateAudio: async (): Promise<GeneratedMedia> => ({
        data: Buffer.from("audio"),
        mimeType: "audio/mpeg",
        metadata: {},
      }),
    };

    const result = await mockProvider.generateImage({
      prompt: "test",
      aspectRatio: "1:1",
      quality: "high",
    });

    expect(result.data).toBeInstanceOf(Buffer);
    expect(result.mimeType).toBe("image/jpeg");
    expect(result.metadata).toEqual({});
  });
});
