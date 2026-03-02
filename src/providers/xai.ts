import OpenAI from "openai";
import type {
  MediaProvider,
  ProviderCapabilities,
  ImageParams,
  EditImageParams,
  VideoParams,
  AudioParams,
  GeneratedMedia,
} from "./types.js";
import { pollForCompletion } from "./polling.js";

const XAI_BASE_URL = "https://api.x.ai/v1";
const IMAGE_MODEL = "grok-imagine-image";
const VIDEO_MODEL = "grok-imagine-video";

interface VideoSubmitResult {
  request_id: string;
}

interface VideoStatusResult {
  status: string;
  video_url?: string;
}

export class XAIProvider implements MediaProvider {
  readonly name = "xai";

  readonly capabilities: ProviderCapabilities = {
    supportsImageGeneration: true,
    supportsImageEditing: true,
    supportsVideoGeneration: true,
    supportsAudioGeneration: false,
    supportedImageAspectRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
    supportedVideoAspectRatios: ["16:9", "9:16", "1:1"],
    supportedVideoResolutions: ["720p", "1080p"],
    supportedAudioFormats: [],
    maxVideoDurationSeconds: 15,
  };

  private client: OpenAI;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.client = new OpenAI({ apiKey, baseURL: XAI_BASE_URL });
  }

  async generateImage(params: ImageParams): Promise<GeneratedMedia> {
    const response = await this.client.images.generate({
      model: IMAGE_MODEL,
      prompt: params.prompt,
      response_format: "b64_json",
      ...params.providerOptions,
    });

    const imageData = response.data?.[0];
    if (!imageData?.b64_json) {
      throw new Error("xAI image generation returned no data");
    }
    const base64Data = imageData.b64_json;
    return {
      data: Buffer.from(base64Data, "base64"),
      mimeType: "image/png",
      metadata: { model: IMAGE_MODEL, provider: "xai" },
    };
  }

  async editImage(params: EditImageParams): Promise<GeneratedMedia> {
    const base64Data = params.imageData.toString("base64");
    const dataUri = `data:${params.imageMimeType};base64,${base64Data}`;

    const response = await fetch(`${XAI_BASE_URL}/images/edits`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: IMAGE_MODEL,
        prompt: params.prompt,
        image: { url: dataUri, type: "image_url" },
        ...params.providerOptions,
      }),
    });

    if (!response.ok) {
      throw new Error(`xAI image editing failed: ${response.status}`);
    }

    const result = (await response.json()) as {
      data: Array<{ b64_json?: string; url?: string }>;
    };

    const imageResult = result.data?.[0];
    if (imageResult?.b64_json) {
      return {
        data: Buffer.from(imageResult.b64_json, "base64"),
        mimeType: "image/png",
        metadata: { model: IMAGE_MODEL, provider: "xai", operation: "edit" },
      };
    }

    if (imageResult?.url) {
      const imageResponse = await fetch(imageResult.url);
      const data = Buffer.from(await imageResponse.arrayBuffer());
      return {
        data,
        mimeType: "image/png",
        metadata: { model: IMAGE_MODEL, provider: "xai", operation: "edit" },
      };
    }

    throw new Error("xAI image editing returned no data");
  }

  async generateVideo(params: VideoParams): Promise<GeneratedMedia> {
    const submitResponse = await fetch(`${XAI_BASE_URL}/videos/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: VIDEO_MODEL,
        prompt: params.prompt,
        duration: params.duration,
        aspect_ratio: params.aspectRatio,
        ...params.providerOptions,
      }),
    });

    if (!submitResponse.ok) {
      throw new Error(`xAI video generation failed: ${submitResponse.status}`);
    }

    const submitResult = (await submitResponse.json()) as VideoSubmitResult;

    const statusResult = await pollForCompletion(
      async (): Promise<VideoStatusResult> => {
        const statusResponse = await fetch(
          `${XAI_BASE_URL}/videos/generations/${submitResult.request_id}`,
          { headers: { Authorization: `Bearer ${this.apiKey}` } },
        );
        return statusResponse.json() as Promise<VideoStatusResult>;
      },
      (result) => result.status === "done",
      { timeoutMs: 600_000, intervalMs: 5_000 },
    );

    const videoResponse = await fetch(statusResult.video_url!);
    const data = Buffer.from(await videoResponse.arrayBuffer());

    return {
      data,
      mimeType: "video/mp4",
      metadata: {
        model: VIDEO_MODEL,
        provider: "xai",
        requestId: submitResult.request_id,
      },
    };
  }

  async generateAudio(_params: AudioParams): Promise<GeneratedMedia> {
    throw new Error("xAI does not support audio generation");
  }
}
