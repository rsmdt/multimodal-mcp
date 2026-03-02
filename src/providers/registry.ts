import type { MediaProvider, ProviderInfo } from "./types.js";

export class ProviderRegistry {
  private providers: Map<string, MediaProvider> = new Map();

  register(provider: MediaProvider): void {
    this.providers.set(provider.name, provider);
  }

  getProvider(name?: string): MediaProvider | undefined {
    if (name) {
      return this.providers.get(name);
    }
    const first = this.providers.values().next();
    return first.done ? undefined : first.value;
  }

  getImageProviders(): MediaProvider[] {
    return [...this.providers.values()].filter(
      (p) => p.capabilities.supportsImageGeneration,
    );
  }

  getImageEditProviders(): MediaProvider[] {
    return [...this.providers.values()].filter(
      (p) => p.capabilities.supportsImageEditing,
    );
  }

  getVideoProviders(): MediaProvider[] {
    return [...this.providers.values()].filter(
      (p) => p.capabilities.supportsVideoGeneration,
    );
  }

  getAudioProviders(): MediaProvider[] {
    return [...this.providers.values()].filter(
      (p) => p.capabilities.supportsAudioGeneration,
    );
  }

  listCapabilities(): ProviderInfo[] {
    return [...this.providers.values()].map((p) => ({
      name: p.name,
      capabilities: p.capabilities,
    }));
  }
}
