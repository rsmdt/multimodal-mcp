import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildGenerateImageHandler } from "../../src/tools/generate-image.js";

const mockProvider = {
  name: "mock",
  capabilities: {
    supportsImageGeneration: true,
    supportsVideoGeneration: false,
    supportedImageAspectRatios: [],
    supportedVideoAspectRatios: [],
    supportedVideoResolutions: [],
    maxVideoDurationSeconds: 0,
  },
  generateImage: vi.fn().mockResolvedValue({
    data: Buffer.from("fake"),
    mimeType: "image/png",
    metadata: { provider: "mock" },
  }),
  generateVideo: vi.fn(),
};

const mockRegistry = {
  getProvider: vi.fn().mockReturnValue(mockProvider),
  getImageProviders: vi.fn().mockReturnValue([mockProvider]),
  getVideoProviders: vi.fn().mockReturnValue([]),
  listCapabilities: vi.fn().mockReturnValue([]),
};

const mockFileManager = {
  save: vi.fn().mockResolvedValue("/tmp/image-123.png"),
};

describe("buildGenerateImageHandler", () => {
  let handler: ReturnType<typeof buildGenerateImageHandler>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockProvider.generateImage.mockResolvedValue({
      data: Buffer.from("fake"),
      mimeType: "image/png",
      metadata: { provider: "mock" },
    });
    mockRegistry.getProvider.mockReturnValue(mockProvider);
    mockRegistry.getImageProviders.mockReturnValue([mockProvider]);
    mockFileManager.save.mockResolvedValue("/tmp/image-123.png");
    handler = buildGenerateImageHandler(
      mockRegistry as never,
      mockFileManager as never,
    );
  });

  it("returns text content with file path on successful generation", async () => {
    const result = await handler({ prompt: "a red fox" });
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain("/tmp/image-123.png");
    expect(result).not.toHaveProperty("isError");
  });

  it("returns isError: true when no provider available (registry.getProvider returns undefined)", async () => {
    mockRegistry.getProvider.mockReturnValue(undefined);
    mockRegistry.getImageProviders.mockReturnValue([]);

    const result = await handler({ prompt: "a red fox" });
    expect(result.isError).toBe(true);
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain("No image provider available");
  });

  it("returns isError: true when named provider not found", async () => {
    mockRegistry.getProvider.mockReturnValue(undefined);
    mockRegistry.getImageProviders.mockReturnValue([mockProvider]);

    const result = await handler({ prompt: "a red fox", provider: "unknown-provider" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("unknown-provider");
  });

  it("returns isError: true with sanitized message on provider API failure", async () => {
    mockProvider.generateImage.mockRejectedValue(new Error("API rate limit exceeded"));

    const result = await handler({ prompt: "a red fox" });
    expect(result.isError).toBe(true);
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain("Image generation failed");
    expect(result.content[0].text).toContain("API rate limit exceeded");
  });

  it("passes providerOptions through to provider.generateImage", async () => {
    const providerOptions = { style: "vivid", size: "1024x1024" };
    await handler({ prompt: "a red fox", providerOptions });

    expect(mockProvider.generateImage).toHaveBeenCalledWith(
      expect.objectContaining({ providerOptions }),
    );
  });

  it("auto-selects provider when provider param not specified", async () => {
    await handler({ prompt: "a blue sky" });
    expect(mockRegistry.getProvider).toHaveBeenCalledWith(undefined);
  });

  it("uses explicit provider when provider param is specified", async () => {
    await handler({ prompt: "a blue sky", provider: "openai" });
    expect(mockRegistry.getProvider).toHaveBeenCalledWith("openai");
  });

  it("passes correct aspectRatio and quality defaults", async () => {
    await handler({ prompt: "a red fox" });
    expect(mockProvider.generateImage).toHaveBeenCalledWith(
      expect.objectContaining({
        aspectRatio: "1:1",
        quality: "standard",
      }),
    );
  });

  it("passes explicit aspectRatio and quality when provided", async () => {
    await handler({ prompt: "a red fox", aspectRatio: "16:9", quality: "hd" });
    expect(mockProvider.generateImage).toHaveBeenCalledWith(
      expect.objectContaining({
        aspectRatio: "16:9",
        quality: "hd",
      }),
    );
  });
});
