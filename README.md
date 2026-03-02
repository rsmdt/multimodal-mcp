# multimodal-mcp

Multi-provider media generation MCP server. Generate images, videos, and audio from text prompts using OpenAI, xAI, and Google through a single unified interface.

## Features

- 🎨 **Image Generation** — Generate images via OpenAI (gpt-image-1), xAI (grok-imagine-image), or Google (imagen-4)
- 🎬 **Video Generation** — Generate videos via OpenAI (sora-2), xAI (grok-imagine-video), or Google (veo-3.1)
- 🔊 **Audio Generation** — Text-to-speech via OpenAI (tts-1) or Google (gemini-2.5-flash-preview-tts)
- 🔄 **Auto-Discovery** — Automatically detects configured providers from environment variables
- 🎯 **Provider Selection** — Auto-selects or explicitly choose a provider per request
- 📁 **File Output** — Saves all generated media to disk with descriptive filenames

## Quick Start

### Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "multimodal-mcp": {
      "command": "npx",
      "args": ["multimodal-mcp"],
      "env": {
        "OPENAI_API_KEY": "sk-...",
        "XAI_API_KEY": "xai-...",
        "GOOGLE_API_KEY": "AIza...",
        "MEDIA_OUTPUT_DIR": "/tmp/media"
      }
    }
  }
}
```

You only need to set keys for the providers you want to use. At least one is required.

### Cursor / Other MCP Clients

```json
{
  "mcpServers": {
    "multimodal-mcp": {
      "command": "npx",
      "args": ["multimodal-mcp"],
      "env": {
        "OPENAI_API_KEY": "sk-..."
      }
    }
  }
}
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | At least one provider key | OpenAI API key — enables image, video, and audio generation via gpt-image-1, sora-2, and tts-1 |
| `XAI_API_KEY` | At least one provider key | xAI API key — enables image and video generation via grok-imagine-image and grok-imagine-video |
| `GOOGLE_API_KEY` | At least one provider key | Google API key — enables image, video, and audio generation via imagen-4, veo-3.1, and gemini-2.5-flash-preview-tts |
| `GEMINI_API_KEY` | — | Alias for `GOOGLE_API_KEY`; either name is accepted |
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
| Google | ✅ | ✅ | ✅ | imagen-4 | veo-3.1 | gemini-2.5-flash-preview-tts |

### Image Aspect Ratios

| Provider | 1:1 | 16:9 | 9:16 | 4:3 | 3:4 |
|----------|:---:|:----:|:----:|:---:|:---:|
| OpenAI | ✅ | ✅ | ✅ | ✅ | ✅ |
| xAI | ✅ | ✅ | ✅ | ✅ | ✅ |
| Google | ✅ | ✅ | ✅ | ✅ | ✅ |

### Video Aspect Ratios & Resolutions

| Provider | 16:9 | 9:16 | 1:1 | 480p | 720p | 1080p |
|----------|:----:|:----:|:---:|:----:|:----:|:-----:|
| OpenAI | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| xAI | ✅ | ✅ | ✅ | — | ✅ | ✅ |
| Google | ✅ | ✅ | — | — | ✅ | ✅ |

### Audio Formats

| Provider | mp3 | opus | aac | flac | wav | pcm |
|----------|:---:|:----:|:---:|:----:|:---:|:---:|
| OpenAI | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Google | — | — | — | — | ✅ | — |

## Troubleshooting

### No providers configured

```
[config] No provider API keys detected
```

Set at least one of `OPENAI_API_KEY`, `XAI_API_KEY`, or `GOOGLE_API_KEY` in the MCP server's `env` block.

### Provider not available for requested media type

All three providers support image and video generation. Audio generation (text-to-speech) is supported by OpenAI and Google. xAI does not currently offer a standalone TTS API. If you specify a `provider` that isn't configured (no API key) or doesn't support the requested media type, you'll receive an error. Omit the `provider` parameter to auto-select from configured providers.

### Video generation timeout

Video generation polls for up to 10 minutes. If your video hasn't completed in that window, the request will fail with a timeout error. Try a shorter `duration` or a simpler `prompt`.

### xAI image generation returned no data

This indicates the xAI API returned an empty response. Check that your `XAI_API_KEY` is valid and that your prompt does not violate xAI content policies.

### Google image/video generation failed: 403

Verify your `GOOGLE_API_KEY` has the Generative Language API enabled in Google Cloud Console.

## Development

```bash
npm run build      # Compile TypeScript to build/
npm test           # Run tests with Vitest
npm run lint       # Lint and auto-fix with ESLint
npm run typecheck  # Type-check without emitting
npm run dev        # Watch mode for TypeScript compilation
```

## License

MIT
