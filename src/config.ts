import { z } from "zod";
import { tmpdir } from "node:os";

const configSchema = z.object({
  openaiApiKey: z.string().optional(),
  xaiApiKey: z.string().optional(),
  googleApiKey: z.string().optional(),
  outputDirectory: z.string(),
});

export type Config = z.infer<typeof configSchema>;

function resolveGoogleKey(): string | undefined {
  return process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || undefined;
}

export function loadConfig(): Config {
  const config = configSchema.parse({
    openaiApiKey: process.env.OPENAI_API_KEY || undefined,
    xaiApiKey: process.env.XAI_API_KEY || undefined,
    googleApiKey: resolveGoogleKey(),
    outputDirectory: process.env.MEDIA_OUTPUT_DIR || tmpdir(),
  });

  const detected: string[] = [];
  if (config.openaiApiKey) detected.push("OpenAI");
  if (config.xaiApiKey) detected.push("xAI");
  if (config.googleApiKey) detected.push("Google");

  if (detected.length > 0) {
    console.error(`[config] Detected providers: ${detected.join(", ")}`);
  } else {
    console.error("[config] No provider API keys detected");
  }

  return config;
}
