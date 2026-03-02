import type { ProviderRegistry } from "../providers/registry.js";

export function buildListProvidersHandler(registry: ProviderRegistry) {
  return async () => {
    const providers = registry.listCapabilities();

    if (providers.length === 0) {
      return {
        content: [{
          type: "text" as const,
          text: "No providers configured. Set one or more API keys: OPENAI_API_KEY, XAI_API_KEY, GOOGLE_API_KEY",
        }],
      };
    }

    const lines = providers.map((p) => {
      const caps: string[] = [];
      if (p.capabilities.supportsImageGeneration) caps.push("image");
      if (p.capabilities.supportsVideoGeneration) caps.push("video");
      return `- ${p.name}: ${caps.join(", ")}`;
    });

    return {
      content: [{
        type: "text" as const,
        text: `Configured providers:\n${lines.join("\n")}`,
      }],
    };
  };
}
