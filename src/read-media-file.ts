import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";

const EXTENSION_TO_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
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
