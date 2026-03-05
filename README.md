# multimodal-mcp

Multi-provider media generation MCP server. Generate images, videos, audio, and transcriptions from text prompts using OpenAI, xAI, Gemini, ElevenLabs, and BFL (FLUX) through a single unified interface.

## Features

- 🎨 **Image Generation** — Generate images via OpenAI (gpt-image-1), xAI (grok-imagine-image), Gemini (imagen-4), or BFL (FLUX Pro 1.1)
- ✏️ **Image Editing** — Edit images via OpenAI, xAI, Gemini, or BFL (FLUX Kontext)
- 🎬 **Video Generation** — Generate videos via OpenAI (sora-2), xAI (grok-imagine-video), or Gemini (veo-3.1)
- 🔊 **Audio Generation** — Text-to-speech via OpenAI (tts-1), Gemini, or ElevenLabs (Flash v2.5). Sound effects via ElevenLabs
- 🎙️ **Audio Transcription** — Speech-to-text via OpenAI (Whisper) or ElevenLabs (Scribe)
- 🔄 **Auto-Discovery** — Automatically detects configured providers from environment variables
- 🎯 **Provider Selection** — Auto-selects or explicitly choose a provider per request
- 📁 **File Output** — Saves all generated media to disk with descriptive filenames

## Quick Start

Set the API key for at least one provider. Most users only need one — add more to access additional providers.

```bash
# Using OpenAI
claude mcp add multimodal-mcp -e OPENAI_API_KEY=sk-... -- npx -y @r16t/multimodal-mcp@latest

# Or using xAI
# claude mcp add multimodal-mcp -e XAI_API_KEY=xai-... -- npx -y @r16t/multimodal-mcp@latest

# Or using Gemini
# claude mcp add multimodal-mcp -e GEMINI_API_KEY=AIza... -- npx -y @r16t/multimodal-mcp@latest

# Or using ElevenLabs (audio + transcription)
# claude mcp add multimodal-mcp -e ELEVENLABS_API_KEY=xi-... -- npx -y @r16t/multimodal-mcp@latest

# Or using BFL/FLUX (images)
# claude mcp add multimodal-mcp -e BFL_API_KEY=... -- npx -y @r16t/multimodal-mcp@latest
```

Using a different editor? See [setup instructions](#editor-setup) for Claude Desktop, Cursor, VS Code, Windsurf, and Cline.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | At least one provider key | OpenAI API key — enables image, video, audio generation, and transcription via gpt-image-1, sora-2, tts-1, and whisper-1 |
| `XAI_API_KEY` | At least one provider key | xAI API key — enables image and video generation via grok-imagine-image and grok-imagine-video |
| `GEMINI_API_KEY` | At least one provider key | Gemini API key — enables image, video, and audio generation via imagen-4, veo-3.1, and gemini-2.5-flash-preview-tts |
| `GOOGLE_API_KEY` | — | Alias for `GEMINI_API_KEY`; either name is accepted |
| `ELEVENLABS_API_KEY` | At least one provider key | ElevenLabs API key — enables audio generation (TTS, sound effects) and transcription via Flash v2.5 and Scribe v1 |
| `BFL_API_KEY` | At least one provider key | BFL API key — enables image generation and editing via FLUX Pro 1.1 and FLUX Kontext |
| `MEDIA_OUTPUT_DIR` | No | Directory for saved media files. Defaults to the current working directory |

## Available Tools

### `generate_image`

Generate an image from a text prompt.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompt` | string | Yes | Text description of the image to generate |
| `provider` | string | No | Provider to use: `openai`, `xai`, `google`, `bfl`. Auto-selects if omitted |
| `aspectRatio` | string | No | Aspect ratio: `1:1`, `16:9`, `9:16`, `4:3`, `3:4` |
| `quality` | string | No | Quality level: `low`, `standard`, `high` |
| `outputDirectory` | string | No | Directory to save the generated file. Absolute or relative path. Defaults to `MEDIA_OUTPUT_DIR` or cwd |
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
| `outputDirectory` | string | No | Directory to save the generated file. Absolute or relative path. Defaults to `MEDIA_OUTPUT_DIR` or cwd |
| `providerOptions` | object | No | Provider-specific parameters passed through directly |

### `generate_audio`

Generate audio from text. Supports text-to-speech and sound effects. Audio generation is synchronous.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `text` | string | Yes | Text to convert to speech, or a description of the sound effect to generate |
| `provider` | string | No | Provider to use: `openai`, `google`, `elevenlabs`. Auto-selects if omitted |
| `voice` | string | No | Voice name (provider-specific). OpenAI: `alloy`, `ash`, `coral`, `echo`, `fable`, `nova`, `onyx`, `sage`, `shimmer`. Google: `Kore`, `Charon`, `Fenrir`, `Aoede`, `Puck`, etc. ElevenLabs: voice ID |
| `speed` | number | No | Speech speed multiplier (OpenAI only): `0.25` to `4.0` |
| `format` | string | No | Output format (OpenAI only): `mp3`, `opus`, `aac`, `flac`, `wav`, `pcm` |
| `outputDirectory` | string | No | Directory to save the generated file. Absolute or relative path. Defaults to `MEDIA_OUTPUT_DIR` or cwd |
| `providerOptions` | object | No | Provider-specific parameters passed through directly. ElevenLabs: set `mode: "sound-effect"` for sound effects, `model` for TTS model selection |

### `transcribe_audio`

Transcribe audio to text (speech-to-text).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `audioPath` | string | Yes | Absolute path to the audio file to transcribe |
| `provider` | string | No | Provider to use: `openai`, `elevenlabs`. Auto-selects if omitted |
| `language` | string | No | Language code (e.g., `en`, `fr`, `es`) to hint the transcription language |
| `providerOptions` | object | No | Provider-specific parameters passed through directly |

### `list_providers`

List all configured media generation providers and their capabilities. Takes no parameters.

## Provider Capabilities

| Provider | Image | Image Editing | Video | Audio | Transcription | Key Models |
|----------|:-----:|:------------:|:-----:|:-----:|:------------:|------------|
| OpenAI | ✅ | ✅ | ✅ | ✅ | ✅ | gpt-image-1, sora-2, tts-1, whisper-1 |
| xAI | ✅ | ✅ | ✅ | — | — | grok-imagine-image, grok-imagine-video |
| Gemini | ✅ | ✅ | ✅ | ✅ | — | imagen-4, veo-3.1, gemini-2.5-flash-preview-tts |
| ElevenLabs | — | — | — | ✅ | ✅ | eleven_flash_v2_5, scribe_v1 |
| BFL | ✅ | ✅ | — | — | — | flux-pro-1.1, flux-kontext-pro |

### Image Aspect Ratios

| Provider | 1:1 | 16:9 | 9:16 | 4:3 | 3:4 |
|----------|:---:|:----:|:----:|:---:|:---:|
| OpenAI | ✅ | ✅ | ✅ | ✅ | ✅ |
| xAI | ✅ | ✅ | ✅ | ✅ | ✅ |
| Gemini | ✅ | ✅ | ✅ | ✅ | ✅ |
| BFL | ✅ | ✅ | ✅ | ✅ | ✅ |

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
| ElevenLabs | ✅ | ✅ | — | — | — | ✅ |

## Troubleshooting

### No providers configured

```
[config] No provider API keys detected
```

Set at least one of `OPENAI_API_KEY`, `XAI_API_KEY`, `GEMINI_API_KEY`, `ELEVENLABS_API_KEY`, or `BFL_API_KEY` in the MCP server's `env` block.

### Provider not available for requested media type

Each provider supports different media types (see [Provider Capabilities](#provider-capabilities)). If you specify a `provider` that isn't configured (no API key) or doesn't support the requested media type, you'll receive an error. Omit the `provider` parameter to auto-select from configured providers.

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

Replace `OPENAI_API_KEY` with your provider of choice (`XAI_API_KEY`, `GEMINI_API_KEY`, `ELEVENLABS_API_KEY`, `BFL_API_KEY`). You can set multiple keys to enable multiple providers.

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "multimodal-mcp": {
      "command": "npx",
      "args": ["@r16t/multimodal-mcp@latest"],
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
      "args": ["@r16t/multimodal-mcp@latest"],
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
      "args": ["@r16t/multimodal-mcp@latest"],
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
      "args": ["@r16t/multimodal-mcp@latest"],
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
      "args": ["@r16t/multimodal-mcp@latest"],
      "env": {
        "OPENAI_API_KEY": "sk-..."
      }
    }
  }
}
```

## License

MIT
