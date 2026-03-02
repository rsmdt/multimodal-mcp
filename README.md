# multimodal-mcp

Multi-provider media generation MCP server. Generate images, videos, and audio from text prompts using OpenAI, xAI, and Gemini through a single unified interface.

## Features

- 🎨 **Image Generation** — Generate images via OpenAI (gpt-image-1), xAI (grok-imagine-image), or Gemini (imagen-4)
- 🎬 **Video Generation** — Generate videos via OpenAI (sora-2), xAI (grok-imagine-video), or Gemini (veo-3.1)
- 🔊 **Audio Generation** — Text-to-speech via OpenAI (tts-1) or Gemini (gemini-2.5-flash-preview-tts)
- 🔄 **Auto-Discovery** — Automatically detects configured providers from environment variables
- 🎯 **Provider Selection** — Auto-selects or explicitly choose a provider per request
- 📁 **File Output** — Saves all generated media to disk with descriptive filenames

## Quick Start

Set the API key for at least one provider. Most users only need one — add more to access additional providers.

```bash
# Using OpenAI
claude mcp add multimodal-mcp -e OPENAI_API_KEY=sk-... -- npx @r16t/multimodal-mcp

# Or using xAI
# claude mcp add multimodal-mcp -e XAI_API_KEY=xai-... -- npx @r16t/multimodal-mcp

# Or using Gemini
# claude mcp add multimodal-mcp -e GEMINI_API_KEY=AIza... -- npx @r16t/multimodal-mcp
```

Using a different editor? See [setup instructions](#editor-setup) for Claude Desktop, Cursor, VS Code, Windsurf, and Cline.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | At least one provider key | OpenAI API key — enables image, video, and audio generation via gpt-image-1, sora-2, and tts-1 |
| `XAI_API_KEY` | At least one provider key | xAI API key — enables image and video generation via grok-imagine-image and grok-imagine-video |
| `GEMINI_API_KEY` | At least one provider key | Gemini API key — enables image, video, and audio generation via imagen-4, veo-3.1, and gemini-2.5-flash-preview-tts |
| `GOOGLE_API_KEY` | — | Alias for `GEMINI_API_KEY`; either name is accepted |
| `MEDIA_OUTPUT_DIR` | No | Directory for saved media files. Defaults to the system temp directory |

## Available Tools

### `generate_image`

Generate an image from a text prompt.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompt` | string | Yes | Text description of the image to generate |
| `provider` | string | No | Provider to use: `openai`, `xai`, `google`. Auto-selects if omitted |
| `aspectRatio` | string | No | Aspect ratio: `1:1`, `16:9`, `9:16`, `4:3`, `3:4` |
| `quality` | string | No | Quality level: `low`, `standard`, `high` |
| `providerOptions` | object | No | Provider-specific parameters passed through directly |

### `generate_video`

Generate a video from a text prompt. Video generation is asynchronous and may take several minutes.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompt` | string | Yes | Text description of the video to generate |
| `provider` | string | No | Provider to use: `openai`, `xai`, `google`. Auto-selects if omitted |
| `duration` | number | No | Video duration in seconds (provider limits apply) |
| `aspectRatio` | string | No | Aspect ratio: `16:9`, `9:16`, `1:1` |
| `resolution` | string | No | Resolution: `480p`, `720p`, `1080p` |
| `providerOptions` | object | No | Provider-specific parameters passed through directly |

### `generate_audio`

Generate audio (text-to-speech) from text. Audio generation is synchronous.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `text` | string | Yes | Text to convert to speech |
| `provider` | string | No | Provider to use: `openai`, `google`. Auto-selects if omitted |
| `voice` | string | No | Voice name (provider-specific). OpenAI: `alloy`, `ash`, `coral`, `echo`, `fable`, `nova`, `onyx`, `sage`, `shimmer`. Google: `Kore`, `Charon`, `Fenrir`, `Aoede`, `Puck`, etc. |
| `speed` | number | No | Speech speed multiplier (OpenAI only): `0.25` to `4.0` |
| `format` | string | No | Output format (OpenAI only): `mp3`, `opus`, `aac`, `flac`, `wav`, `pcm` |
| `providerOptions` | object | No | Provider-specific parameters passed through directly |

### `list_providers`

List all configured media generation providers and their capabilities. Takes no parameters.

## Provider Capabilities

| Provider | Image | Video | Audio | Image Model | Video Model | Audio Model |
|----------|:-----:|:-----:|:-----:|-------------|-------------|-------------|
| OpenAI | ✅ | ✅ | ✅ | gpt-image-1 | sora-2 | tts-1 |
| xAI | ✅ | ✅ | — | grok-imagine-image | grok-imagine-video | — |
| Gemini | ✅ | ✅ | ✅ | imagen-4 | veo-3.1 | gemini-2.5-flash-preview-tts |

### Image Aspect Ratios

| Provider | 1:1 | 16:9 | 9:16 | 4:3 | 3:4 |
|----------|:---:|:----:|:----:|:---:|:---:|
| OpenAI | ✅ | ✅ | ✅ | ✅ | ✅ |
| xAI | ✅ | ✅ | ✅ | ✅ | ✅ |
| Gemini | ✅ | ✅ | ✅ | ✅ | ✅ |

### Video Aspect Ratios & Resolutions

| Provider | 16:9 | 9:16 | 1:1 | 480p | 720p | 1080p |
|----------|:----:|:----:|:---:|:----:|:----:|:-----:|
| OpenAI | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| xAI | ✅ | ✅ | ✅ | — | ✅ | ✅ |
| Gemini | ✅ | ✅ | — | — | ✅ | ✅ |

### Audio Formats

| Provider | mp3 | opus | aac | flac | wav | pcm |
|----------|:---:|:----:|:---:|:----:|:---:|:---:|
| OpenAI | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Gemini | — | — | — | — | ✅ | — |

## Troubleshooting

### No providers configured

```
[config] No provider API keys detected
```

Set at least one of `OPENAI_API_KEY`, `XAI_API_KEY`, or `GEMINI_API_KEY` in the MCP server's `env` block.

### Provider not available for requested media type

All three providers support image and video generation. Audio generation (text-to-speech) is supported by OpenAI and Gemini. xAI does not currently offer a standalone TTS API. If you specify a `provider` that isn't configured (no API key) or doesn't support the requested media type, you'll receive an error. Omit the `provider` parameter to auto-select from configured providers.

### Video generation timeout

Video generation polls for up to 10 minutes. If your video hasn't completed in that window, the request will fail with a timeout error. Try a shorter `duration` or a simpler `prompt`.

### xAI image generation returned no data

This indicates the xAI API returned an empty response. Check that your `XAI_API_KEY` is valid and that your prompt does not violate xAI content policies.

### Gemini image/video generation failed: 403

Verify your `GEMINI_API_KEY` has the Generative Language API enabled in Google Cloud Console.

## Development

```bash
npm run build      # Compile TypeScript to build/
npm test           # Run tests with Vitest
npm run lint       # Lint and auto-fix with ESLint
npm run typecheck  # Type-check without emitting
npm run dev        # Watch mode for TypeScript compilation
```

## Editor Setup

Replace `OPENAI_API_KEY` with your provider of choice (`XAI_API_KEY`, `GEMINI_API_KEY`). You can set multiple keys to enable multiple providers.

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "multimodal-mcp": {
      "command": "npx",
      "args": ["@r16t/multimodal-mcp"],
      "env": {
        "OPENAI_API_KEY": "sk-..."
      }
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json` in your project root (or `~/.cursor/mcp.json` globally):

```json
{
  "mcpServers": {
    "multimodal-mcp": {
      "command": "npx",
      "args": ["@r16t/multimodal-mcp"],
      "env": {
        "OPENAI_API_KEY": "sk-..."
      }
    }
  }
}
```

### VS Code (GitHub Copilot)

Add to `.vscode/mcp.json` in your project root:

```json
{
  "servers": {
    "multimodal-mcp": {
      "command": "npx",
      "args": ["@r16t/multimodal-mcp"],
      "env": {
        "OPENAI_API_KEY": "sk-..."
      }
    }
  }
}
```

### Windsurf

Add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "multimodal-mcp": {
      "command": "npx",
      "args": ["@r16t/multimodal-mcp"],
      "env": {
        "OPENAI_API_KEY": "sk-..."
      }
    }
  }
}
```

### Cline

Add to `~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`:

```json
{
  "mcpServers": {
    "multimodal-mcp": {
      "command": "npx",
      "args": ["@r16t/multimodal-mcp"],
      "env": {
        "OPENAI_API_KEY": "sk-..."
      }
    }
  }
}
```

## License

MIT
