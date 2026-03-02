import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { FileManager } from "../src/file-manager.js";
import { mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";

describe("FileManager", () => {
  let testDir: string;
  let fileManager: FileManager;

  beforeEach(async () => {
    testDir = join(tmpdir(), `media-mcp-test-${randomBytes(4).toString("hex")}`);
    await mkdir(testDir, { recursive: true });
    fileManager = new FileManager(testDir);
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it("saves image buffer to correct directory", async () => {
    const media = {
      data: Buffer.from("fake-image-data"),
      mimeType: "image/png",
      metadata: { provider: "openai" },
    };
    const filePath = await fileManager.save(media, "image");
    expect(filePath.startsWith(testDir)).toBe(true);
    const content = await readFile(filePath);
    expect(content.toString()).toBe("fake-image-data");
  });

  it("generates filename with timestamp and provider", async () => {
    const media = {
      data: Buffer.from("test"),
      mimeType: "image/png",
      metadata: { provider: "openai" },
    };
    const filePath = await fileManager.save(media, "image");
    const filename = filePath.split("/").pop()!;
    expect(filename).toMatch(/^image-\d+-openai-[a-f0-9]+\.png$/);
  });

  it("creates directory if missing", async () => {
    const nestedDir = join(testDir, "nested", "deep");
    const fm = new FileManager(nestedDir);
    const media = {
      data: Buffer.from("test"),
      mimeType: "image/png",
      metadata: { provider: "test" },
    };
    const filePath = await fm.save(media, "image");
    expect(filePath.startsWith(nestedDir)).toBe(true);
  });

  it("returns absolute path", async () => {
    const media = {
      data: Buffer.from("test"),
      mimeType: "image/png",
      metadata: { provider: "test" },
    };
    const filePath = await fileManager.save(media, "image");
    expect(filePath.startsWith("/")).toBe(true);
  });

  it("handles image type with .png extension", async () => {
    const media = {
      data: Buffer.from("test"),
      mimeType: "image/png",
      metadata: { provider: "test" },
    };
    const filePath = await fileManager.save(media, "image");
    expect(filePath.endsWith(".png")).toBe(true);
  });

  it("handles video type with .mp4 extension", async () => {
    const media = {
      data: Buffer.from("test-video"),
      mimeType: "video/mp4",
      metadata: { provider: "google" },
    };
    const filePath = await fileManager.save(media, "video");
    expect(filePath.endsWith(".mp4")).toBe(true);
    const filename = filePath.split("/").pop()!;
    expect(filename).toMatch(/^video-\d+-google-[a-f0-9]+\.mp4$/);
  });
});
