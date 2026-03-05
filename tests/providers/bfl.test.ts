import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BFLProvider } from "../../src/providers/bfl.js";

const API_KEY = "test-bfl-key";
const BASE_URL = "https://api.bfl.ai/v1";
const POLLING_URL = "https://api.bfl.ai/v1/get_result?id=task-123";

function makeJsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    headers: { get: (_name: string) => null },
    json: () => Promise.resolve(body),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
  } as unknown as Response;
}

function makeImageDownloadResponse(buffer: ArrayBuffer, contentType = "image/jpeg"): Response {
  return {
    ok: true,
    status: 200,
    headers: { get: (name: string) => name === "content-type" ? contentType : null },
    json: () => Promise.resolve({}),
    arrayBuffer: () => Promise.resolve(buffer),
  } as unknown as Response;
}

describe("BFLProvider", () => {
  let provider: BFLProvider;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);
    provider = new BFLProvider(API_KEY);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("constructor", () => {
    it("sets name to 'bfl'", () => {
      expect(provider.name).toBe("bfl");
    });

    it("declares image generation capability", () => {
      expect(provider.capabilities.supportsImageGeneration).toBe(true);
    });

    it("declares image editing capability", () => {
      expect(provider.capabilities.supportsImageEditing).toBe(true);
    });

    it("declares no video generation capability", () => {
      expect(provider.capabilities.supportsVideoGeneration).toBe(false);
    });

    it("declares no audio generation capability", () => {
      expect(provider.capabilities.supportsAudioGeneration).toBe(false);
    });

    it("declares no transcription capability", () => {
      expect(provider.capabilities.supportsTranscription).toBe(false);
    });

    it("exposes all 5 supported image aspect ratios", () => {
      const ratios = provider.capabilities.supportedImageAspectRatios;
      expect(ratios).toContain("1:1");
      expect(ratios).toContain("16:9");
      expect(ratios).toContain("9:16");
      expect(ratios).toContain("4:3");
      expect(ratios).toContain("3:4");
      expect(ratios).toHaveLength(5);
    });

    it("has empty video and audio fields", () => {
      expect(provider.capabilities.supportedVideoAspectRatios).toEqual([]);
      expect(provider.capabilities.supportedVideoResolutions).toEqual([]);
      expect(provider.capabilities.supportedAudioFormats).toEqual([]);
      expect(provider.capabilities.maxVideoDurationSeconds).toBe(0);
    });
  });

  describe("generateImage()", () => {
    const imageParams = {
      prompt: "a neon city at night",
      aspectRatio: "1:1",
      quality: "standard",
    };

    const imageBuffer = new Uint8Array([10, 20, 30]).buffer;

    function setupSuccessfulFlow(pollingUrl = POLLING_URL): void {
      mockFetch
        .mockResolvedValueOnce(makeJsonResponse({ id: "task-123", polling_url: pollingUrl }))
        .mockResolvedValueOnce(makeJsonResponse({ status: "Ready", result: { sample: "https://cdn.bfl.ai/img.jpg" } }))
        .mockResolvedValueOnce(makeImageDownloadResponse(imageBuffer));
    }

    it("POSTs to flux-pro-1.1 endpoint", async () => {
      setupSuccessfulFlow();
      await provider.generateImage(imageParams);
      expect(mockFetch).toHaveBeenCalledWith(
        `${BASE_URL}/flux-pro-1.1`,
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("includes x-key auth header in submit request", async () => {
      setupSuccessfulFlow();
      await provider.generateImage(imageParams);
      const [, submitOptions] = mockFetch.mock.calls[0];
      expect(submitOptions.headers).toMatchObject({ "x-key": API_KEY });
    });

    it("sends prompt in request body", async () => {
      setupSuccessfulFlow();
      await provider.generateImage(imageParams);
      const [, submitOptions] = mockFetch.mock.calls[0];
      const body = JSON.parse(submitOptions.body as string);
      expect(body.prompt).toBe("a neon city at night");
    });

    it("maps 1:1 aspect ratio to 1024x1024", async () => {
      setupSuccessfulFlow();
      await provider.generateImage(imageParams);
      const [, submitOptions] = mockFetch.mock.calls[0];
      const body = JSON.parse(submitOptions.body as string);
      expect(body.width).toBe(1024);
      expect(body.height).toBe(1024);
    });

    it("polls using polling_url from submit response", async () => {
      const pollingUrl = "https://api.bfl.ai/v1/get_result?id=custom-poll";
      setupSuccessfulFlow(pollingUrl);
      await provider.generateImage(imageParams);
      expect(mockFetch).toHaveBeenCalledWith(
        pollingUrl,
        expect.anything(),
      );
    });

    it("downloads image from result.sample URL", async () => {
      setupSuccessfulFlow();
      await provider.generateImage(imageParams);
      expect(mockFetch).toHaveBeenCalledWith("https://cdn.bfl.ai/img.jpg");
    });

    it("returns GeneratedMedia with Buffer", async () => {
      setupSuccessfulFlow();
      const result = await provider.generateImage(imageParams);
      expect(result.data).toBeInstanceOf(Buffer);
    });

    it("detects mimeType from Content-Type header", async () => {
      setupSuccessfulFlow();
      const result = await provider.generateImage(imageParams);
      expect(result.mimeType).toBe("image/jpeg");
    });

    it("falls back to image/png when Content-Type is missing", async () => {
      mockFetch
        .mockResolvedValueOnce(makeJsonResponse({ id: "task-1", polling_url: POLLING_URL }))
        .mockResolvedValueOnce(makeJsonResponse({ status: "Ready", result: { sample: "https://cdn.bfl.ai/img.jpg" } }))
        .mockResolvedValueOnce(makeJsonResponse({}, true, 200));
      const result = await provider.generateImage(imageParams);
      expect(result.mimeType).toBe("image/png");
    });

    it("includes provider metadata", async () => {
      setupSuccessfulFlow();
      const result = await provider.generateImage(imageParams);
      expect(result.metadata).toMatchObject({ provider: "bfl" });
    });

    it("uses custom model from providerOptions", async () => {
      setupSuccessfulFlow();
      await provider.generateImage({ ...imageParams, providerOptions: { model: "flux-pro-1.1-ultra" } });
      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe(`${BASE_URL}/flux-pro-1.1-ultra`);
    });

    it("does not include model in request body", async () => {
      setupSuccessfulFlow();
      await provider.generateImage({ ...imageParams, providerOptions: { model: "flux-pro-1.1-ultra", seed: 42 } });
      const [, submitOptions] = mockFetch.mock.calls[0];
      const body = JSON.parse(submitOptions.body as string);
      expect(body).not.toHaveProperty("model");
      expect(body.seed).toBe(42);
    });

    it("throws for unknown model", async () => {
      await expect(
        provider.generateImage({ ...imageParams, providerOptions: { model: "unknown-model" } }),
      ).rejects.toThrow("Unknown BFL model");
    });

    it("throws when submit response is not OK", async () => {
      mockFetch.mockResolvedValueOnce(makeJsonResponse({ error: "unauthorized" }, false, 401));
      await expect(provider.generateImage(imageParams)).rejects.toThrow("401");
    });

    it("throws when download response is not OK", async () => {
      mockFetch
        .mockResolvedValueOnce(makeJsonResponse({ id: "task-1", polling_url: POLLING_URL }))
        .mockResolvedValueOnce(makeJsonResponse({ status: "Ready", result: { sample: "https://cdn.bfl.ai/img.jpg" } }))
        .mockResolvedValueOnce({ ok: false, status: 403, headers: { get: () => null } } as unknown as Response);
      await expect(provider.generateImage(imageParams)).rejects.toThrow("403");
    });

    it("rejects download from unexpected host", async () => {
      mockFetch
        .mockResolvedValueOnce(makeJsonResponse({ id: "task-1", polling_url: POLLING_URL }))
        .mockResolvedValueOnce(makeJsonResponse({ status: "Ready", result: { sample: "https://evil.com/img.jpg" } }));
      await expect(provider.generateImage(imageParams)).rejects.toThrow("Unexpected BFL download host");
    });

    it("rejects polling_url from unexpected host", async () => {
      mockFetch.mockResolvedValueOnce(
        makeJsonResponse({ id: "task-1", polling_url: "https://evil.com/poll" }),
      );
      await expect(provider.generateImage(imageParams)).rejects.toThrow("Unexpected BFL polling host");
    });

    it("throws when Ready status has no result sample", async () => {
      mockFetch
        .mockResolvedValueOnce(makeJsonResponse({ id: "task-1", polling_url: POLLING_URL }))
        .mockResolvedValueOnce(makeJsonResponse({ status: "Ready" }));
      await expect(provider.generateImage(imageParams)).rejects.toThrow("BFL returned Ready status with no result sample");
    });
  });

  describe("generateImage() aspect ratio mapping", () => {
    const imageBuffer = new Uint8Array([1]).buffer;

    function setupFlow(): void {
      mockFetch
        .mockResolvedValueOnce(makeJsonResponse({ id: "task-1", polling_url: POLLING_URL }))
        .mockResolvedValueOnce(makeJsonResponse({ status: "Ready", result: { sample: "https://cdn.bfl.ai/img.jpg" } }))
        .mockResolvedValueOnce(makeImageDownloadResponse(imageBuffer));
    }

    it("maps 16:9 to 1344x768", async () => {
      setupFlow();
      await provider.generateImage({ prompt: "test", aspectRatio: "16:9", quality: "standard" });
      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(body.width).toBe(1344);
      expect(body.height).toBe(768);
    });

    it("maps 9:16 to 768x1344", async () => {
      setupFlow();
      await provider.generateImage({ prompt: "test", aspectRatio: "9:16", quality: "standard" });
      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(body.width).toBe(768);
      expect(body.height).toBe(1344);
    });

    it("maps 4:3 to 1152x896", async () => {
      setupFlow();
      await provider.generateImage({ prompt: "test", aspectRatio: "4:3", quality: "standard" });
      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(body.width).toBe(1152);
      expect(body.height).toBe(896);
    });

    it("maps 3:4 to 896x1152", async () => {
      setupFlow();
      await provider.generateImage({ prompt: "test", aspectRatio: "3:4", quality: "standard" });
      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(body.width).toBe(896);
      expect(body.height).toBe(1152);
    });

    it("throws for unsupported aspect ratio", async () => {
      await expect(
        provider.generateImage({ prompt: "test", aspectRatio: "2:1", quality: "standard" }),
      ).rejects.toThrow("does not support aspect ratio");
    });
  });

  describe("generateImage() polling", () => {
    const imageBuffer = new Uint8Array([1, 2, 3]).buffer;

    it("polls multiple times until status is Ready", async () => {
      vi.useFakeTimers();
      try {
        mockFetch
          .mockResolvedValueOnce(makeJsonResponse({ id: "task-multi-poll", polling_url: POLLING_URL }))
          .mockResolvedValueOnce(makeJsonResponse({ status: "Pending" }))
          .mockResolvedValueOnce(makeJsonResponse({ status: "Processing" }))
          .mockResolvedValueOnce(makeJsonResponse({ status: "Ready", result: { sample: "https://cdn.bfl.ai/img.jpg" } }))
          .mockResolvedValueOnce(makeImageDownloadResponse(imageBuffer));

        const imagePromise = provider.generateImage({ prompt: "test", aspectRatio: "1:1", quality: "standard" });
        await vi.advanceTimersByTimeAsync(9_000);

        const result = await imagePromise;
        // submit + 3 polls + download = 5 fetch calls
        expect(mockFetch).toHaveBeenCalledTimes(5);
        expect(result.data).toBeInstanceOf(Buffer);
      } finally {
        vi.useRealTimers();
      }
    });

    it("throws immediately when task status is Error", async () => {
      mockFetch
        .mockResolvedValueOnce(makeJsonResponse({ id: "task-err", polling_url: POLLING_URL }))
        .mockResolvedValueOnce(makeJsonResponse({ status: "Error" }));

      await expect(
        provider.generateImage({ prompt: "test", aspectRatio: "1:1", quality: "standard" }),
      ).rejects.toThrow("BFL task failed with status: Error");
    });

    it("throws immediately when task status is Failed", async () => {
      mockFetch
        .mockResolvedValueOnce(makeJsonResponse({ id: "task-fail", polling_url: POLLING_URL }))
        .mockResolvedValueOnce(makeJsonResponse({ status: "Failed" }));

      await expect(
        provider.generateImage({ prompt: "test", aspectRatio: "1:1", quality: "standard" }),
      ).rejects.toThrow("BFL task failed with status: Failed");
    });

    it("throws when poll response is not OK", async () => {
      mockFetch
        .mockResolvedValueOnce(makeJsonResponse({ id: "task-poll-err", polling_url: POLLING_URL }))
        .mockResolvedValueOnce(makeJsonResponse({}, false, 500));

      await expect(
        provider.generateImage({ prompt: "test", aspectRatio: "1:1", quality: "standard" }),
      ).rejects.toThrow("BFL poll failed: 500");
    });
  });

  describe("editImage()", () => {
    const imageData = Buffer.from("fake-image-bytes");
    const editParams = {
      imageData,
      imageMimeType: "image/png",
      prompt: "make it cinematic",
    };

    const imageBuffer = new Uint8Array([5, 6, 7]).buffer;

    function setupSuccessfulEditFlow(): void {
      mockFetch
        .mockResolvedValueOnce(makeJsonResponse({ id: "task-edit-123", polling_url: POLLING_URL }))
        .mockResolvedValueOnce(makeJsonResponse({ status: "Ready", result: { sample: "https://cdn.bfl.ai/edited.jpg" } }))
        .mockResolvedValueOnce(makeImageDownloadResponse(imageBuffer));
    }

    it("POSTs to flux-kontext-pro endpoint", async () => {
      setupSuccessfulEditFlow();
      await provider.editImage(editParams);
      expect(mockFetch).toHaveBeenCalledWith(
        `${BASE_URL}/flux-kontext-pro`,
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("includes x-key auth header", async () => {
      setupSuccessfulEditFlow();
      await provider.editImage(editParams);
      const [, submitOptions] = mockFetch.mock.calls[0];
      expect(submitOptions.headers).toMatchObject({ "x-key": API_KEY });
    });

    it("includes prompt in request body", async () => {
      setupSuccessfulEditFlow();
      await provider.editImage(editParams);
      const [, submitOptions] = mockFetch.mock.calls[0];
      const body = JSON.parse(submitOptions.body as string);
      expect(body.prompt).toBe("make it cinematic");
    });

    it("converts imageData to base64 and sends as input_image", async () => {
      setupSuccessfulEditFlow();
      await provider.editImage(editParams);
      const [, submitOptions] = mockFetch.mock.calls[0];
      const body = JSON.parse(submitOptions.body as string);
      expect(body.input_image).toBe(imageData.toString("base64"));
    });

    it("uses custom model from providerOptions", async () => {
      setupSuccessfulEditFlow();
      await provider.editImage({ ...editParams, providerOptions: { model: "flux-kontext-max" } });
      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe(`${BASE_URL}/flux-kontext-max`);
    });

    it("does not include model key in request body", async () => {
      setupSuccessfulEditFlow();
      await provider.editImage({ ...editParams, providerOptions: { model: "flux-kontext-max" } });
      const [, submitOptions] = mockFetch.mock.calls[0];
      const body = JSON.parse(submitOptions.body as string);
      expect(body).not.toHaveProperty("model");
    });

    it("returns GeneratedMedia with Buffer", async () => {
      setupSuccessfulEditFlow();
      const result = await provider.editImage(editParams);
      expect(result.data).toBeInstanceOf(Buffer);
    });

    it("includes provider metadata", async () => {
      setupSuccessfulEditFlow();
      const result = await provider.editImage(editParams);
      expect(result.metadata).toMatchObject({ provider: "bfl" });
    });

    it("throws for unknown model", async () => {
      await expect(
        provider.editImage({ ...editParams, providerOptions: { model: "unknown-model" } }),
      ).rejects.toThrow("Unknown BFL model");
    });

    it("throws when submit response is not OK", async () => {
      mockFetch.mockResolvedValueOnce(makeJsonResponse({ error: "bad request" }, false, 400));
      await expect(provider.editImage(editParams)).rejects.toThrow("400");
    });

    it("rejects download from unexpected host", async () => {
      mockFetch
        .mockResolvedValueOnce(makeJsonResponse({ id: "task-edit-1", polling_url: POLLING_URL }))
        .mockResolvedValueOnce(makeJsonResponse({ status: "Ready", result: { sample: "https://evil.com/edited.jpg" } }));
      await expect(provider.editImage(editParams)).rejects.toThrow("Unexpected BFL download host");
    });

    it("throws when poll returns Error status", async () => {
      mockFetch
        .mockResolvedValueOnce(makeJsonResponse({ id: "task-edit-err", polling_url: POLLING_URL }))
        .mockResolvedValueOnce(makeJsonResponse({ status: "Error" }));
      await expect(provider.editImage(editParams)).rejects.toThrow("BFL task failed with status: Error");
    });

    it("throws when poll returns Failed status", async () => {
      mockFetch
        .mockResolvedValueOnce(makeJsonResponse({ id: "task-edit-fail", polling_url: POLLING_URL }))
        .mockResolvedValueOnce(makeJsonResponse({ status: "Failed" }));
      await expect(provider.editImage(editParams)).rejects.toThrow("BFL task failed with status: Failed");
    });

    it("throws when poll response is not OK", async () => {
      mockFetch
        .mockResolvedValueOnce(makeJsonResponse({ id: "task-edit-poll", polling_url: POLLING_URL }))
        .mockResolvedValueOnce(makeJsonResponse({}, false, 500));
      await expect(provider.editImage(editParams)).rejects.toThrow("BFL poll failed: 500");
    });
  });

  describe("generateVideo()", () => {
    it("throws indicating BFL does not support video generation", async () => {
      await expect(
        provider.generateVideo({ prompt: "a flying dragon", duration: 5, aspectRatio: "16:9", resolution: "720p" }),
      ).rejects.toThrow(/BFL does not support video/i);
    });
  });

  describe("generateAudio()", () => {
    it("throws indicating BFL does not support audio generation", async () => {
      await expect(
        provider.generateAudio({ text: "hello world" }),
      ).rejects.toThrow(/BFL does not support audio/i);
    });
  });
});
