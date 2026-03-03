import { describe, it, expect, beforeEach } from "vitest";
import { ProviderRegistry } from "../../src/providers/registry.js";
import { buildListProvidersHandler } from "../../src/tools/list-providers.js";
import type {
  MediaProvider,
  GeneratedMedia,
  ImageParams,
  EditImageParams,
  VideoParams,
  AudioParams,
} from "../../src/providers/types.js";

const makeProvider = (
  name: string,
  overrides: Partial<MediaProvider["capabilities"]> = {},
): MediaProvider => ({
  name,
  capabilities: {
    supportsImageGeneration: false,
    supportsImageEditing: false,
    supportsVideoGeneration: false,
    supportsAudioGeneration: false,
    supportsTranscription: false,
    supportedImageAspectRatios: [],
    supportedVideoAspectRatios: [],
    supportedVideoResolutions: [],
    supportedAudioFormats: [],
    maxVideoDurationSeconds: 0,
    ...overrides,
  },
  generateImage: async (_params: ImageParams): Promise<GeneratedMedia> => ({
    data: Buffer.from("image"),
    mimeType: "image/png",
    metadata: {},
  }),
  editImage: async (_params: EditImageParams): Promise<GeneratedMedia> => ({
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

describe("buildListProvidersHandler", () => {
  let registry: ProviderRegistry;

  beforeEach(() => {
    registry = new ProviderRegistry();
  });

  it("returns no providers message when registry is empty", async () => {
    const handler = buildListProvidersHandler(registry);
    const result = await handler();

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain("No providers configured");
  });

  it("returns formatted list of configured providers", async () => {
    registry.register(makeProvider("openai", { supportsImageGeneration: true }));
    const handler = buildListProvidersHandler(registry);
    const result = await handler();

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain("openai");
  });

  it("indicates image support per provider", async () => {
    registry.register(makeProvider("openai", { supportsImageGeneration: true }));
    const handler = buildListProvidersHandler(registry);
    const result = await handler();

    expect(result.content[0].text).toContain("image");
  });

  it("indicates video support per provider", async () => {
    registry.register(makeProvider("google", { supportsVideoGeneration: true }));
    const handler = buildListProvidersHandler(registry);
    const result = await handler();

    expect(result.content[0].text).toContain("video");
  });

  it("indicates transcription support per provider", async () => {
    registry.register(makeProvider("elevenlabs", { supportsTranscription: true }));
    const handler = buildListProvidersHandler(registry);
    const result = await handler();

    expect(result.content[0].text).toContain("transcription");
  });

  it("lists multiple providers when several are configured", async () => {
    registry.register(makeProvider("openai", { supportsImageGeneration: true }));
    registry.register(makeProvider("xai", { supportsImageGeneration: true }));
    registry.register(makeProvider("google", { supportsVideoGeneration: true }));
    const handler = buildListProvidersHandler(registry);
    const result = await handler();

    const text = result.content[0].text;
    expect(text).toContain("openai");
    expect(text).toContain("xai");
    expect(text).toContain("google");
  });

  it("shows both image and video capabilities for a provider that supports both", async () => {
    registry.register(makeProvider("full-provider", { supportsImageGeneration: true, supportsVideoGeneration: true }));
    const handler = buildListProvidersHandler(registry);
    const result = await handler();

    const text = result.content[0].text;
    expect(text).toContain("image");
    expect(text).toContain("video");
  });

  it("includes ELEVENLABS_API_KEY and BFL_API_KEY in no-providers message", async () => {
    const handler = buildListProvidersHandler(registry);
    const result = await handler();

    expect(result.content[0].text).toContain("ELEVENLABS_API_KEY");
    expect(result.content[0].text).toContain("BFL_API_KEY");
  });
});
