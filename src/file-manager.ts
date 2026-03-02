import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import type { GeneratedMedia } from "./providers/types.js";

export class FileManager {
  private readonly outputDirectory: string;

  constructor(outputDirectory: string) {
    this.outputDirectory = resolve(outputDirectory);
  }

  async save(
    media: GeneratedMedia,
    type: "image" | "video" | "audio",
    outputDirectory?: string,
  ): Promise<string> {
    const targetDirectory = outputDirectory
      ? resolve(outputDirectory)
      : this.outputDirectory;

    await mkdir(targetDirectory, { recursive: true });

    const extension = this.getExtension(type, media.mimeType);
    const provider = (media.metadata.provider as string) || "unknown";
    const timestamp = Date.now();
    const random = randomBytes(4).toString("hex");
    const filename = `${type}-${timestamp}-${provider}-${random}.${extension}`;
    const filePath = join(targetDirectory, filename);

    await writeFile(filePath, media.data);
    return filePath;
  }

  private getExtension(type: "image" | "video" | "audio", mimeType: string): string {
    if (type === "video") return "mp4";
    if (type === "audio") {
      const audioExtensions: Record<string, string> = {
        "audio/mpeg": "mp3",
        "audio/opus": "opus",
        "audio/aac": "aac",
        "audio/flac": "flac",
        "audio/wav": "wav",
        "audio/pcm": "pcm",
      };
      return audioExtensions[mimeType] ?? "mp3";
    }
    const match = mimeType.match(/image\/(\w+)/);
    return match ? match[1] : "png";
  }
}
