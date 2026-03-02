import type { ProviderRegistry } from "../providers/registry.js";
import type { FileManager } from "../file-manager.js";
import { readMediaFile } from "../read-media-file.js";
import { sanitizeError } from "../errors.js";

export function buildEditImageHandler(
  registry: ProviderRegistry,
  fileManager: FileManager,
) {
  return async (params: {
    imagePath: string;
    prompt: string;
    provider?: string;
    outputDirectory?: string;
    providerOptions?: Record<string, unknown>;
  }) => {
    const provider = params.provider
      ? registry.getProvider(params.provider)
      : registry.getImageEditProviders()[0];

    if (!provider) {
      const availableNames = registry.getImageEditProviders().map((p) => p.name).join(", ");
      const text = params.provider
        ? `Provider "${params.provider}" is not configured. Available providers: ${availableNames || "none"}`
        : "No image editing provider available. Configure one of: OPENAI_API_KEY, XAI_API_KEY, GEMINI_API_KEY";

      return {
        isError: true as const,
        content: [{ type: "text" as const, text }],
      };
    }

    if (!provider.capabilities.supportsImageEditing) {
      const availableNames = registry.getImageEditProviders().map((p) => p.name).join(", ");
      return {
        isError: true as const,
        content: [{
          type: "text" as const,
          text: `Provider "${provider.name}" does not support image editing. Available: ${availableNames || "none"}`,
        }],
      };
    }

    try {
      const { data, mimeType } = await readMediaFile(params.imagePath);

      const media = await provider.editImage({
        imageData: data,
        imageMimeType: mimeType,
        prompt: params.prompt,
        providerOptions: params.providerOptions,
      });

      const filePath = await fileManager.save(media, "image", params.outputDirectory);

      return {
        content: [{ type: "text" as const, text: `Edited image saved to ${filePath}` }],
      };
    } catch (error) {
      const message = sanitizeError(error);
      return {
        isError: true as const,
        content: [{ type: "text" as const, text: `Image editing failed: ${message}` }],
      };
    }
  };
}
