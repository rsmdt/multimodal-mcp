import type { ProviderRegistry } from "../providers/registry.js";
import type { FileManager } from "../file-manager.js";
import { sanitizeError } from "../errors.js";

export function buildGenerateVideoHandler(
  registry: ProviderRegistry,
  fileManager: FileManager,
) {
  return async (params: {
    prompt: string;
    provider?: string;
    duration?: number;
    aspectRatio?: string;
    resolution?: string;
    outputDirectory?: string;
    providerOptions?: Record<string, unknown>;
  }) => {
    const provider = registry.getProvider(params.provider);
    if (!provider) {
      const available = registry.getVideoProviders().map((p) => p.name).join(", ") || "none";
      const text = params.provider
        ? `Provider "${params.provider}" is not configured. Available providers: ${available}`
        : "No video provider available. Configure one of: OPENAI_API_KEY, XAI_API_KEY, GEMINI_API_KEY";
      return {
        isError: true as const,
        content: [{ type: "text" as const, text }],
      };
    }

    try {
      const media = await provider.generateVideo({
        prompt: params.prompt,
        duration: params.duration ?? 5,
        aspectRatio: params.aspectRatio ?? "16:9",
        resolution: params.resolution ?? "720p",
        providerOptions: params.providerOptions,
      });

      const filePath = await fileManager.save(media, "video", params.outputDirectory);
      return {
        content: [{ type: "text" as const, text: `Video saved to ${filePath}` }],
      };
    } catch (error) {
      const message = sanitizeError(error);
      return {
        isError: true as const,
        content: [{ type: "text" as const, text: `Video generation failed: ${message}` }],
      };
    }
  };
}
