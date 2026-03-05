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

const BFL_BASE_URL = "https://api.bfl.ai/v1";
const IMAGE_MODEL = "flux-pro-1.1";
const EDIT_MODEL = "flux-kontext-pro";

const ALLOWED_MODELS = new Set([
  "flux-pro-1.1",
  "flux-pro-1.1-ultra",
  "flux-dev",
  "flux-kontext-pro",
  "flux-kontext-max",
]);

interface TaskSubmitResult {
  id: string;
  polling_url: string;
}

interface TaskStatusResult {
  status: string;
  result?: { sample: string };
}

const ASPECT_RATIO_MAP: Record<string, { width: number; height: number }> = {
  "1:1": { width: 1024, height: 1024 },
  "16:9": { width: 1344, height: 768 },
  "9:16": { width: 768, height: 1344 },
  "4:3": { width: 1152, height: 896 },
  "3:4": { width: 896, height: 1152 },
};

const ALLOWED_POLL_HOSTS = new Set([
  "api.bfl.ai",
  "api.bfl.ml",
]);

const ALLOWED_DOWNLOAD_HOSTS = new Set([
  "delivery-bfl.ai",
  "cdn.bfl.ai",
  "cdn.bfl.ml",
]);

export class BFLProvider implements MediaProvider {
  readonly name = "bfl";

  readonly capabilities: ProviderCapabilities = {
    supportsImageGeneration: true,
    supportsImageEditing: true,
    supportsVideoGeneration: false,
    supportsAudioGeneration: false,
    supportsTranscription: false,
    supportedImageAspectRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
    supportedVideoAspectRatios: [],
    supportedVideoResolutions: [],
    supportedAudioFormats: [],
    maxVideoDurationSeconds: 0,
  };

  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generateImage(params: ImageParams): Promise<GeneratedMedia> {
    const { model, ...options } = params.providerOptions ?? {};
    const modelName = (model as string | undefined) ?? IMAGE_MODEL;
    const { width, height } = this.mapAspectRatio(params.aspectRatio);
    const task = await this.submitTask(modelName, { prompt: params.prompt, width, height, ...options });
    const result = await this.pollTask(task.polling_url);
    const sample = result.result?.sample;
    if (!sample) throw new Error("BFL returned Ready status with no result sample");
    return this.downloadResult(sample, modelName);
  }

  async editImage(params: EditImageParams): Promise<GeneratedMedia> {
    const { model, ...options } = params.providerOptions ?? {};
    const modelName = (model as string | undefined) ?? EDIT_MODEL;
    const input_image = params.imageData.toString("base64");
    const task = await this.submitTask(modelName, { prompt: params.prompt, input_image, ...options });
    const result = await this.pollTask(task.polling_url);
    const sample = result.result?.sample;
    if (!sample) throw new Error("BFL returned Ready status with no result sample");
    return this.downloadResult(sample, modelName);
  }

  async generateVideo(_params: VideoParams): Promise<GeneratedMedia> {
    throw new Error("BFL does not support video generation");
  }

  async generateAudio(_params: AudioParams): Promise<GeneratedMedia> {
    throw new Error("BFL does not support audio generation");
  }

  private async submitTask(model: string, body: Record<string, unknown>): Promise<TaskSubmitResult> {
    this.validateModel(model);
    const response = await fetch(`${BFL_BASE_URL}/${model}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-key": this.apiKey },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`BFL task submission failed: ${response.status}`);
    }
    const task = await response.json() as TaskSubmitResult;
    this.validatePollingUrl(task.polling_url);
    return task;
  }

  private async pollTask(pollingUrl: string): Promise<TaskStatusResult> {
    return pollForCompletion(
      async (): Promise<TaskStatusResult> => {
        const response = await fetch(pollingUrl, {
          headers: { "x-key": this.apiKey },
        });
        if (!response.ok) {
          throw new Error(`BFL poll failed: ${response.status}`);
        }
        return response.json() as Promise<TaskStatusResult>;
      },
      (result) => {
        if (result.status === "Error" || result.status === "Failed") {
          throw new Error(`BFL task failed with status: ${result.status}`);
        }
        return result.status === "Ready";
      },
      { timeoutMs: 300_000, intervalMs: 3_000 },
    );
  }

  private async downloadResult(url: string, model: string): Promise<GeneratedMedia> {
    this.validateDownloadUrl(url);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`BFL image download failed: ${response.status}`);
    }
    const mimeType = response.headers.get("content-type") ?? "image/png";
    const data = Buffer.from(await response.arrayBuffer());
    return { data, mimeType, metadata: { model, provider: "bfl" } };
  }

  private validateModel(model: string): void {
    if (!ALLOWED_MODELS.has(model)) {
      throw new Error(`Unknown BFL model: ${model}. Allowed: ${[...ALLOWED_MODELS].join(", ")}`);
    }
  }

  private validatePollingUrl(url: string): void {
    const parsed = new URL(url);
    if (!ALLOWED_POLL_HOSTS.has(parsed.hostname)) {
      throw new Error(`Unexpected BFL polling host: ${parsed.hostname}`);
    }
  }

  private validateDownloadUrl(url: string): void {
    const parsed = new URL(url);
    if (!ALLOWED_DOWNLOAD_HOSTS.has(parsed.hostname)) {
      throw new Error(`Unexpected BFL download host: ${parsed.hostname}`);
    }
  }

  private mapAspectRatio(ratio: string): { width: number; height: number } {
    const dimensions = ASPECT_RATIO_MAP[ratio];
    if (!dimensions) {
      throw new Error(`BFL does not support aspect ratio: ${ratio}`);
    }
    return dimensions;
  }
}
