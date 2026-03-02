import type { ProviderRegistry } from "../providers/registry.js";
import type { FileManager } from "../file-manager.js";
import { sanitizeError } from "../errors.js";

export function buildGenerateImageHandler(
  registry: ProviderRegistry,
  fileManager: FileManager,
) {
  return async (params: {
    prompt: string;
    provider?: string;
    aspectRatio?: string;
    quality?: string;
    outputDirectory?: string;
    providerOptions?: Record<string, unknown>;
  }) => {
    const provider = registry.getProvider(params.provider);

    if (!provider) {
      const availableNames = registry.getImageProviders().map((p) => p.name).join(", ");
      const text = params.provider
        ? `Provider "${params.provider}" is not configured. Available providers: ${availableNames || "none"}`
        : "No image provider available. Configure one of: OPENAI_API_KEY, XAI_API_KEY, GEMINI_API_KEY";

      return {
        isError: true as const,
        content: [{ type: "text" as const, text }],
      };
    }

    try {
      const media = await provider.generateImage({
        prompt: params.prompt,
        aspectRatio: params.aspectRatio ?? "1:1",
        quality: params.quality ?? "standard",
        providerOptions: params.providerOptions,
      });

      const filePath = await fileManager.save(media, "image", params.outputDirectory);

      return {
        content: [{ type: "text" as const, text: `Image saved to ${filePath}` }],
      };
    } catch (error) {
      const message = sanitizeError(error);
      return {
        isError: true as const,
        content: [{ type: "text" as const, text: `Image generation failed: ${message}` }],
      };
    }
  };
}
