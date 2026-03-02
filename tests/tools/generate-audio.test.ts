import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildGenerateAudioHandler } from "../../src/tools/generate-audio.js";
import type { ProviderRegistry } from "../../src/providers/registry.js";
import type { FileManager } from "../../src/file-manager.js";
import type { MediaProvider } from "../../src/providers/types.js";

const mockGenerateAudio = vi.fn();

const makeAudioProvider = (name: string, supportsAudio: boolean): MediaProvider => ({
  name,
  capabilities: {
    supportsImageGeneration: true,
    supportsVideoGeneration: true,
    supportsAudioGeneration: supportsAudio,
    supportedImageAspectRatios: ["1:1"],
    supportedVideoAspectRatios: ["16:9"],
    supportedVideoResolutions: ["1080p"],
    supportedAudioFormats: supportsAudio ? ["mp3"] : [],
    maxVideoDurationSeconds: 20,
  },
  generateImage: vi.fn(),
  generateVideo: vi.fn(),
  generateAudio: mockGenerateAudio,
});

const mockSave = vi.fn();

const makeRegistry = (provider?: MediaProvider): ProviderRegistry => ({
  getProvider: vi.fn().mockReturnValue(provider),
  getImageProviders: vi.fn().mockReturnValue([]),
  getVideoProviders: vi.fn().mockReturnValue([]),
  getAudioProviders: vi.fn().mockReturnValue(provider?.capabilities.supportsAudioGeneration ? [provider] : []),
  listCapabilities: vi.fn().mockReturnValue([]),
  register: vi.fn(),
}) as unknown as ProviderRegistry;

const makeFileManager = (): FileManager => ({
  save: mockSave,
}) as unknown as FileManager;

describe("buildGenerateAudioHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when no audio provider is available", async () => {
    const registry = makeRegistry(undefined);
    const handler = buildGenerateAudioHandler(registry, makeFileManager());

    const result = await handler({ text: "Hello world" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("No audio provider available");
  });

  it("returns error when specified provider is not configured", async () => {
    const registry = makeRegistry(undefined);
    const handler = buildGenerateAudioHandler(registry, makeFileManager());

    const result = await handler({ text: "Hello", provider: "openai" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("does not support audio");
  });

  it("returns error when provider does not support audio", async () => {
    const provider = makeAudioProvider("xai", false);
    const registry = {
      ...makeRegistry(provider),
      getProvider: vi.fn().mockReturnValue(provider),
    } as unknown as ProviderRegistry;
    const handler = buildGenerateAudioHandler(registry, makeFileManager());

    const result = await handler({ text: "Hello", provider: "xai" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("does not support audio generation");
  });

  it("calls generateAudio on the provider with params", async () => {
    const provider = makeAudioProvider("openai", true);
    const registry = makeRegistry(provider);
    (registry.getProvider as ReturnType<typeof vi.fn>).mockReturnValue(provider);
    mockGenerateAudio.mockResolvedValue({
      data: Buffer.from("audio-data"),
      mimeType: "audio/mpeg",
      metadata: { provider: "openai" },
    });
    mockSave.mockResolvedValue("/tmp/audio-123.mp3");

    const handler = buildGenerateAudioHandler(registry, makeFileManager());
    await handler({ text: "Hello world", voice: "alloy", speed: 1.5, format: "mp3" });

    expect(mockGenerateAudio).toHaveBeenCalledWith({
      text: "Hello world",
      voice: "alloy",
      speed: 1.5,
      format: "mp3",
      providerOptions: undefined,
    });
  });

  it("saves audio to disk and returns file path", async () => {
    const provider = makeAudioProvider("openai", true);
    const registry = makeRegistry(provider);
    (registry.getProvider as ReturnType<typeof vi.fn>).mockReturnValue(provider);
    mockGenerateAudio.mockResolvedValue({
      data: Buffer.from("audio-data"),
      mimeType: "audio/mpeg",
      metadata: { provider: "openai" },
    });
    mockSave.mockResolvedValue("/tmp/audio-123-openai-abcd1234.mp3");

    const handler = buildGenerateAudioHandler(registry, makeFileManager());
    const result = await handler({ text: "Hello" });

    expect(mockSave).toHaveBeenCalledWith(
      expect.objectContaining({ mimeType: "audio/mpeg" }),
      "audio",
    );
    expect(result.content[0].text).toContain("Audio saved to");
    expect(result.content[0].text).toContain("/tmp/audio-123-openai-abcd1234.mp3");
  });

  it("returns sanitized error when provider throws", async () => {
    const provider = makeAudioProvider("openai", true);
    const registry = makeRegistry(provider);
    (registry.getProvider as ReturnType<typeof vi.fn>).mockReturnValue(provider);
    mockGenerateAudio.mockRejectedValue(new Error("Rate limit exceeded"));

    const handler = buildGenerateAudioHandler(registry, makeFileManager());
    const result = await handler({ text: "Hello" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Audio generation failed");
    expect(result.content[0].text).toContain("Rate limit exceeded");
  });

  it("does not expose API keys in error messages", async () => {
    const provider = makeAudioProvider("openai", true);
    const registry = makeRegistry(provider);
    (registry.getProvider as ReturnType<typeof vi.fn>).mockReturnValue(provider);
    mockGenerateAudio.mockRejectedValue(
      new Error("Auth failed with key sk-abc123secretkey456"),
    );

    const handler = buildGenerateAudioHandler(registry, makeFileManager());
    const result = await handler({ text: "Hello" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).not.toContain("sk-abc123secretkey456");
    expect(result.content[0].text).toContain("[REDACTED]");
  });

  it("passes providerOptions through to the provider", async () => {
    const provider = makeAudioProvider("openai", true);
    const registry = makeRegistry(provider);
    (registry.getProvider as ReturnType<typeof vi.fn>).mockReturnValue(provider);
    mockGenerateAudio.mockResolvedValue({
      data: Buffer.from("audio"),
      mimeType: "audio/mpeg",
      metadata: { provider: "openai" },
    });
    mockSave.mockResolvedValue("/tmp/audio.mp3");

    const handler = buildGenerateAudioHandler(registry, makeFileManager());
    await handler({
      text: "Hello",
      providerOptions: { instructions: "Speak cheerfully" },
    });

    expect(mockGenerateAudio).toHaveBeenCalledWith(
      expect.objectContaining({
        providerOptions: { instructions: "Speak cheerfully" },
      }),
    );
  });

  it("auto-selects first audio-capable provider when no provider specified", async () => {
    const provider = makeAudioProvider("openai", true);
    const registry = makeRegistry(provider);
    // getProvider without name returns undefined (simulating no auto-select from generic pool)
    // but getAudioProviders returns the audio-capable provider
    mockGenerateAudio.mockResolvedValue({
      data: Buffer.from("audio"),
      mimeType: "audio/mpeg",
      metadata: { provider: "openai" },
    });
    mockSave.mockResolvedValue("/tmp/audio.mp3");

    const handler = buildGenerateAudioHandler(registry, makeFileManager());
    const result = await handler({ text: "Hello" });

    expect(result).not.toHaveProperty("isError");
  });
});
