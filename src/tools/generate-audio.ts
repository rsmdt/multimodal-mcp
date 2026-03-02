import type { ProviderRegistry } from "../providers/registry.js";
import type { FileManager } from "../file-manager.js";
import { sanitizeError } from "../errors.js";

export function buildGenerateAudioHandler(
  registry: ProviderRegistry,
  fileManager: FileManager,
) {
  return async (params: {
    text: string;
    provider?: string;
    voice?: string;
    speed?: number;
    format?: string;
    providerOptions?: Record<string, unknown>;
  }) => {
    const provider = params.provider
      ? registry.getProvider(params.provider)
      : registry.getAudioProviders()[0];

    if (!provider) {
      const available = registry.getAudioProviders().map((p) => p.name).join(", ") || "none";
      const text = params.provider
        ? `Provider "${params.provider}" is not configured or does not support audio. Available audio providers: ${available}`
        : "No audio provider available. Configure one of: OPENAI_API_KEY, GOOGLE_API_KEY";
      return {
        isError: true as const,
        content: [{ type: "text" as const, text }],
      };
    }

    if (!provider.capabilities.supportsAudioGeneration) {
      const available = registry.getAudioProviders().map((p) => p.name).join(", ") || "none";
      return {
        isError: true as const,
        content: [{
          type: "text" as const,
          text: `Provider "${provider.name}" does not support audio generation. Available audio providers: ${available}`,
        }],
      };
    }

    try {
      const media = await provider.generateAudio({
        text: params.text,
        voice: params.voice,
        speed: params.speed,
        format: params.format,
        providerOptions: params.providerOptions,
      });

      const filePath = await fileManager.save(media, "audio");
      return {
        content: [{ type: "text" as const, text: `Audio saved to ${filePath}` }],
      };
    } catch (error) {
      const message = sanitizeError(error);
      return {
        isError: true as const,
        content: [{ type: "text" as const, text: `Audio generation failed: ${message}` }],
      };
    }
  };
}
