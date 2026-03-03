# CLAUDE.md

## Project

Multi-provider media generation MCP server (`@r16t/multimodal-mcp`).

## Commands

```bash
npm test          # Run tests (vitest)
npm run lint      # Lint with auto-fix (eslint)
npm run typecheck # TypeScript type check
npm run build     # Compile to build/
npm run dev       # Watch mode
```

## Architecture

- `src/server.ts` — MCP server entrypoint
- `src/providers/` — Provider implementations (openai, xai, google, elevenlabs, bfl)
- `src/providers/registry.ts` — Provider auto-discovery from env vars
- `src/providers/types.ts` — Shared provider interfaces
- `src/tools/` — MCP tool definitions (generate-image, generate-video, generate-audio, transcribe-audio, list-providers)
- `src/config.ts` — Environment variable loading
- `src/errors.ts` — Custom error types

## Publishing

Two registries must stay in sync: **npm** and the **MCP Registry**.

### Version Sync Checklist

When releasing a new version:

1. Bump `version` in `package.json`
2. Update `version` in `server.json` (top-level AND `packages[0].version`) to match
3. Build and verify: `npm run build && npm test && npm run typecheck`
4. Publish to npm: `npm publish --access public`
5. Publish to MCP Registry: `mcp-publisher publish`
6. Verify: `curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.rsmdt/multimodal"`

### Key Files

| File | Purpose |
|------|---------|
| `package.json` | npm package metadata. Contains `mcpName: "io.github.rsmdt/multimodal"` linking it to the MCP Registry |
| `server.json` | MCP Registry metadata. Describes the server for discovery by MCP clients (Claude Desktop, Cursor, VS Code, etc.) |

### Identity Mapping

| System | Identifier |
|--------|-----------|
| npm | `@r16t/multimodal-mcp` |
| MCP Registry | `io.github.rsmdt/multimodal` |
| GitHub | `rsmdt/multimodal-mcp` |

The `mcpName` field in `package.json` bridges npm to the MCP Registry. The registry verifies this field matches during publish.

### First-Time Setup

```bash
brew install mcp-publisher
mcp-publisher login github
```
