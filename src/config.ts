import { z } from "zod";

const configSchema = z.object({
  openaiApiKey: z.string().optional(),
  xaiApiKey: z.string().optional(),
  googleApiKey: z.string().optional(),
  elevenlabsApiKey: z.string().optional(),
  bflApiKey: z.string().optional(),
  outputDirectory: z.string(),
});

export type Config = z.infer<typeof configSchema>;

function resolveGeminiKey(): string | undefined {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || undefined;
}

export function loadConfig(): Config {
  const config = configSchema.parse({
    openaiApiKey: process.env.OPENAI_API_KEY || undefined,
    xaiApiKey: process.env.XAI_API_KEY || undefined,
    googleApiKey: resolveGeminiKey(),
    elevenlabsApiKey: process.env.ELEVENLABS_API_KEY || undefined,
    bflApiKey: process.env.BFL_API_KEY || undefined,
    outputDirectory: process.env.MEDIA_OUTPUT_DIR || process.cwd(),
  });

  const detected: string[] = [];
  if (config.openaiApiKey) detected.push("OpenAI");
  if (config.xaiApiKey) detected.push("xAI");
  if (config.googleApiKey) detected.push("Gemini");
  if (config.elevenlabsApiKey) detected.push("ElevenLabs");
  if (config.bflApiKey) detected.push("BFL");

  if (detected.length > 0) {
    console.error(`[config] Detected providers: ${detected.join(", ")}`);
  } else {
    console.error("[config] No provider API keys detected");
  }

  return config;
}
