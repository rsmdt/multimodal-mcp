import type { ProviderRegistry } from "../providers/registry.js";

export function buildListProvidersHandler(registry: ProviderRegistry) {
  return async () => {
    const providers = registry.listCapabilities();

    if (providers.length === 0) {
      return {
        content: [{
          type: "text" as const,
          text: "No providers configured. Set one or more API keys: OPENAI_API_KEY, XAI_API_KEY, GEMINI_API_KEY, ELEVENLABS_API_KEY, BFL_API_KEY",
        }],
      };
    }

    const lines = providers.map((p) => {
      const capabilityLabels: string[] = [];
      if (p.capabilities.supportsImageGeneration) capabilityLabels.push("image");
      if (p.capabilities.supportsImageEditing) capabilityLabels.push("image editing");
      if (p.capabilities.supportsVideoGeneration) capabilityLabels.push("video");
      if (p.capabilities.supportsAudioGeneration) capabilityLabels.push("audio");
      if (p.capabilities.supportsTranscription) capabilityLabels.push("transcription");
      return `- ${p.name}: ${capabilityLabels.join(", ")}`;
    });

    return {
      content: [{
        type: "text" as const,
        text: `Configured providers:\n${lines.join("\n")}`,
      }],
    };
  };
}
