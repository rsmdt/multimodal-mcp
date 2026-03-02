import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Hoist mocks so they're available in vi.mock factory
const { mockImagesGenerate, MockOpenAI, capturedOpenAIOptions } = vi.hoisted(() => {
  const mockImagesGenerate = vi.fn();
  const capturedOpenAIOptions: unknown[] = [];
  // Must use function keyword — arrow functions cannot be constructors
  const MockOpenAI = vi.fn(function (options: unknown) {
    capturedOpenAIOptions.push(options);
    (this as { images: unknown }).images = { generate: mockImagesGenerate };
  });
  return { mockImagesGenerate, MockOpenAI, capturedOpenAIOptions };
});

vi.mock("openai", () => ({ default: MockOpenAI }));

import { XAIProvider } from "../../src/providers/xai.js";

const API_KEY = "test-xai-key";

function makeJsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
  } as unknown as Response;
}

function makeVideoResponse(buffer: ArrayBuffer): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    arrayBuffer: () => Promise.resolve(buffer),
  } as unknown as Response;
}

describe("XAIProvider", () => {
  let provider: XAIProvider;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    capturedOpenAIOptions.length = 0;
    mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);
    provider = new XAIProvider(API_KEY);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("constructor", () => {
    it("creates OpenAI client with xAI baseURL", () => {
      expect(MockOpenAI).toHaveBeenCalledWith({
        apiKey: API_KEY,
        baseURL: "https://api.x.ai/v1",
      });
    });

    it("sets name to 'xai'", () => {
      expect(provider.name).toBe("xai");
    });

    it("declares image and video capabilities", () => {
      expect(provider.capabilities.supportsImageGeneration).toBe(true);
      expect(provider.capabilities.supportsVideoGeneration).toBe(true);
    });

    it("declares no audio generation capability", () => {
      expect(provider.capabilities.supportsAudioGeneration).toBe(false);
      expect(provider.capabilities.supportedAudioFormats).toEqual([]);
    });

    it("exposes supported aspect ratios and resolutions", () => {
      expect(provider.capabilities.supportedImageAspectRatios).toContain("1:1");
      expect(provider.capabilities.supportedImageAspectRatios).toContain("16:9");
      expect(provider.capabilities.supportedVideoAspectRatios).toContain("16:9");
      expect(provider.capabilities.supportedVideoResolutions).toContain("720p");
      expect(provider.capabilities.maxVideoDurationSeconds).toBeGreaterThan(0);
    });
  });

  describe("generateImage()", () => {
    const imageParams = {
      prompt: "a cat on the moon",
      aspectRatio: "1:1",
      quality: "standard",
    };

    beforeEach(() => {
      mockImagesGenerate.mockResolvedValue({
        data: [{ b64_json: Buffer.from("fake-image-bytes").toString("base64") }],
      });
    });

    it("calls client.images.generate with correct model", async () => {
      await provider.generateImage(imageParams);
      expect(mockImagesGenerate).toHaveBeenCalledWith(
        expect.objectContaining({ model: "grok-imagine-image" }),
      );
    });

    it("passes prompt to images.generate", async () => {
      await provider.generateImage(imageParams);
      expect(mockImagesGenerate).toHaveBeenCalledWith(
        expect.objectContaining({ prompt: "a cat on the moon" }),
      );
    });

    it("requests b64_json response format", async () => {
      await provider.generateImage(imageParams);
      expect(mockImagesGenerate).toHaveBeenCalledWith(
        expect.objectContaining({ response_format: "b64_json" }),
      );
    });

    it("returns GeneratedMedia with Buffer decoded from b64_json", async () => {
      const result = await provider.generateImage(imageParams);
      expect(result.data).toBeInstanceOf(Buffer);
      expect(result.data.toString()).toBe("fake-image-bytes");
    });

    it("returns mimeType image/png", async () => {
      const result = await provider.generateImage(imageParams);
      expect(result.mimeType).toBe("image/png");
    });

    it("includes provider metadata", async () => {
      const result = await provider.generateImage(imageParams);
      expect(result.metadata).toMatchObject({ provider: "xai" });
    });

    it("forwards providerOptions to images.generate", async () => {
      await provider.generateImage({ ...imageParams, providerOptions: { n: 2 } });
      expect(mockImagesGenerate).toHaveBeenCalledWith(
        expect.objectContaining({ n: 2 }),
      );
    });

    it("throws when API call fails", async () => {
      mockImagesGenerate.mockRejectedValue(new Error("API error"));
      await expect(provider.generateImage(imageParams)).rejects.toThrow("API error");
    });
  });

  describe("generateVideo()", () => {
    const videoParams = {
      prompt: "a sunset timelapse",
      duration: 5,
      aspectRatio: "16:9",
      resolution: "720p",
    };

    const videoBuffer = new Uint8Array([1, 2, 3, 4]).buffer;

    function setupSuccessfulVideoFlow(requestId = "req-abc-123"): void {
      mockFetch
        .mockResolvedValueOnce(
          makeJsonResponse({ request_id: requestId }),
        )
        .mockResolvedValueOnce(
          makeJsonResponse({ status: "done", video_url: "https://cdn.x.ai/video.mp4" }),
        )
        .mockResolvedValueOnce(makeVideoResponse(videoBuffer));
    }

    it("POSTs to https://api.x.ai/v1/videos/generations", async () => {
      setupSuccessfulVideoFlow();
      await provider.generateVideo(videoParams);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.x.ai/v1/videos/generations",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("includes Authorization header with API key in submit request", async () => {
      setupSuccessfulVideoFlow();
      await provider.generateVideo(videoParams);
      const [, submitOptions] = mockFetch.mock.calls[0];
      expect(submitOptions.headers).toMatchObject({
        Authorization: `Bearer ${API_KEY}`,
      });
    });

    it("sends prompt and params in request body", async () => {
      setupSuccessfulVideoFlow();
      await provider.generateVideo(videoParams);
      const [, submitOptions] = mockFetch.mock.calls[0];
      const body = JSON.parse(submitOptions.body as string);
      expect(body).toMatchObject({
        prompt: "a sunset timelapse",
        duration: 5,
        aspect_ratio: "16:9",
      });
    });

    it("polls status endpoint using request_id", async () => {
      setupSuccessfulVideoFlow("req-poll-test");
      await provider.generateVideo(videoParams);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.x.ai/v1/videos/generations/req-poll-test",
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: `Bearer ${API_KEY}` }),
        }),
      );
    });

    it("downloads video from result video_url", async () => {
      setupSuccessfulVideoFlow();
      await provider.generateVideo(videoParams);
      expect(mockFetch).toHaveBeenCalledWith("https://cdn.x.ai/video.mp4");
    });

    it("returns GeneratedMedia with Buffer from downloaded video", async () => {
      setupSuccessfulVideoFlow();
      const result = await provider.generateVideo(videoParams);
      expect(result.data).toBeInstanceOf(Buffer);
    });

    it("returns mimeType video/mp4", async () => {
      setupSuccessfulVideoFlow();
      const result = await provider.generateVideo(videoParams);
      expect(result.mimeType).toBe("video/mp4");
    });

    it("includes provider and requestId in metadata", async () => {
      setupSuccessfulVideoFlow("req-meta-check");
      const result = await provider.generateVideo(videoParams);
      expect(result.metadata).toMatchObject({
        provider: "xai",
        requestId: "req-meta-check",
      });
    });

    it("polls multiple times until status is 'done'", async () => {
      vi.useFakeTimers();
      try {
        const requestId = "req-multi-poll";
        mockFetch
          .mockResolvedValueOnce(makeJsonResponse({ request_id: requestId }))
          .mockResolvedValueOnce(makeJsonResponse({ status: "pending" }))
          .mockResolvedValueOnce(makeJsonResponse({ status: "processing" }))
          .mockResolvedValueOnce(makeJsonResponse({ status: "done", video_url: "https://cdn.x.ai/v.mp4" }))
          .mockResolvedValueOnce(makeVideoResponse(videoBuffer));

        const videoPromise = provider.generateVideo(videoParams);
        // Advance past the polling intervals (5s each, 2 waits needed)
        await vi.advanceTimersByTimeAsync(15_000);

        const result = await videoPromise;
        // submit + 3 polls + download = 5 fetch calls
        expect(mockFetch).toHaveBeenCalledTimes(5);
        expect(result.mimeType).toBe("video/mp4");
      } finally {
        vi.useRealTimers();
      }
    });

    it("throws when submit request fails with non-OK status", async () => {
      mockFetch.mockResolvedValueOnce(makeJsonResponse({ error: "bad request" }, false, 400));
      await expect(provider.generateVideo(videoParams)).rejects.toThrow(/xAI video generation failed/i);
    });

    it("includes status code in error message on failure", async () => {
      mockFetch.mockResolvedValueOnce(makeJsonResponse({}, false, 503));
      await expect(provider.generateVideo(videoParams)).rejects.toThrow("503");
    });
  });

  describe("generateAudio()", () => {
    const audioParams = {
      text: "a relaxing piano melody",
    };

    it("throws error indicating xAI does not support audio generation", async () => {
      await expect(provider.generateAudio(audioParams)).rejects.toThrow();
    });

    it("error message contains 'xAI does not support audio generation'", async () => {
      await expect(provider.generateAudio(audioParams)).rejects.toThrow(
        "xAI does not support audio generation",
      );
    });
  });
});
