# Local capabilities snapshot

This document describes the local L05 boundary. It is not a live account capability report; call `rh_get_capabilities` for the same explicit `unknown`/`not_verified` status at runtime.

| Capability | L01 status | Evidence |
| --- | --- | --- |
| Public catalog read/search | local | pinned files under `data/upstream/` and catalog contract tests |
| Payload type/enum/media URL validation | local | upstream helper import and contract tests |
| Price estimation | local snapshot | pinned pricing file; not billing authority |
| SQLite operational schema | local | migration/reopen unit test |
| MCP stdio initialize/tools/list/call | local | child-process transport test |
| Full-graph RunningHub execution | scoped live evidence | submit/status/output, upload, one structural graph workflow, cancel, and unknown-task not-found reconciliation have scoped evidence; natural expiry and account-wide compatibility remain unknown |
| Graph editing/revisions | local | L02 graph codec, atomic operations, CAS revisions, SQLite restore tests |
| Durable execution plan, reservation, expiry reconciliation, and job recovery contracts | local synthetic | `tests/execution/l05.test.mjs`, `ACCEPTANCE.md` `L05-RECOVERY-002`; provider-specific expiry capability remains unknown until live evidence |
| Project-owned asset inspection, hash guard, tagged upload/cache, and submit substitution | local synthetic + scoped live upload | `tests/execution/l05.test.mjs`, `tests/mcp/stdio.test.mjs`, `ACCEPTANCE.md` `L05-LIVE-003`; only a synthetic asset upload was live-verified |
| Project-folder API workflow discovery/import | local | `rh_import_workflow`, `tests/projects/l04.test.mjs`; only API-format JSON is a candidate and cloud availability remains unknown |
| Result originals and MCP resource links | local | `rh_get_results` returns opaque `runninghub://result/<id>` links; `resources/read` rechecks project root and content hash |
| Derived image previews and video posters | local | `DerivedMediaService` creates hash-aware PNG derivatives through fixed local ffmpeg invocation; `runninghub://derived/<id>` links are integrity-checked by `resources/read` |
| Result manifests and outbox publication | local | `ResultManifestService`, `.runninghub/runs/<job_id>/manifest.json`, migration 6 and L06 transport test |
| Result review and chain gate | not implemented | L06 |
