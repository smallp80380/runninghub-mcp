# Technical decisions

## D-001 — 2026-09-07 — Pin upstream by commit and import a narrow read-only subset

- Decision: use `HM-RunningHub/ComfyUI_RH_OpenAPI` at commit `6dc03fd9655bb8729a561c5f5a1f73c4b285081d` as provenance for catalog/search/validation helpers, and copy only the eight TypeScript modules needed as a starting point.
- Rationale: the implementation plan explicitly selects this upstream MCP base, while the product must add graph editing, local revisions, storage, execution recovery, and review semantics. Importing the whole upstream package would obscure that boundary and could make a read-only API-model server look complete.
- Consequence: the local project owns the package boundary and tests. Any later modification of imported code must be recorded as a new decision and compared with the manifest hashes.

## D-002 — 2026-09-07 — Keep live backend evidence separate from source provenance

- Decision: record source files as `origin: "recorded"` fixtures, but mark every cloud execution and client acceptance case `NOT_RUN` until performed through the durable runner with an authorized profile.
- Rationale: a parser/unit test or public source checkout cannot prove that a RunningHub account accepts a structurally edited graph or that outputs are usable.
- Consequence: L01 and later offline tests may proceed without a key; L08 must retain an explicit `LIVE_PENDING`/`NOT_RUN` result if external access is unavailable.
