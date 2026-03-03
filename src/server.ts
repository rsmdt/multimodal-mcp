import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Config } from "./config.js";
import { ProviderRegistry } from "./providers/registry.js";
import { OpenAIProvider } from "./providers/openai.js";
import { XAIProvider } from "./providers/xai.js";
import { GoogleProvider } from "./providers/google.js";
import { ElevenLabsProvider } from "./providers/elevenlabs.js";
import { BFLProvider } from "./providers/bfl.js";
import { FileManager } from "./file-manager.js";
import { buildGenerateImageHandler } from "./tools/generate-image.js";
import { buildEditImageHandler } from "./tools/edit-image.js";
import { buildGenerateVideoHandler } from "./tools/generate-video.js";
import { buildGenerateAudioHandler } from "./tools/generate-audio.js";
import { buildTranscribeAudioHandler } from "./tools/transcribe-audio.js";
import { buildListProvidersHandler } from "./tools/list-providers.js";

export function createServer(config: Config) {
  const registry = new ProviderRegistry();
  const fileManager = new FileManager(config.outputDirectory);

  if (config.openaiApiKey) {
    registry.register(new OpenAIProvider(config.openaiApiKey));
    console.error("[server] Registered OpenAI provider");
  }
  if (config.xaiApiKey) {
    registry.register(new XAIProvider(config.xaiApiKey));
    console.error("[server] Registered xAI provider");
  }
  if (config.googleApiKey) {
    registry.register(new GoogleProvider(config.googleApiKey));
    console.error("[server] Registered Google provider");
  }
  if (config.elevenlabsApiKey) {
    registry.register(new ElevenLabsProvider(config.elevenlabsApiKey));
    console.error("[server] Registered ElevenLabs provider");
  }
  if (config.bflApiKey) {
    registry.register(new BFLProvider(config.bflApiKey));
    console.error("[server] Registered BFL provider");
  }

  const generateImageHandler = buildGenerateImageHandler(registry, fileManager);
  const editImageHandler = buildEditImageHandler(registry, fileManager);
  const generateVideoHandler = buildGenerateVideoHandler(registry, fileManager);
  const generateAudioHandler = buildGenerateAudioHandler(registry, fileManager);
  const transcribeAudioHandler = buildTranscribeAudioHandler(registry);
  const listProvidersHandler = buildListProvidersHandler(registry);

  const providerNames =
    registry.listCapabilities().map((p) => p.name).join(", ") || "none configured";

  const server = new McpServer({ name: "multimodal-mcp", version: "1.0.0" });

  server.tool(
    "generate_image",
    `Generate an image from a text prompt using AI. Providers: openai (DALL-E), xai (Aurora), google (Imagen), bfl (FLUX). Available: ${providerNames}`,
    {
      prompt: z.string().describe("Text description of the image to generate"),
      provider: z.string().optional().describe("Provider to use: openai, xai, google, bfl. Auto-selects if omitted."),
      aspectRatio: z.string().optional().describe("Aspect ratio: 1:1, 16:9, 9:16, 4:3, 3:4"),
      quality: z.string().optional().describe("Quality level: low, standard, high"),
      outputDirectory: z.string().optional().describe("Directory to save the generated file. Supports absolute or relative paths (resolved from cwd). Defaults to MEDIA_OUTPUT_DIR env var or cwd."),
      providerOptions: z.record(z.string(), z.unknown()).optional().describe("Provider-specific parameters passed through directly"),
    },
    async (params) => generateImageHandler(params),
  );

  server.tool(
    "edit_image",
    `Edit an existing image using AI. Provide the path to an image and a text prompt describing the desired edits. Providers: openai, xai, google, bfl (FLUX Kontext). Available: ${providerNames}`,
    {
      imagePath: z.string().describe("Absolute path to the source image file to edit"),
      prompt: z.string().describe("Text description of the edits to apply to the image"),
      provider: z.string().optional().describe("Provider to use: openai, xai, google, bfl. Auto-selects if omitted."),
      outputDirectory: z.string().optional().describe("Directory to save the edited file. Supports absolute or relative paths (resolved from cwd). Defaults to MEDIA_OUTPUT_DIR env var or cwd."),
      providerOptions: z.record(z.string(), z.unknown()).optional().describe("Provider-specific parameters passed through directly"),
    },
    async (params) => editImageHandler(params),
  );

  server.tool(
    "generate_video",
    `Generate a video from a text prompt using AI. Optionally provide an image as the first frame. Available providers: ${providerNames}`,
    {
      prompt: z.string().describe("Text description of the video to generate"),
      provider: z.string().optional().describe("Provider to use: openai, xai, google. Auto-selects if omitted."),
      duration: z.number().optional().describe("Video duration in seconds (provider limits apply)"),
      aspectRatio: z.string().optional().describe("Aspect ratio: 16:9, 9:16, 1:1"),
      resolution: z.string().optional().describe("Resolution: 480p, 720p, 1080p"),
      imagePath: z.string().optional().describe("Path to an image to use as the first frame of the video (OpenAI and Google only)"),
      outputDirectory: z.string().optional().describe("Directory to save the generated file. Supports absolute or relative paths (resolved from cwd). Defaults to MEDIA_OUTPUT_DIR env var or cwd."),
      providerOptions: z.record(z.string(), z.unknown()).optional().describe("Provider-specific parameters passed through directly"),
    },
    async (params) => generateVideoHandler(params),
  );

  server.tool(
    "generate_audio",
    `Generate audio from text using AI. Supports text-to-speech and sound effects. Providers: openai, google, elevenlabs. ElevenLabs: use providerOptions.mode = "sound-effect" for sound effects. Available: ${providerNames}`,
    {
      text: z.string().describe("Text to convert to speech, or a description of the sound effect to generate"),
      provider: z.string().optional().describe("Provider to use: openai, google, elevenlabs. Auto-selects if omitted."),
      voice: z.string().optional().describe("Voice name (provider-specific). OpenAI: alloy, ash, coral, echo, fable, nova, onyx, sage, shimmer. Google: Kore, Charon, Fenrir, Aoede, Puck, etc. ElevenLabs: voice ID."),
      speed: z.number().optional().describe("Speech speed multiplier (OpenAI only): 0.25 to 4.0"),
      format: z.string().optional().describe("Output format (OpenAI only): mp3, opus, aac, flac, wav, pcm"),
      outputDirectory: z.string().optional().describe("Directory to save the generated file. Supports absolute or relative paths (resolved from cwd). Defaults to MEDIA_OUTPUT_DIR env var or cwd."),
      providerOptions: z.record(z.string(), z.unknown()).optional().describe("Provider-specific parameters passed through directly"),
    },
    async (params) => generateAudioHandler(params),
  );

  server.tool(
    "transcribe_audio",
    `Transcribe audio to text using AI (speech-to-text). Providers: openai (Whisper), elevenlabs (Scribe). Available: ${providerNames}`,
    {
      audioPath: z.string().describe("Absolute path to the audio file to transcribe"),
      provider: z.string().optional().describe("Provider to use: openai, elevenlabs. Auto-selects if omitted."),
      language: z.string().optional().describe("Language code (e.g., 'en', 'fr', 'es') to hint the transcription language"),
      providerOptions: z.record(z.string(), z.unknown()).optional().describe("Provider-specific parameters passed through directly"),
    },
    async (params) => transcribeAudioHandler(params),
  );

  server.tool(
    "list_providers",
    "List all configured media generation providers and their capabilities",
    async () => listProvidersHandler(),
  );

  return server;
}
