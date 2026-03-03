import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";

const EXTENSION_TO_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".flac": "audio/flac",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".opus": "audio/opus",
  ".webm": "audio/webm",
};

export async function readMediaFile(
  filePath: string,
): Promise<{ data: Buffer; mimeType: string }> {
  const absolutePath = resolve(filePath);
  const extension = extname(absolutePath).toLowerCase();
  const mimeType = EXTENSION_TO_MIME[extension];

  if (!mimeType) {
    const supported = Object.keys(EXTENSION_TO_MIME).join(", ");
    throw new Error(
      `Unsupported file extension "${extension}". Supported: ${supported}`,
    );
  }

  const data = await readFile(absolutePath);
  return { data: Buffer.from(data), mimeType };
}
