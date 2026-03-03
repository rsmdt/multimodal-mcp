import { describe, it, expect, vi, beforeEach } from "vitest";
import { GoogleProvider } from "../../src/providers/google.js";

// Mock pollForCompletion to avoid actual polling in tests
vi.mock("../../src/providers/polling.js", () => ({
  pollForCompletion: vi.fn(),
}));

import { pollForCompletion } from "../../src/providers/polling.js";

const mockPollForCompletion = vi.mocked(pollForCompletion);

// Mock global fetch for all HTTP calls
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("GoogleProvider", () => {
  let provider: GoogleProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new GoogleProvider("test-api-key");
  });

  describe("capabilities", () => {
    it("has name 'google'", () => {
      expect(provider.name).toBe("google");
    });

    it("supports image and video generation", () => {
      expect(provider.capabilities.supportsImageGeneration).toBe(true);
      expect(provider.capabilities.supportsVideoGeneration).toBe(true);
    });

    it("supports audio generation", () => {
      expect(provider.capabilities.supportsAudioGeneration).toBe(true);
    });

    it("supports expected audio formats", () => {
      expect(provider.capabilities.supportedAudioFormats).toContain("wav");
    });

    it("supports expected image aspect ratios", () => {
      expect(provider.capabilities.supportedImageAspectRatios).toContain("1:1");
      expect(provider.capabilities.supportedImageAspectRatios).toContain("16:9");
      expect(provider.capabilities.supportedImageAspectRatios).toContain("9:16");
    });

    it("supports expected video aspect ratios", () => {
      expect(provider.capabilities.supportedVideoAspectRatios).toContain("16:9");
      expect(provider.capabilities.supportedVideoAspectRatios).toContain("9:16");
    });

    it("supports expected video resolutions", () => {
      expect(provider.capabilities.supportedVideoResolutions).toContain("720p");
      expect(provider.capabilities.supportedVideoResolutions).toContain("1080p");
    });

    it("has maxVideoDurationSeconds of 8", () => {
      expect(provider.capabilities.maxVideoDurationSeconds).toBe(8);
    });
  });

  describe("generateImage", () => {
    const fakeImageBytes = Buffer.from("fake-image-data");
    const base64Data = fakeImageBytes.toString("base64");

    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          generatedImages: [{ image: { bytesBase64Encoded: base64Data } }],
        }),
      });
    });

    it("calls the Imagen 4 model endpoint", async () => {
      await provider.generateImage({ prompt: "a cat", aspectRatio: "1:1", quality: "standard" });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("imagen-4.0-generate-001:predict"),
        expect.any(Object),
      );
    });

    it("includes the API key in the URL", async () => {
      await provider.generateImage({ prompt: "a cat", aspectRatio: "1:1", quality: "standard" });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("key=test-api-key"),
        expect.any(Object),
      );
    });

    it("sends the prompt in instances array", async () => {
      await provider.generateImage({ prompt: "a cat", aspectRatio: "1:1", quality: "standard" });

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body as string);
      expect(body.instances).toEqual([{ prompt: "a cat" }]);
    });

    it("sends aspectRatio and sampleCount in parameters", async () => {
      await provider.generateImage({ prompt: "a cat", aspectRatio: "16:9", quality: "standard" });

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body as string);
      expect(body.parameters.aspectRatio).toBe("16:9");
      expect(body.parameters.sampleCount).toBe(1);
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

    it("returns metadata with model and provider", async () => {
      const result = await provider.generateImage({
        prompt: "a cat",
        aspectRatio: "1:1",
        quality: "standard",
      });

      expect(result.metadata).toMatchObject({ model: "imagen-4.0-generate-001", provider: "google" });
    });

    it("throws on HTTP error response", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: vi.fn(),
      });

      await expect(
        provider.generateImage({ prompt: "a cat", aspectRatio: "1:1", quality: "standard" }),
      ).rejects.toThrow("Google image generation failed: 401");
    });
  });

  describe("generateVideo", () => {
    const fakeOperationName = "operations/abc-123";
    const fakeVideoUri = "https://storage.googleapis.com/bucket/video.mp4";
    const fakeVideoBuffer = Buffer.from("fake-video-data");

    beforeEach(() => {
      // First fetch: submit long-running operation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ name: fakeOperationName }),
      });

      // pollForCompletion resolves with done operation
      mockPollForCompletion.mockResolvedValue({
        done: true,
        response: { videos: [{ uri: fakeVideoUri }] },
      });

      // Second fetch: download video
      mockFetch.mockResolvedValueOnce({
        arrayBuffer: vi.fn().mockResolvedValue(fakeVideoBuffer.buffer),
      });
    });

    it("calls the Veo 3.1 predictLongRunning endpoint", async () => {
      await provider.generateVideo({
        prompt: "a flying bird",
        duration: 5,
        aspectRatio: "16:9",
        resolution: "720p",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("veo-3.1-generate-preview:predictLongRunning"),
        expect.any(Object),
      );
    });

    it("includes the API key in the submit URL", async () => {
      await provider.generateVideo({
        prompt: "a flying bird",
        duration: 5,
        aspectRatio: "16:9",
        resolution: "720p",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("key=test-api-key"),
        expect.any(Object),
      );
    });

    it("sends prompt in instances and duration in parameters", async () => {
      await provider.generateVideo({
        prompt: "a flying bird",
        duration: 5,
        aspectRatio: "16:9",
        resolution: "720p",
      });

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body as string);
      expect(body.instances[0].prompt).toBe("a flying bird");
      expect(body.parameters.durationSeconds).toBe(5);
      expect(body.parameters.aspectRatio).toBe("16:9");
    });

    it("polls for operation completion using pollForCompletion", async () => {
      await provider.generateVideo({
        prompt: "a flying bird",
        duration: 5,
        aspectRatio: "16:9",
        resolution: "720p",
      });

      expect(mockPollForCompletion).toHaveBeenCalledTimes(1);
    });

    it("polls the correct operation status endpoint", async () => {
      await provider.generateVideo({
        prompt: "a flying bird",
        duration: 5,
        aspectRatio: "16:9",
        resolution: "720p",
      });

      // Invoke the checkStatus callback passed to pollForCompletion
      const checkStatusFn = mockPollForCompletion.mock.calls[0][0];
      mockFetch.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue({ done: false }),
      });
      await checkStatusFn();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(fakeOperationName),
      );
    });

    it("downloads video from URI immediately after completion", async () => {
      await provider.generateVideo({
        prompt: "a flying bird",
        duration: 5,
        aspectRatio: "16:9",
        resolution: "720p",
      });

      expect(mockFetch).toHaveBeenCalledWith(fakeVideoUri);
    });

    it("returns GeneratedMedia with mimeType 'video/mp4'", async () => {
      const result = await provider.generateVideo({
        prompt: "a flying bird",
        duration: 5,
        aspectRatio: "16:9",
        resolution: "720p",
      });

      expect(result.mimeType).toBe("video/mp4");
    });

    it("returns GeneratedMedia with video buffer", async () => {
      const result = await provider.generateVideo({
        prompt: "a flying bird",
        duration: 5,
        aspectRatio: "16:9",
        resolution: "720p",
      });

      expect(result.data).toBeInstanceOf(Buffer);
    });

    it("returns metadata with model, provider, and operationName", async () => {
      const result = await provider.generateVideo({
        prompt: "a flying bird",
        duration: 5,
        aspectRatio: "16:9",
        resolution: "720p",
      });

      expect(result.metadata).toMatchObject({
        model: "veo-3.1-generate-preview",
        provider: "google",
        operationName: fakeOperationName,
      });
    });

    it("throws on HTTP error when submitting video request", async () => {
      mockFetch.mockReset();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: vi.fn(),
      });

      await expect(
        provider.generateVideo({
          prompt: "a flying bird",
          duration: 5,
          aspectRatio: "16:9",
          resolution: "720p",
        }),
      ).rejects.toThrow("Google video generation failed: 403");
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
    const fakeAudioBytes = Buffer.from("fake-audio-data");
    const base64Data = fakeAudioBytes.toString("base64");

    const successResponse = () => ({
      ok: true,
      json: vi.fn().mockResolvedValue({
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    mimeType: "audio/wav",
                    data: base64Data,
                  },
                },
              ],
            },
          },
        ],
      }),
    });

    beforeEach(() => {
      mockFetch.mockReset();
      mockFetch.mockResolvedValue(successResponse());
    });

    it("calls Gemini TTS endpoint with correct URL containing model name", async () => {
      await provider.generateAudio({ text: "Hello world" });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("gemini-2.5-flash-preview-tts"),
        expect.any(Object),
      );
    });

    it("sends text in contents.parts format", async () => {
      await provider.generateAudio({ text: "Hello world" });

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body as string);
      expect(body.contents).toEqual([{ parts: [{ text: "Hello world" }] }]);
    });

    it("defaults voice to 'Kore' when not specified", async () => {
      await provider.generateAudio({ text: "Hello world" });

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body as string);
      expect(
        body.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName,
      ).toBe("Kore");
    });

    it("uses specified voice name", async () => {
      await provider.generateAudio({ text: "Hello world", voice: "Puck" });

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body as string);
      expect(
        body.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName,
      ).toBe("Puck");
    });

    it("sends responseModalities: ['AUDIO'] in generationConfig", async () => {
      await provider.generateAudio({ text: "Hello world" });

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body as string);
      expect(body.generationConfig.responseModalities).toEqual(["AUDIO"]);
    });

    it("returns GeneratedMedia with decoded base64 audio data", async () => {
      const result = await provider.generateAudio({ text: "Hello world" });

      expect(result.data).toBeInstanceOf(Buffer);
      expect(result.data.toString()).toBe("fake-audio-data");
    });

    it("returns mimeType from response inlineData", async () => {
      const result = await provider.generateAudio({ text: "Hello world" });

      expect(result.mimeType).toBe("audio/wav");
    });

    it("defaults mimeType to audio/wav when not in response", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      data: base64Data,
                    },
                  },
                ],
              },
            },
          ],
        }),
      });

      const result = await provider.generateAudio({ text: "Hello world" });

      expect(result.mimeType).toBe("audio/wav");
    });

    it("passes providerOptions spread into generationConfig", async () => {
      await provider.generateAudio({
        text: "Hello world",
        providerOptions: { temperature: 0.5, topK: 10 },
      });

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body as string);
      expect(body.generationConfig.temperature).toBe(0.5);
      expect(body.generationConfig.topK).toBe(10);
    });

    it("throws on HTTP error (403)", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        json: vi.fn(),
      });

      await expect(provider.generateAudio({ text: "Hello world" })).rejects.toThrow(
        "Google audio generation failed: 403",
      );
    });

    it("throws when response contains no audio data", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          candidates: [
            {
              content: {
                parts: [{ text: "some text but no audio" }],
              },
            },
          ],
        }),
      });

      await expect(provider.generateAudio({ text: "Hello world" })).rejects.toThrow(
        "Google audio generation returned no audio data",
      );
    });
  });
});
