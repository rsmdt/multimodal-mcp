import type {
  MediaProvider,
  ProviderCapabilities,
  ImageParams,
  VideoParams,
  AudioParams,
  GeneratedMedia,
} from "./types.js";
import { pollForCompletion } from "./polling.js";

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

interface ImageGenerationResponse {
  generatedImages: Array<{ image: { bytesBase64Encoded: string } }>;
}

interface OperationResponse {
  name: string;
}

interface OperationStatus {
  done: boolean;
  response?: { videos: Array<{ uri: string }> };
}

interface GeminiTtsResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        inlineData?: { mimeType: string; data: string };
      }>;
    };
  }>;
}

export class GoogleProvider implements MediaProvider {
  readonly name = "google";
  readonly capabilities: ProviderCapabilities = {
    supportsImageGeneration: true,
    supportsVideoGeneration: true,
    supportsAudioGeneration: true,
    supportedImageAspectRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
    supportedVideoAspectRatios: ["16:9", "9:16"],
    supportedVideoResolutions: ["720p", "1080p"],
    supportedAudioFormats: ["wav"],
    maxVideoDurationSeconds: 8,
  };

  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generateImage(params: ImageParams): Promise<GeneratedMedia> {
    const response = await fetch(
      `${GEMINI_BASE_URL}/models/imagen-4:generateImages?key=${this.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: params.prompt,
          config: {
            aspectRatio: params.aspectRatio,
            ...params.providerOptions,
          },
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Google image generation failed: ${response.status}`);
    }

    const result = (await response.json()) as ImageGenerationResponse;
    const base64 = result.generatedImages[0].image.bytesBase64Encoded;

    return {
      data: Buffer.from(base64, "base64"),
      mimeType: "image/png",
      metadata: { model: "imagen-4", provider: "google" },
    };
  }

  async generateVideo(params: VideoParams): Promise<GeneratedMedia> {
    const submitResponse = await fetch(
      `${GEMINI_BASE_URL}/models/veo-3.1:predictLongRunning?key=${this.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: params.prompt,
          config: {
            aspectRatio: params.aspectRatio,
            durationSeconds: params.duration,
            ...params.providerOptions,
          },
        }),
      },
    );

    if (!submitResponse.ok) {
      throw new Error(`Google video generation failed: ${submitResponse.status}`);
    }

    const operation = (await submitResponse.json()) as OperationResponse;

    const result = await pollForCompletion<OperationStatus>(
      async () => {
        const statusResponse = await fetch(
          `${GEMINI_BASE_URL}/${operation.name}?key=${this.apiKey}`,
        );
        return statusResponse.json() as Promise<OperationStatus>;
      },
      (status) => status.done === true,
      { timeoutMs: 600_000, intervalMs: 5_000 },
    );

    const videoUri = result.response!.videos[0].uri;
    const videoResponse = await fetch(videoUri);
    const data = Buffer.from(await videoResponse.arrayBuffer());

    return {
      data,
      mimeType: "video/mp4",
      metadata: { model: "veo-3.1", provider: "google", operationName: operation.name },
    };
  }

  async generateAudio(params: AudioParams): Promise<GeneratedMedia> {
    const voice = params.voice ?? "Kore";
    const model = "gemini-2.5-flash-preview-tts";

    const response = await fetch(
      `${GEMINI_BASE_URL}/models/${model}:generateContent?key=${this.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: params.text }] }],
          generationConfig: {
            response_modalities: ["AUDIO"],
            speech_config: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voice },
              },
            },
            ...params.providerOptions,
          },
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Google audio generation failed: ${response.status}`);
    }

    const result = (await response.json()) as GeminiTtsResponse;
    const audioPart = result.candidates[0]?.content?.parts?.find(
      (part) => part.inlineData !== undefined,
    );

    if (!audioPart?.inlineData) {
      throw new Error("Google audio generation returned no audio data");
    }

    return {
      data: Buffer.from(audioPart.inlineData.data, "base64"),
      mimeType: audioPart.inlineData.mimeType || "audio/wav",
      metadata: { model, provider: "google", voice },
    };
  }
}
