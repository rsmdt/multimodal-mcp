import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ElevenLabsProvider } from "../../src/providers/elevenlabs.js";

const API_KEY = "test-elevenlabs-key";

function makeAudioResponse(ok = true, status = 200): Response {
  const buffer = new Uint8Array([1, 2, 3, 4]).buffer;
  return {
    ok,
    status,
    arrayBuffer: () => Promise.resolve(buffer),
    json: () => Promise.resolve({}),
  } as unknown as Response;
}

function makeJsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
  } as unknown as Response;
}

describe("ElevenLabsProvider", () => {
  let provider: ElevenLabsProvider;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);
    provider = new ElevenLabsProvider(API_KEY);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("constructor", () => {
    it("sets name to 'elevenlabs'", () => {
      expect(provider.name).toBe("elevenlabs");
    });

    it("declares audio generation capability", () => {
      expect(provider.capabilities.supportsAudioGeneration).toBe(true);
    });

    it("declares transcription capability", () => {
      expect(provider.capabilities.supportsTranscription).toBe(true);
    });

    it("does not support image generation", () => {
      expect(provider.capabilities.supportsImageGeneration).toBe(false);
    });

    it("does not support image editing", () => {
      expect(provider.capabilities.supportsImageEditing).toBe(false);
    });

    it("does not support video generation", () => {
      expect(provider.capabilities.supportsVideoGeneration).toBe(false);
    });

    it("lists supported audio formats", () => {
      expect(provider.capabilities.supportedAudioFormats).toEqual(["mp3", "pcm", "ulaw", "opus"]);
    });

    it("has empty aspect ratio and resolution lists", () => {
      expect(provider.capabilities.supportedImageAspectRatios).toEqual([]);
      expect(provider.capabilities.supportedVideoAspectRatios).toEqual([]);
      expect(provider.capabilities.supportedVideoResolutions).toEqual([]);
    });

    it("has maxVideoDurationSeconds of 0", () => {
      expect(provider.capabilities.maxVideoDurationSeconds).toBe(0);
    });
  });

  describe("generateAudio() - TTS mode (default)", () => {
    const audioParams = { text: "Hello world" };

    beforeEach(() => {
      mockFetch.mockResolvedValue(makeAudioResponse());
    });

    it("POSTs to text-to-speech endpoint with default voice", async () => {
      await provider.generateAudio(audioParams);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.elevenlabs.io/v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("uses provided voice in URL when specified", async () => {
      await provider.generateAudio({ ...audioParams, voice: "custom-voice-id" });
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.elevenlabs.io/v1/text-to-speech/custom-voice-id",
        expect.any(Object),
      );
    });

    it("includes xi-api-key header", async () => {
      await provider.generateAudio(audioParams);
      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers).toMatchObject({ "xi-api-key": API_KEY });
    });

    it("sends text and default model in request body", async () => {
      await provider.generateAudio(audioParams);
      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body as string);
      expect(body).toMatchObject({ text: "Hello world", model_id: "eleven_flash_v2_5" });
    });

    it("uses model from providerOptions when specified", async () => {
      await provider.generateAudio({ ...audioParams, providerOptions: { model: "custom-model" } });
      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body as string);
      expect(body.model_id).toBe("custom-model");
    });

    it("returns Buffer from response arrayBuffer", async () => {
      const result = await provider.generateAudio(audioParams);
      expect(result.data).toBeInstanceOf(Buffer);
    });

    it("returns mimeType audio/mpeg", async () => {
      const result = await provider.generateAudio(audioParams);
      expect(result.mimeType).toBe("audio/mpeg");
    });

    it("includes provider metadata", async () => {
      const result = await provider.generateAudio(audioParams);
      expect(result.metadata).toMatchObject({ provider: "elevenlabs" });
    });
  });

  describe("generateAudio() - sound-effect mode", () => {
    const audioParams = {
      text: "explosion sound",
      providerOptions: { mode: "sound-effect" },
    };

    beforeEach(() => {
      mockFetch.mockResolvedValue(makeAudioResponse());
    });

    it("POSTs to text-to-sound-effects endpoint", async () => {
      await provider.generateAudio(audioParams);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.elevenlabs.io/v1/sound-generation",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("sends text in request body", async () => {
      await provider.generateAudio(audioParams);
      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body as string);
      expect(body.text).toBe("explosion sound");
    });

    it("does not include mode in request body", async () => {
      await provider.generateAudio(audioParams);
      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body as string);
      expect(body).not.toHaveProperty("mode");
    });

    it("returns mimeType audio/mpeg", async () => {
      const result = await provider.generateAudio(audioParams);
      expect(result.mimeType).toBe("audio/mpeg");
    });
  });

  describe("generateAudio() - providerOptions passthrough", () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue(makeAudioResponse());
    });

    it("spreads extra providerOptions into TTS body excluding mode and model", async () => {
      await provider.generateAudio({
        text: "test",
        providerOptions: { mode: "tts", model: "custom-m", stability: 0.5, similarity_boost: 0.8 },
      });
      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body as string);
      expect(body.stability).toBe(0.5);
      expect(body.similarity_boost).toBe(0.8);
      expect(body).not.toHaveProperty("mode");
      expect(body).not.toHaveProperty("model");
    });

    it("spreads extra providerOptions into sound-effect body excluding mode", async () => {
      await provider.generateAudio({
        text: "test",
        providerOptions: { mode: "sound-effect", duration_seconds: 3 },
      });
      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body as string);
      expect(body.duration_seconds).toBe(3);
      expect(body).not.toHaveProperty("mode");
    });
  });

  describe("transcribeAudio()", () => {
    const transcribeParams = {
      audioData: Buffer.from("fake-audio"),
      audioMimeType: "audio/mpeg",
    };

    beforeEach(() => {
      mockFetch.mockResolvedValue(makeJsonResponse({ text: "Hello from transcription" }));
    });

    it("POSTs to speech-to-text endpoint", async () => {
      await provider.transcribeAudio!(transcribeParams);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.elevenlabs.io/v1/speech-to-text",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("sends FormData in request body", async () => {
      await provider.transcribeAudio!(transcribeParams);
      const [, options] = mockFetch.mock.calls[0];
      expect(options.body).toBeInstanceOf(FormData);
    });

    it("returns transcribed text", async () => {
      const result = await provider.transcribeAudio!(transcribeParams);
      expect(result.text).toBe("Hello from transcription");
    });

    it("includes provider metadata", async () => {
      const result = await provider.transcribeAudio!(transcribeParams);
      expect(result.metadata).toMatchObject({ provider: "elevenlabs", model: "scribe_v2" });
    });

    it("appends language_code when language is provided", async () => {
      await provider.transcribeAudio!({ ...transcribeParams, language: "fr" });
      const [, options] = mockFetch.mock.calls[0];
      const formData = options.body as FormData;
      expect(formData.get("language_code")).toBe("fr");
    });

    it("does not append language_code when language is not provided", async () => {
      await provider.transcribeAudio!(transcribeParams);
      const [, options] = mockFetch.mock.calls[0];
      const formData = options.body as FormData;
      expect(formData.get("language_code")).toBeNull();
    });
  });

  describe("unsupported methods", () => {
    it("generateImage() throws unsupported error", async () => {
      await expect(
        provider.generateImage({ prompt: "test", aspectRatio: "1:1", quality: "standard" }),
      ).rejects.toThrow("ElevenLabs does not support image generation");
    });

    it("editImage() throws unsupported error", async () => {
      await expect(
        provider.editImage({ imageData: Buffer.from(""), imageMimeType: "image/png", prompt: "test" }),
      ).rejects.toThrow("ElevenLabs does not support image editing");
    });

    it("generateVideo() throws unsupported error", async () => {
      await expect(
        provider.generateVideo({ prompt: "test", duration: 5, aspectRatio: "16:9", resolution: "720p" }),
      ).rejects.toThrow("ElevenLabs does not support video generation");
    });
  });

  describe("error handling", () => {
    it("generateAudio throws when response is not OK", async () => {
      mockFetch.mockResolvedValue(makeAudioResponse(false, 401));
      await expect(provider.generateAudio({ text: "test" })).rejects.toThrow("401");
    });

    it("transcribeAudio throws when response is not OK", async () => {
      mockFetch.mockResolvedValue(makeJsonResponse({}, false, 500));
      await expect(
        provider.transcribeAudio!({ audioData: Buffer.from(""), audioMimeType: "audio/mpeg" }),
      ).rejects.toThrow("500");
    });
  });
});
