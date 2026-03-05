export interface MediaProvider {
  readonly name: string;
  readonly capabilities: ProviderCapabilities;
  generateImage(params: ImageParams): Promise<GeneratedMedia>;
  editImage(params: EditImageParams): Promise<GeneratedMedia>;
  generateVideo(params: VideoParams): Promise<GeneratedMedia>;
  generateAudio(params: AudioParams): Promise<GeneratedMedia>;
  transcribeAudio?(params: TranscribeParams): Promise<TranscribedText>;
}

export interface ProviderCapabilities {
  supportsImageGeneration: boolean;
  supportsImageEditing: boolean;
  supportsVideoGeneration: boolean;
  supportsAudioGeneration: boolean;
  supportsTranscription?: boolean;
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

export interface EditImageParams {
  imageData: Buffer;
  imageMimeType: string;
  prompt: string;
  providerOptions?: Record<string, unknown>;
}

export interface VideoParams {
  prompt: string;
  duration: number;
  aspectRatio: string;
  resolution: string;
  imageData?: Buffer;
  imageMimeType?: string;
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

export interface TranscribeParams {
  audioData: Buffer;
  audioMimeType: string;
  language?: string;
  providerOptions?: Record<string, unknown>;
}

export interface TranscribedText {
  text: string;
  metadata: Record<string, unknown>;
}

export interface ProviderInfo {
  name: string;
  capabilities: ProviderCapabilities;
}
