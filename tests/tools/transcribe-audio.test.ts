import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildTranscribeAudioHandler } from "../../src/tools/transcribe-audio.js";
import type { ProviderRegistry } from "../../src/providers/registry.js";
import type { MediaProvider, TranscribedText } from "../../src/providers/types.js";

const mockTranscribeAudio = vi.fn();

const makeTranscriptionProvider = (name: string, supportsTranscription: boolean): MediaProvider => ({
  name,
  capabilities: {
    supportsImageGeneration: false,
    supportsImageEditing: false,
    supportsVideoGeneration: false,
    supportsAudioGeneration: false,
    supportsTranscription,
    supportedImageAspectRatios: [],
    supportedVideoAspectRatios: [],
    supportedVideoResolutions: [],
    supportedAudioFormats: [],
    maxVideoDurationSeconds: 0,
  },
  generateImage: vi.fn(),
  editImage: vi.fn(),
  generateVideo: vi.fn(),
  generateAudio: vi.fn(),
  transcribeAudio: supportsTranscription ? mockTranscribeAudio : undefined,
});

const makeRegistry = (provider?: MediaProvider): ProviderRegistry => ({
  getProvider: vi.fn().mockReturnValue(provider),
  getImageProviders: vi.fn().mockReturnValue([]),
  getImageEditProviders: vi.fn().mockReturnValue([]),
  getVideoProviders: vi.fn().mockReturnValue([]),
  getAudioProviders: vi.fn().mockReturnValue([]),
  getTranscriptionProviders: vi.fn().mockReturnValue(
    provider?.capabilities.supportsTranscription ? [provider] : [],
  ),
  listCapabilities: vi.fn().mockReturnValue([]),
  register: vi.fn(),
}) as unknown as ProviderRegistry;

vi.mock("../../src/read-media-file.js", () => ({
  readMediaFile: vi.fn().mockResolvedValue({
    data: Buffer.from("fake-audio-data"),
    mimeType: "audio/mpeg",
  }),
}));

describe("buildTranscribeAudioHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when no transcription provider is available", async () => {
    const registry = makeRegistry(undefined);
    const handler = buildTranscribeAudioHandler(registry);

    const result = await handler({ audioPath: "/tmp/audio.mp3" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("No transcription provider available");
  });

  it("returns error when specified provider is not configured", async () => {
    const registry = makeRegistry(undefined);
    const handler = buildTranscribeAudioHandler(registry);

    const result = await handler({ audioPath: "/tmp/audio.mp3", provider: "openai" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not configured");
  });

  it("returns error when provider does not support transcription", async () => {
    const provider = makeTranscriptionProvider("xai", false);
    const registry = {
      ...makeRegistry(provider),
      getProvider: vi.fn().mockReturnValue(provider),
    } as unknown as ProviderRegistry;
    const handler = buildTranscribeAudioHandler(registry);

    const result = await handler({ audioPath: "/tmp/audio.mp3", provider: "xai" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("does not support transcription");
  });

  it("calls transcribeAudio on the provider and returns text", async () => {
    const provider = makeTranscriptionProvider("openai", true);
    const registry = makeRegistry(provider);
    (registry.getProvider as ReturnType<typeof vi.fn>).mockReturnValue(provider);

    const transcriptionResult: TranscribedText = {
      text: "Hello, this is a transcription test.",
      metadata: { model: "whisper-1", provider: "openai" },
    };
    mockTranscribeAudio.mockResolvedValue(transcriptionResult);

    const handler = buildTranscribeAudioHandler(registry);
    const result = await handler({ audioPath: "/tmp/audio.mp3" });

    expect(result).not.toHaveProperty("isError");
    expect(result.content[0].text).toBe("Hello, this is a transcription test.");
  });

  it("passes language and providerOptions to the provider", async () => {
    const provider = makeTranscriptionProvider("openai", true);
    const registry = makeRegistry(provider);
    (registry.getProvider as ReturnType<typeof vi.fn>).mockReturnValue(provider);
    mockTranscribeAudio.mockResolvedValue({ text: "Bonjour", metadata: {} });

    const handler = buildTranscribeAudioHandler(registry);
    await handler({
      audioPath: "/tmp/audio.mp3",
      language: "fr",
      providerOptions: { temperature: 0.2 },
    });

    expect(mockTranscribeAudio).toHaveBeenCalledWith(
      expect.objectContaining({
        language: "fr",
        providerOptions: { temperature: 0.2 },
      }),
    );
  });

  it("auto-selects first transcription-capable provider when no provider specified", async () => {
    const provider = makeTranscriptionProvider("elevenlabs", true);
    const registry = makeRegistry(provider);
    mockTranscribeAudio.mockResolvedValue({ text: "Auto-selected", metadata: {} });

    const handler = buildTranscribeAudioHandler(registry);
    const result = await handler({ audioPath: "/tmp/audio.mp3" });

    expect(result).not.toHaveProperty("isError");
    expect(result.content[0].text).toBe("Auto-selected");
  });

  it("returns sanitized error when provider throws", async () => {
    const provider = makeTranscriptionProvider("openai", true);
    const registry = makeRegistry(provider);
    (registry.getProvider as ReturnType<typeof vi.fn>).mockReturnValue(provider);
    mockTranscribeAudio.mockRejectedValue(new Error("Rate limit exceeded"));

    const handler = buildTranscribeAudioHandler(registry);
    const result = await handler({ audioPath: "/tmp/audio.mp3" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Transcription failed");
    expect(result.content[0].text).toContain("Rate limit exceeded");
  });

  it("does not expose API keys in error messages", async () => {
    const provider = makeTranscriptionProvider("openai", true);
    const registry = makeRegistry(provider);
    (registry.getProvider as ReturnType<typeof vi.fn>).mockReturnValue(provider);
    mockTranscribeAudio.mockRejectedValue(
      new Error("Auth failed with key sk-abc123secretkey456"),
    );

    const handler = buildTranscribeAudioHandler(registry);
    const result = await handler({ audioPath: "/tmp/audio.mp3" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).not.toContain("sk-abc123secretkey456");
    expect(result.content[0].text).toContain("[REDACTED]");
  });
});
