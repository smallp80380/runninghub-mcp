# Local capabilities snapshot

This document describes the local L05 boundary. It is not a live account capability report; call `rh_get_capabilities` for safe configuration booleans and separately verified runtime evidence.

| Capability | L01 status | Evidence |
| --- | --- | --- |
| Public catalog read/search | local | pinned files under `data/upstream/` and catalog contract tests |
| Payload type/enum/media URL validation | local | upstream helper import and contract tests |
| Price estimation | local snapshot | pinned pricing file; not billing authority |
| SQLite operational schema | local | migration/reopen unit test |
| MCP stdio initialize/tools/list/call | local | child-process transport test |
| Full-graph RunningHub execution | scoped live evidence | submit/status/output, one 2-second video workflow, upload, one structural graph workflow, cancel, and unknown-task not-found reconciliation have scoped evidence; natural expiry and account-wide compatibility remain unknown |
| Graph editing/revisions | local | L02 graph codec, atomic operations, CAS revisions, SQLite restore tests |
| Durable execution plan, reservation, expiry reconciliation, and job recovery contracts | local synthetic | `tests/execution/l05.test.mjs`, `ACCEPTANCE.md` `L05-RECOVERY-002`; provider-specific expiry capability remains unknown until live evidence |
| Project-owned media inspection, hash guard, tagged upload/cache, and submit substitution | local synthetic + scoped live upload | `tests/execution/l05.test.mjs`, `tests/mcp/stdio.test.mjs`, `ACCEPTANCE.md` `L05-LIVE-003`; only a synthetic media upload was live-verified |
| Dedicated LoRA upload and `RHLoraLoader` binding | local synthetic | `src/execution/lora.ts`, `tests/execution/l07.test.mjs`; MD5/get-upload-URL/signed PUT, profile-scoped tagged `fileName` cache, and non-loader rejection are covered offline; provider LoRA availability is unknown |
| Workflow media profile validation | local synthetic | `src/execution/media.ts`, `tests/execution/l07.test.mjs`; limits four image references/one mask/one video/six total, role and MIME checks, alpha PNG references, grayscale mask semantics, and EXIF orientation rejection run before upload/submit; provider/account limits remain unknown |
| Upload cache expiry and invalidation | local synthetic | `src/storage/database.ts`, `src/backends/workflow-api/client.ts`, `tests/execution/l07.test.mjs`; explicit expiry is persisted, stale entries are removed before reuse, and explicit cache failures do not retry submit; undocumented provider TTL remains unknown |
| Workflow API contracts and image override preflight | local synthetic | Legacy upload, separate V2 upload, legacy/V2 submit payloads, nested validation errors, durable workflow readiness, remote `LoadImage` preflight, and no-key logging are covered by `tests/execution/l05.test.mjs`; live account acceptance remains unverified |
| Project-folder API workflow discovery/import | local | `rh_import_workflow`, `tests/projects/l04.test.mjs`; only API-format JSON is a candidate and cloud availability remains unknown |
| Result originals, inline images, and MCP resource links | local | `rh_get_results` returns validated image content inline for automatic Codex rendering when the image is at most 16 MiB, plus opaque `runninghub://result/<id>` links; `resources/read` rechecks project root and content hash |
| Derived image previews and video posters | local | `DerivedMediaService` creates hash-aware PNG derivatives through fixed local ffmpeg invocation; `runninghub://derived/<id>` links are integrity-checked by `resources/read` |
| Result manifests and outbox publication | local | `ResultManifestService`, `.runninghub/runs/<job_id>/manifest.json`, migration 6 and L06 transport test |
| Result review events | local | `rh_review_result` persists one decision per saved result; repeated event IDs are idempotent and `rh_get_results` returns the current state |
| Explicit changes-requested revision | local | `rh_review_result` accepts a typed `revision_request`, creates a child revision and same-chain work item, and does not submit it |
| Review chain gate | local | `reserveJob` blocks active, incomplete-download, and unreviewed work in the same project chain |
| Explicit approval continuation | local | `rh_review_result` durably records an opt-in continuation intent and runs one prepared same-chain plan idempotently; bare approval does not submit |
| Agent workflow instruction | local | `docs/agent-workflow.md` and MCP initialize `instructions`; tool order, scene/asset handling, stop conditions, and no-automatic-approval boundary |
