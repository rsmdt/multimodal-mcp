import { describe, it, expect, vi, beforeEach } from "vitest";
import { OpenAIProvider } from "../../src/providers/openai.js";

// Mock the openai SDK
const mockImagesGenerate = vi.fn();
const mockVideosCreate = vi.fn();
const mockVideosRetrieve = vi.fn();
const mockAudioSpeechCreate = vi.fn();

vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      images: { generate: mockImagesGenerate },
      videos: { create: mockVideosCreate, retrieve: mockVideosRetrieve },
      audio: { speech: { create: mockAudioSpeechCreate } },
    };
  }),
}));

// Mock pollForCompletion to avoid actual polling in tests
vi.mock("../../src/providers/polling.js", () => ({
  pollForCompletion: vi.fn(),
}));

import { pollForCompletion } from "../../src/providers/polling.js";

const mockPollForCompletion = vi.mocked(pollForCompletion);

// Mock global fetch for video download
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("OpenAIProvider", () => {
  let provider: OpenAIProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new OpenAIProvider("test-api-key");
  });

  describe("capabilities", () => {
    it("has name 'openai'", () => {
      expect(provider.name).toBe("openai");
    });

    it("supports image and video generation", () => {
      expect(provider.capabilities.supportsImageGeneration).toBe(true);
      expect(provider.capabilities.supportsVideoGeneration).toBe(true);
      expect(provider.capabilities.supportsAudioGeneration).toBe(true);
    });

    it("supports expected aspect ratios", () => {
      expect(provider.capabilities.supportedImageAspectRatios).toContain("1:1");
      expect(provider.capabilities.supportedImageAspectRatios).toContain("16:9");
      expect(provider.capabilities.supportedImageAspectRatios).toContain("9:16");
    });

    it("supports expected video resolutions", () => {
      expect(provider.capabilities.supportedVideoResolutions).toContain("480p");
      expect(provider.capabilities.supportedVideoResolutions).toContain("720p");
      expect(provider.capabilities.supportedVideoResolutions).toContain("1080p");
    });

    it("has maxVideoDurationSeconds of 20", () => {
      expect(provider.capabilities.maxVideoDurationSeconds).toBe(20);
    });
  });

  describe("generateImage", () => {
    const base64Data = Buffer.from("fake-image-data").toString("base64");

    beforeEach(() => {
      mockImagesGenerate.mockResolvedValue({
        data: [{ b64_json: base64Data }],
      });
    });

    it("calls client.images.generate with model 'gpt-image-1'", async () => {
      await provider.generateImage({ prompt: "a cat", aspectRatio: "1:1", quality: "standard" });

      expect(mockImagesGenerate).toHaveBeenCalledWith(
        expect.objectContaining({ model: "gpt-image-1" }),
      );
    });

    it("calls client.images.generate with response_format 'b64_json'", async () => {
      await provider.generateImage({ prompt: "a cat", aspectRatio: "1:1", quality: "standard" });

      expect(mockImagesGenerate).toHaveBeenCalledWith(
        expect.objectContaining({ response_format: "b64_json" }),
      );
    });

    it("maps aspectRatio '1:1' to size '1024x1024'", async () => {
      await provider.generateImage({ prompt: "a cat", aspectRatio: "1:1", quality: "standard" });

      expect(mockImagesGenerate).toHaveBeenCalledWith(
        expect.objectContaining({ size: "1024x1024" }),
      );
    });

    it("maps aspectRatio '16:9' to size '1536x1024'", async () => {
      await provider.generateImage({ prompt: "a cat", aspectRatio: "16:9", quality: "standard" });

      expect(mockImagesGenerate).toHaveBeenCalledWith(
        expect.objectContaining({ size: "1536x1024" }),
      );
    });

    it("maps aspectRatio '9:16' to size '1024x1536'", async () => {
      await provider.generateImage({ prompt: "a cat", aspectRatio: "9:16", quality: "standard" });

      expect(mockImagesGenerate).toHaveBeenCalledWith(
        expect.objectContaining({ size: "1024x1536" }),
      );
    });

    it("returns GeneratedMedia with buffer decoded from base64", async () => {
      const result = await provider.generateImage({
        prompt: "a cat",
        aspectRatio: "1:1",
        quality: "standard",
      });

      expect(result.data).toBeInstanceOf(Buffer);
      expect(result.data.toString()).toBe("fake-image-data");
    });

    it("returns GeneratedMedia with mimeType 'image/png'", async () => {
      const result = await provider.generateImage({
        prompt: "a cat",
        aspectRatio: "1:1",
        quality: "standard",
      });

      expect(result.mimeType).toBe("image/png");
    });

    it("passes providerOptions spread into API call", async () => {
      await provider.generateImage({
        prompt: "a cat",
        aspectRatio: "1:1",
        quality: "standard",
        providerOptions: { n: 2, style: "vivid" },
      });

      expect(mockImagesGenerate).toHaveBeenCalledWith(
        expect.objectContaining({ n: 2, style: "vivid" }),
      );
    });

    it("throws on API error (401 unauthorized)", async () => {
      const error = new Error("401 Unauthorized");
      mockImagesGenerate.mockRejectedValue(error);

      await expect(
        provider.generateImage({ prompt: "a cat", aspectRatio: "1:1", quality: "standard" }),
      ).rejects.toThrow("401 Unauthorized");
    });
  });

  describe("generateVideo", () => {
    const fakeJobId = "job-123";
    const fakeVideoUrl = "https://example.com/video.mp4";
    const fakeVideoBuffer = Buffer.from("fake-video-data");

    beforeEach(() => {
      mockVideosCreate.mockResolvedValue({ id: fakeJobId, status: "pending" });
      mockPollForCompletion.mockResolvedValue({ id: fakeJobId, status: "completed", url: fakeVideoUrl });
      mockFetch.mockResolvedValue({
        arrayBuffer: vi.fn().mockResolvedValue(fakeVideoBuffer.buffer),
      });
    });

    it("calls client.videos.create with model 'sora-2'", async () => {
      await provider.generateVideo({
        prompt: "a flying bird",
        duration: 5,
        aspectRatio: "16:9",
        resolution: "720p",
      });

      expect(mockVideosCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: "sora-2" }),
      );
    });

    it("calls client.videos.create with prompt and duration", async () => {
      await provider.generateVideo({
        prompt: "a flying bird",
        duration: 5,
        aspectRatio: "16:9",
        resolution: "720p",
      });

      expect(mockVideosCreate).toHaveBeenCalledWith(
        expect.objectContaining({ prompt: "a flying bird", duration: 5 }),
      );
    });

    it("polls for completion using pollForCompletion", async () => {
      await provider.generateVideo({
        prompt: "a flying bird",
        duration: 5,
        aspectRatio: "16:9",
        resolution: "720p",
      });

      expect(mockPollForCompletion).toHaveBeenCalledTimes(1);
    });

    it("downloads video from URL and returns GeneratedMedia with mimeType 'video/mp4'", async () => {
      const result = await provider.generateVideo({
        prompt: "a flying bird",
        duration: 5,
        aspectRatio: "16:9",
        resolution: "720p",
      });

      expect(mockFetch).toHaveBeenCalledWith(fakeVideoUrl);
      expect(result.mimeType).toBe("video/mp4");
      expect(result.data).toBeInstanceOf(Buffer);
    });

    it("returns GeneratedMedia with correct metadata", async () => {
      const result = await provider.generateVideo({
        prompt: "a flying bird",
        duration: 5,
        aspectRatio: "16:9",
        resolution: "720p",
      });

      expect(result.metadata).toMatchObject({
        model: "sora-2",
        provider: "openai",
        jobId: fakeJobId,
      });
    });

    it("handles poll timeout gracefully", async () => {
      mockPollForCompletion.mockRejectedValue(new Error("Generation timed out after 600 seconds"));

      await expect(
        provider.generateVideo({
          prompt: "a flying bird",
          duration: 5,
          aspectRatio: "16:9",
          resolution: "720p",
        }),
      ).rejects.toThrow(/timed out/i);
    });
  });

  describe("generateAudio", () => {
    const fakeAudioData = new Uint8Array([1, 2, 3, 4]).buffer;

    beforeEach(() => {
      mockAudioSpeechCreate.mockResolvedValue({
        arrayBuffer: vi.fn().mockResolvedValue(fakeAudioData),
      });
    });

    it("calls client.audio.speech.create with model 'tts-1'", async () => {
      await provider.generateAudio({ text: "Hello world" });

      expect(mockAudioSpeechCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: "tts-1" }),
      );
    });

    it("calls client.audio.speech.create with the given text as input", async () => {
      await provider.generateAudio({ text: "Hello world" });

      expect(mockAudioSpeechCreate).toHaveBeenCalledWith(
        expect.objectContaining({ input: "Hello world" }),
      );
    });

    it("defaults voice to 'alloy' when not specified", async () => {
      await provider.generateAudio({ text: "Hello world" });

      expect(mockAudioSpeechCreate).toHaveBeenCalledWith(
        expect.objectContaining({ voice: "alloy" }),
      );
    });

    it("defaults format to 'mp3' when not specified", async () => {
      await provider.generateAudio({ text: "Hello world" });

      expect(mockAudioSpeechCreate).toHaveBeenCalledWith(
        expect.objectContaining({ response_format: "mp3" }),
      );
    });

    it("defaults speed to 1.0 when not specified", async () => {
      await provider.generateAudio({ text: "Hello world" });

      expect(mockAudioSpeechCreate).toHaveBeenCalledWith(
        expect.objectContaining({ speed: 1.0 }),
      );
    });

    it("uses specified voice, format, and speed", async () => {
      await provider.generateAudio({ text: "Hello world", voice: "nova", format: "wav", speed: 1.5 });

      expect(mockAudioSpeechCreate).toHaveBeenCalledWith(
        expect.objectContaining({ voice: "nova", response_format: "wav", speed: 1.5 }),
      );
    });

    it("returns GeneratedMedia with buffer from response", async () => {
      const result = await provider.generateAudio({ text: "Hello world" });

      expect(result.data).toBeInstanceOf(Buffer);
      expect(result.data).toEqual(Buffer.from(fakeAudioData));
    });

    it("returns correct mimeType for mp3 format", async () => {
      const result = await provider.generateAudio({ text: "Hello world", format: "mp3" });

      expect(result.mimeType).toBe("audio/mpeg");
    });

    it("returns correct mimeType for wav format", async () => {
      const result = await provider.generateAudio({ text: "Hello world", format: "wav" });

      expect(result.mimeType).toBe("audio/wav");
    });

    it("passes providerOptions spread into API call", async () => {
      await provider.generateAudio({ text: "Hello world", providerOptions: { speed: 0.8 } });

      expect(mockAudioSpeechCreate).toHaveBeenCalledWith(
        expect.objectContaining({ speed: 0.8 }),
      );
    });

    it("throws on API error", async () => {
      const error = new Error("500 Internal Server Error");
      mockAudioSpeechCreate.mockRejectedValue(error);

      await expect(provider.generateAudio({ text: "Hello world" })).rejects.toThrow(
        "500 Internal Server Error",
      );
    });
  });
});
