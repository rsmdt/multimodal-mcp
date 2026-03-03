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

const BASE_URL = "https://api.elevenlabs.io/v1";
const DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";
const DEFAULT_TTS_MODEL = "eleven_flash_v2_5";
const TRANSCRIPTION_MODEL = "scribe_v1";

export class ElevenLabsProvider implements MediaProvider {
  readonly name = "elevenlabs";

  readonly capabilities: ProviderCapabilities = {
    supportsImageGeneration: false,
    supportsImageEditing: false,
    supportsVideoGeneration: false,
    supportsAudioGeneration: true,
    supportsTranscription: true,
    supportedImageAspectRatios: [],
    supportedVideoAspectRatios: [],
    supportedVideoResolutions: [],
    supportedAudioFormats: ["mp3", "pcm", "ulaw", "opus"],
    maxVideoDurationSeconds: 0,
  };

  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generateImage(_params: ImageParams): Promise<GeneratedMedia> {
    throw new Error("ElevenLabs does not support image generation");
  }

  async editImage(_params: EditImageParams): Promise<GeneratedMedia> {
    throw new Error("ElevenLabs does not support image editing");
  }

  async generateVideo(_params: VideoParams): Promise<GeneratedMedia> {
    throw new Error("ElevenLabs does not support video generation");
  }

  async generateAudio(params: AudioParams): Promise<GeneratedMedia> {
    const mode = params.providerOptions?.mode;
    if (mode === "sound-effect") {
      return this.generateSoundEffect(params);
    }
    return this.generateSpeech(params);
  }

  async transcribeAudio(params: TranscribeParams): Promise<TranscribedText> {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(params.audioData)], { type: params.audioMimeType });
    formData.append("file", blob, "audio");
    formData.append("model_id", TRANSCRIPTION_MODEL);
    if (params.language) {
      formData.append("language_code", params.language);
    }

    const response = await fetch(`${BASE_URL}/speech-to-text`, {
      method: "POST",
      headers: { "xi-api-key": this.apiKey },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs transcription failed: ${response.status}`);
    }

    const result = (await response.json()) as { text: string };
    return {
      text: result.text,
      metadata: { model: TRANSCRIPTION_MODEL, provider: "elevenlabs" },
    };
  }

  private async generateSpeech(params: AudioParams): Promise<GeneratedMedia> {
    const voiceId = params.voice ?? DEFAULT_VOICE_ID;
    const options = params.providerOptions ?? {};
    const modelId = (options.model as string | undefined) ?? DEFAULT_TTS_MODEL;
    const filtered = Object.fromEntries(
      Object.entries(options).filter(([k]) => k !== "mode" && k !== "model"),
    );

    const response = await fetch(`${BASE_URL}/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "xi-api-key": this.apiKey },
      body: JSON.stringify({ text: params.text, model_id: modelId, ...filtered }),
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs TTS failed: ${response.status}`);
    }

    return {
      data: Buffer.from(await response.arrayBuffer()),
      mimeType: "audio/mpeg",
      metadata: { model: modelId, provider: "elevenlabs", voice: voiceId },
    };
  }

  private async generateSoundEffect(params: AudioParams): Promise<GeneratedMedia> {
    const filtered = Object.fromEntries(
      Object.entries(params.providerOptions ?? {}).filter(([k]) => k !== "mode"),
    );

    const response = await fetch(`${BASE_URL}/text-to-sound-effects`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "xi-api-key": this.apiKey },
      body: JSON.stringify({ text: params.text, ...filtered }),
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs sound effect generation failed: ${response.status}`);
    }

    return {
      data: Buffer.from(await response.arrayBuffer()),
      mimeType: "audio/mpeg",
      metadata: { provider: "elevenlabs" },
    };
  }
}
