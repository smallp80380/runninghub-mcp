# Upstream provenance and import record

This project uses a small, read-only subset of the official RunningHub MCP/data layer as a starting point. It is not the product implementation and it does not provide full-graph execution.

## Pinned source

- Repository: `https://github.com/HM-RunningHub/ComfyUI_RH_OpenAPI.git`
- Commit: `6dc03fd9655bb8729a561c5f5a1f73c4b285081d`
- Ref observed on 2026-09-07: `HEAD`, `refs/heads/main`
- Upstream MCP path: `developer-kit/mcp-server`
- License: Apache License 2.0; the original license is copied to `third_party/upstream/LICENSE`.
- Retrieval: `git clone --filter=blob:none --no-checkout`, followed by checkout of the pinned commit in a temporary directory outside this project.

## Imported scope

The following files are copied under `src/mcp/upstream/` without changing their upstream logic:

- `src/data.ts`
- `src/examplePayload.ts`
- `src/integrationGuide.ts`
- `src/pricing.ts`
- `src/search.ts`
- `src/tools.ts`
- `src/types.ts`
- `src/validation.ts`

This scope is intentionally limited to catalog/read-only helpers and validation. The upstream executable entry point, package metadata, public catalogs, and upstream test suite are not treated as the finished server. They will be integrated or replaced by the local L01 implementation with explicit tests.

## Integrity evidence

The imported-file SHA-256 values, byte sizes, origin, and source revision are recorded in `data/upstream/manifest.json`. The manifest uses `origin: "recorded"` only for files read from the pinned public repository; it is not evidence of a live RunningHub response.

## Known limitations

- The pinned upstream commit and source files are reproducible locally, but no RunningHub key was used.
- Full-graph Workflow API submit, custom-node availability, uploads, polling, outputs, cancellation, and MCP client acceptance are `NOT_RUN`.
- Upstream catalog/model helpers are not a substitute for the required graph editor or durable execution service.
