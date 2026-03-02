import { describe, it, expect, beforeEach } from "vitest";
import { ProviderRegistry } from "../../src/providers/registry.js";
import { buildListProvidersHandler } from "../../src/tools/list-providers.js";
import type {
  MediaProvider,
  GeneratedMedia,
  ImageParams,
  VideoParams,
} from "../../src/providers/types.js";

const makeProvider = (
  name: string,
  supportsImage: boolean,
  supportsVideo: boolean,
): MediaProvider => ({
  name,
  capabilities: {
    supportsImageGeneration: supportsImage,
    supportsVideoGeneration: supportsVideo,
    supportedImageAspectRatios: supportsImage ? ["1:1", "16:9"] : [],
    supportedVideoAspectRatios: supportsVideo ? ["16:9"] : [],
    supportedVideoResolutions: supportsVideo ? ["1080p"] : [],
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
    registry.register(makeProvider("openai", true, false));
    const handler = buildListProvidersHandler(registry);
    const result = await handler();

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain("openai");
  });

  it("indicates image support per provider", async () => {
    registry.register(makeProvider("openai", true, false));
    const handler = buildListProvidersHandler(registry);
    const result = await handler();

    expect(result.content[0].text).toContain("image");
  });

  it("indicates video support per provider", async () => {
    registry.register(makeProvider("google", false, true));
    const handler = buildListProvidersHandler(registry);
    const result = await handler();

    expect(result.content[0].text).toContain("video");
  });

  it("lists multiple providers when several are configured", async () => {
    registry.register(makeProvider("openai", true, false));
    registry.register(makeProvider("xai", true, false));
    registry.register(makeProvider("google", false, true));
    const handler = buildListProvidersHandler(registry);
    const result = await handler();

    const text = result.content[0].text;
    expect(text).toContain("openai");
    expect(text).toContain("xai");
    expect(text).toContain("google");
  });

  it("shows both image and video capabilities for a provider that supports both", async () => {
    registry.register(makeProvider("full-provider", true, true));
    const handler = buildListProvidersHandler(registry);
    const result = await handler();

    const text = result.content[0].text;
    expect(text).toContain("image");
    expect(text).toContain("video");
  });
});
