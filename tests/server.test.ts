import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted mocks accessible inside vi.mock factory functions
const { mockTool, mockRegister, mockListCapabilities } = vi.hoisted(() => ({
  mockTool: vi.fn(),
  mockRegister: vi.fn(),
  mockListCapabilities: vi.fn().mockReturnValue([]),
}));

vi.mock("@modelcontextprotocol/sdk/server/mcp.js", () => ({
  McpServer: vi.fn(function () {
    return { tool: mockTool, connect: vi.fn() };
  }),
}));

vi.mock("../src/providers/registry.js", () => ({
  ProviderRegistry: vi.fn(function () {
    return {
      register: mockRegister,
      getProvider: vi.fn(),
      getImageProviders: vi.fn().mockReturnValue([]),
      getVideoProviders: vi.fn().mockReturnValue([]),
      getAudioProviders: vi.fn().mockReturnValue([]),
      listCapabilities: mockListCapabilities,
    };
  }),
}));

vi.mock("../src/providers/openai.js", () => ({
  OpenAIProvider: vi.fn(function (_apiKey: string) {
    return { name: "openai", capabilities: {} };
  }),
}));

vi.mock("../src/providers/xai.js", () => ({
  XAIProvider: vi.fn(function (_apiKey: string) {
    return { name: "xai", capabilities: {} };
  }),
}));

vi.mock("../src/providers/google.js", () => ({
  GoogleProvider: vi.fn(function (_apiKey: string) {
    return { name: "google", capabilities: {} };
  }),
}));

vi.mock("../src/file-manager.js", () => ({
  FileManager: vi.fn(function (_dir: string) {
    return { save: vi.fn() };
  }),
}));

vi.mock("../src/tools/generate-image.js", () => ({
  buildGenerateImageHandler: vi.fn(() => vi.fn()),
}));

vi.mock("../src/tools/generate-video.js", () => ({
  buildGenerateVideoHandler: vi.fn(() => vi.fn()),
}));

vi.mock("../src/tools/generate-audio.js", () => ({
  buildGenerateAudioHandler: vi.fn(() => vi.fn()),
}));

vi.mock("../src/tools/list-providers.js", () => ({
  buildListProvidersHandler: vi.fn(() => vi.fn()),
}));

import { createServer } from "../src/server.js";

describe("createServer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListCapabilities.mockReturnValue([]);
  });

  it("returns a server object without error", () => {
    const config = { outputDirectory: "/tmp" };
    const server = createServer(config);
    expect(server).toBeDefined();
  });

  it("registers OpenAI provider when openaiApiKey is provided", () => {
    const config = { openaiApiKey: "sk-test", outputDirectory: "/tmp" };
    createServer(config);
    expect(mockRegister).toHaveBeenCalledTimes(1);
  });

  it("registers all three providers when all API keys are configured", () => {
    const config = {
      openaiApiKey: "sk-test",
      xaiApiKey: "xai-test",
      googleApiKey: "google-test",
      outputDirectory: "/tmp",
    };
    createServer(config);
    expect(mockRegister).toHaveBeenCalledTimes(3);
  });

  it("registers no providers when no API keys are configured", () => {
    const config = { outputDirectory: "/tmp" };
    createServer(config);
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it("registers all four tools", () => {
    const config = { outputDirectory: "/tmp" };
    createServer(config);
    expect(mockTool).toHaveBeenCalledTimes(4);

    const toolNames = mockTool.mock.calls.map((call: unknown[]) => call[0]);
    expect(toolNames).toContain("generate_image");
    expect(toolNames).toContain("generate_video");
    expect(toolNames).toContain("generate_audio");
    expect(toolNames).toContain("list_providers");
  });

  it("includes dynamic provider names in generate_image tool description", () => {
    mockListCapabilities.mockReturnValue([
      { name: "openai", capabilities: {} },
      { name: "google", capabilities: {} },
    ]);
    createServer({ outputDirectory: "/tmp" });

    const imageCall = mockTool.mock.calls.find((call: unknown[]) => call[0] === "generate_image");
    expect(imageCall).toBeDefined();
    expect(imageCall![1]).toContain("openai");
    expect(imageCall![1]).toContain("google");
  });

  it("includes dynamic provider names in generate_video tool description", () => {
    mockListCapabilities.mockReturnValue([
      { name: "xai", capabilities: {} },
    ]);
    createServer({ outputDirectory: "/tmp" });

    const videoCall = mockTool.mock.calls.find((call: unknown[]) => call[0] === "generate_video");
    expect(videoCall).toBeDefined();
    expect(videoCall![1]).toContain("xai");
  });
});
