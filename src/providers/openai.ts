import OpenAI from "openai";
import type {
  MediaProvider,
  ProviderCapabilities,
  ImageParams,
  EditImageParams,
  VideoParams,
  AudioParams,
  GeneratedMedia,
  TranscribeParams,
  TranscribedText,
} from "./types.js";
import { pollForCompletion } from "./polling.js";

const ASPECT_RATIO_TO_SIZE: Record<string, string> = {
  "1:1": "1024x1024",
  "16:9": "1536x1024",
  "9:16": "1024x1536",
  "4:3": "1024x768",
  "3:4": "768x1024",
};

export class OpenAIProvider implements MediaProvider {
  readonly name = "openai";
  readonly capabilities: ProviderCapabilities = {
    supportsImageGeneration: true,
    supportsImageEditing: true,
    supportsVideoGeneration: true,
    supportsAudioGeneration: true,
    supportsTranscription: true,
    supportedImageAspectRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
    supportedVideoAspectRatios: ["16:9", "9:16", "1:1"],
    supportedVideoResolutions: ["480p", "720p", "1080p"],
    supportedAudioFormats: ["mp3", "opus", "aac", "flac", "wav", "pcm"],
    maxVideoDurationSeconds: 20,
  };

  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async generateImage(params: ImageParams): Promise<GeneratedMedia> {
    const response = await this.client.images.generate({
      model: "gpt-image-1",
      prompt: params.prompt,
      size: this.mapAspectRatioToSize(params.aspectRatio) as Parameters<
        typeof this.client.images.generate
      >[0]["size"],
      quality: params.quality === "high" ? "high" : params.quality === "low" ? "low" : "medium",
      output_format: "png",
      ...params.providerOptions,
    });

    const base64Data = response.data![0].b64_json!;
    return {
      data: Buffer.from(base64Data, "base64"),
      mimeType: "image/png",
      metadata: { model: "gpt-image-1", provider: "openai" },
    };
  }

  async editImage(params: EditImageParams): Promise<GeneratedMedia> {
    const imageFile = new File(
      [new Uint8Array(params.imageData)],
      "input.png",
      { type: params.imageMimeType },
    );

    const response = await this.client.images.edit({
      model: "gpt-image-1",
      image: imageFile,
      prompt: params.prompt,
      ...params.providerOptions,
    });

    const base64Data = response.data![0].b64_json!;
    return {
      data: Buffer.from(base64Data, "base64"),
      mimeType: "image/png",
      metadata: { model: "gpt-image-1", provider: "openai", operation: "edit" },
    };
  }

  async generateVideo(params: VideoParams): Promise<GeneratedMedia> {
    const videos = this.client.videos as unknown as {
      create: (p: Record<string, unknown>) => Promise<Record<string, unknown>>;
      retrieve: (id: string) => Promise<Record<string, unknown>>;
    };

    const createParams: Record<string, unknown> = {
      model: "sora-2",
      prompt: params.prompt,
      seconds: String(params.duration),
      ...params.providerOptions,
    };

    if (params.imageData) {
      const imageFile = new File(
        [new Uint8Array(params.imageData)],
        "first-frame.png",
        { type: params.imageMimeType ?? "image/png" },
      );
      createParams.input_reference = imageFile;
    }

    const job = await videos.create(createParams);

    const result = await pollForCompletion(
      () => videos.retrieve(job.id as string),
      (status: Record<string, unknown>) => status.status === "completed",
      { timeoutMs: 600_000, intervalMs: 5_000 },
    );

    const videoUrl = result.url as string;
    const videoResponse = await fetch(videoUrl);
    const data = Buffer.from(await videoResponse.arrayBuffer());

    return {
      data,
      mimeType: "video/mp4",
      metadata: { model: "sora-2", provider: "openai", jobId: job.id },
    };
  }

  async generateAudio(params: AudioParams): Promise<GeneratedMedia> {
    const format = params.format ?? "mp3";
    const voice = params.voice ?? "alloy";

    const response = await this.client.audio.speech.create({
      model: "tts-1",
      input: params.text,
      voice: voice as "alloy",
      response_format: format as "mp3",
      speed: params.speed ?? 1.0,
      ...params.providerOptions,
    });

    const data = Buffer.from(await response.arrayBuffer());

    return {
      data,
      mimeType: this.audioFormatToMimeType(format),
      metadata: { model: "tts-1", provider: "openai", voice, format },
    };
  }

  async transcribeAudio(params: TranscribeParams): Promise<TranscribedText> {
    const audioFile = new File(
      [new Uint8Array(params.audioData)],
      "audio.wav",
      { type: params.audioMimeType },
    );

    const response = await this.client.audio.transcriptions.create({
      model: "whisper-1",
      file: audioFile,
      language: params.language,
      ...params.providerOptions,
    });

    return {
      text: response.text,
      metadata: { model: "whisper-1", provider: "openai" },
    };
  }

  private audioFormatToMimeType(format: string): string {
    const mimeTypes: Record<string, string> = {
      mp3: "audio/mpeg",
      opus: "audio/opus",
      aac: "audio/aac",
      flac: "audio/flac",
      wav: "audio/wav",
      pcm: "audio/pcm",
    };
    return mimeTypes[format] ?? "audio/mpeg";
  }

  private mapAspectRatioToSize(aspectRatio: string): string {
    return ASPECT_RATIO_TO_SIZE[aspectRatio] ?? "1024x1024";
  }
}
