export interface MediaProvider {
  readonly name: string;
  readonly capabilities: ProviderCapabilities;
  generateImage(params: ImageParams): Promise<GeneratedMedia>;
  generateVideo(params: VideoParams): Promise<GeneratedMedia>;
  generateAudio(params: AudioParams): Promise<GeneratedMedia>;
}

export interface ProviderCapabilities {
  supportsImageGeneration: boolean;
  supportsVideoGeneration: boolean;
  supportsAudioGeneration: boolean;
  supportedImageAspectRatios: string[];
  supportedVideoAspectRatios: string[];
  supportedVideoResolutions: string[];
  supportedAudioFormats: string[];
  maxVideoDurationSeconds: number;
}

export interface ImageParams {
  prompt: string;
  aspectRatio: string;
  quality: string;
  providerOptions?: Record<string, unknown>;
}

export interface VideoParams {
  prompt: string;
  duration: number;
  aspectRatio: string;
  resolution: string;
  providerOptions?: Record<string, unknown>;
}

export interface AudioParams {
  text: string;
  voice?: string;
  speed?: number;
  format?: string;
  providerOptions?: Record<string, unknown>;
}

export interface GeneratedMedia {
  data: Buffer;
  mimeType: string;
  metadata: Record<string, unknown>;
}

export interface ProviderInfo {
  name: string;
  capabilities: ProviderCapabilities;
}
