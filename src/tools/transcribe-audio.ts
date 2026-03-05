import type { ProviderRegistry } from "../providers/registry.js";
import { readMediaFile } from "../read-media-file.js";
import { sanitizeError } from "../errors.js";

export function buildTranscribeAudioHandler(registry: ProviderRegistry) {
  return async (params: {
    audioPath: string;
    provider?: string;
    language?: string;
    providerOptions?: Record<string, unknown>;
  }) => {
    const provider = params.provider
      ? registry.getProvider(params.provider)
      : registry.getTranscriptionProviders()[0];

    if (!provider) {
      const available =
        registry.getTranscriptionProviders().map((p) => p.name).join(", ") || "none";
      const text = params.provider
        ? `Provider "${params.provider}" is not configured or does not support transcription. Available transcription providers: ${available}`
        : `No transcription provider available. Available transcription providers: ${available}`;
      return {
        isError: true as const,
        content: [{ type: "text" as const, text }],
      };
    }

    if (!provider.transcribeAudio) {
      const available =
        registry.getTranscriptionProviders().map((p) => p.name).join(", ") || "none";
      return {
        isError: true as const,
        content: [{
          type: "text" as const,
          text: `Provider "${provider.name}" does not support transcription. Available transcription providers: ${available}`,
        }],
      };
    }

    try {
      const { data, mimeType } = await readMediaFile(params.audioPath);

      const result = await provider.transcribeAudio({
        audioData: data,
        audioMimeType: mimeType,
        language: params.language,
        providerOptions: params.providerOptions,
      });

      return {
        content: [{ type: "text" as const, text: result.text }],
      };
    } catch (error) {
      const message = sanitizeError(error);
      return {
        isError: true as const,
        content: [{ type: "text" as const, text: `Transcription failed: ${message}` }],
      };
    }
  };
}
