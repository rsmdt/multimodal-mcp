# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.4.0] - 2026-03-05

### Fixed

- Hardened BFL provider with URL validation, model allowlist, and polling improvements

## [1.3.1] - 2025-12-20

### Fixed

- Shortened server.json description to meet registry 100-char limit

## [1.3.0] - 2025-12-20

### Added

- MCP Registry metadata and publishing workflow

## [1.2.2] - 2025-12-19

### Fixed

- Correct API parameters for OpenAI and Google providers
- Add repository URL for npm provenance, remove invalid scoped bin entry

## [1.2.1] - 2025-12-19

### Fixed

- Use Node 24 for npm OIDC trusted publishing support
- Remove NPM_TOKEN, use OIDC trusted publisher auth
- Trigger release on tag push instead of workflow_run
- Restrict release workflow to main branch only

## [1.2.0] - 2025-12-19

### Added

- Register `edit_image` tool with `imagePath` support for `generate_video`
- Implement `editImage` across all providers, image-to-video for OpenAI and Gemini
- Add image editing types, shared file reader, and registry helper

## [1.1.0] - 2025-12-18

### Added

- BFL and ElevenLabs providers with transcription and image editing support
- xAI (Grok) provider for image and video generation
- Google Gemini provider for image, video, and audio generation
- `generate_video` tool
- `generate_audio` tool
- `transcribe_audio` tool
- `list_providers` tool

## [1.0.0] - 2025-12-17

### Added

- Initial release
- OpenAI provider for image generation
- MCP server with `generate_image` tool
- Provider registry with auto-discovery from environment variables
