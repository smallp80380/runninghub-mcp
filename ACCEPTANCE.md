# Acceptance evidence

Statuses are factual. `NOT_RUN` is not a pass and does not prove backend compatibility.

| ID | Area | Kind | Status | Evidence | Limitation |
| --- | --- | --- | --- | --- | --- |
| L00-SOURCE-001 | Pinned upstream commit exists and is reproducible | recorded_contract | PASS | `UPSTREAM.md`, `data/upstream/manifest.json` | Public source provenance only; no cloud execution evidence |
| L00-SOURCE-002 | Apache-2.0 license retained | recorded_contract | PASS | `third_party/upstream/LICENSE`, `UPSTREAM.md` | Requires preserving notices for future copied/modified files |
| L00-API-001 | Full-graph Workflow API submit with structural graph change | live | NOT_RUN | — | No authorized profile/key was supplied |
| L00-API-002 | New graph, media upload, status, outputs, cancellation | live | NOT_RUN | — | No authorized profile/key was supplied |
| L00-MCP-001 | Real stdio initialize/tools-list/tool-call | mcp | NOT_RUN | — | Executable server is an L01 deliverable |
| L01-BUILD-001 | TypeScript typecheck and production build | unit | PASS | `npm.cmd run typecheck`, `npm.cmd run build` | Uses Node.js >=22.5.0 and built-in experimental `node:sqlite` |
| L01-STORAGE-001 | SQLite migration/reopen is idempotent | unit | PASS | `tests/unit/storage.test.mjs` | No concurrent process recovery yet |
| L01-CATALOG-001 | Pinned catalog search and payload validation without network | recorded_contract | PASS | `tests/contract/catalog.test.mjs` | Snapshot does not prove account/model availability |
| L01-MCP-001 | Child-process initialize/tools-list/read-only tool call | mcp | PASS | `tests/mcp/stdio.test.mjs` | Only L01 read-only tools are exposed |
| L01-MCP-002 | Tool failure has `isError=true`, `ok=false`, stable error code | mcp | PASS | `tests/mcp/stdio.test.mjs` | Full execution error taxonomy comes in later packages |
| L01-LIVE-001 | Explicit live test gate | live | NOT_RUN | `npm.cmd run test:live` (exit 2) | No authorized profile/cases; this is an expected release-gate result |
| L02-CODEC-001 | API graph import/export preserves large integer tokens | unit | PASS | `tests/graph/graph.test.mjs` | Nested unsafe literal numbers require tagged direct inputs |
| L02-GRAPH-001 | Draft graph, add/connect, literal array vs link, atomic rollback | unit | PASS | `tests/graph/graph.test.mjs` | Supported node semantics come from supplied schema catalog |
| L02-REV-001 | Immutable CAS revisions and SQLite restart restore | unit | PASS | `tests/graph/graph.test.mjs` | Project must be registered before revision persistence |
| L02-MCP-001 | Create/edit workflow via real stdio tools | mcp | PASS | `tests/mcp/stdio.test.mjs` | Local graph only; no submit |
| L02-LIVE-001 | Structurally changed graph executes in RunningHub | live | NOT_RUN | — | No authorized profile/key and L05 durable backend runner is not implemented |
| L03-BLOCK-001 | Insert block twice with namespaced ownership; remove one without deleting shared loader | unit | PASS | `tests/catalog/l03.test.mjs` | Synthetic block profile only |
| L03-MODEL-001 | Unsupported model family/loader returns explicit conflict | unit | PASS | `tests/catalog/l03.test.mjs` | Availability is synthetic/unknown, not cloud proof |
| L03-UI-001 | Supported UI JSON preserves links and mapped widget values | unit | PASS | `tests/catalog/l03.test.mjs` | Limited profile; not full frontend compatibility |
| L03-UI-002 | Unknown UI extension rejected with original source retained | unit | PASS | `tests/catalog/l03.test.mjs` | Caller must choose supported profile/API export |
| L04-PROJECT-001 | Two projects with same `02B` alias resolve isolated scenes/assets | unit | PASS | `tests/projects/l04.test.mjs` | Synthetic temporary projects only |
| L04-ASSET-001 | Changed asset hash and missing required role are explicit errors | unit | PASS | `tests/projects/l04.test.mjs` | No media decode/dimensions yet |
| L04-SCENE-001 | Ambiguous alias is rejected; no arbitrary scene choice | unit | PASS | `tests/projects/l04.test.mjs` | Scene normalization is stored structured input |
| L04-LIBRARY-001 | Workflow search honors output/role/profile/hard constraints | unit | PASS | `tests/projects/l04.test.mjs` | Starter cards synthetic and availability unknown |
| L04-WORKFLOW-001 | Registered project discovers API-format workflow JSON and excludes unrelated JSON/assets | unit | PASS | `tests/projects/l04.test.mjs`, `tests/mcp/stdio.test.mjs` | Project-folder discovery is local; provider availability remains unknown |
| L05-EXEC-001 | Durable reservation, single-submit intent, unknown-submit recovery, polling, provider failure, empty output handling, and retryable outputs | synthetic_contract | PASS | `tests/execution/l05.test.mjs` | Synthetic backend only; no provider or download live evidence |
| L05-ASSET-001 | Project-root/hash-checked asset upload, tagged provider reference, cache reuse, and `asset://` submit substitution | synthetic_contract | PASS | `tests/execution/l05.test.mjs` | Synthetic backend only; no user data or live upload |
| L05-RECOVERY-001 | Crash-after-intent and two file-backed stores do not create a second submit | synthetic_contract | PASS | `tests/execution/l05.test.mjs` | Synthetic backend only; live recovery remains NOT_RUN |
| L05-RECOVERY-002 | Explicit provider expiry/not-found reconciles after restart without outputs or a second submit | synthetic_contract | PASS | `tests/execution/l05.test.mjs` | Only normalized terminal markers are covered; provider-specific live expiry remains unknown |
| L05-MCP-001 | Prepare plan and expose run/job tools through real stdio transport; missing backend is explicit capability error | mcp | PASS | `tests/mcp/stdio.test.mjs` | `rh_run_workflow` intentionally does not submit without configured profile |
| L05-LIVE-001 | Authorized Workflow API submit/status/outputs/cancel through configured profile | live | PASS | `PROGRESS.md` STEP-0034, STEP-0044, STEP-0061, STEP-0067 | Evidence is split across scoped ephemeral probes for one configured profile; provider expiry/reconciliation and account-wide compatibility are not covered |
| L05-LIVE-002 | Authorized ephemeral workflow submit, status polling, and output query through the durable runner | live | PASS | `scripts/test-live.mjs --duration-seconds 2`, `PROGRESS.md` STEP-0215 | One user-supplied video workflow/profile only; short duration was overridden to 2 seconds; cancel, natural expiry, and account-wide compatibility were not exercised |
| L05-LIVE-003 | Authorized Workflow API media upload with tagged reference and local cache reuse | live | PASS | `scripts/test-live.mjs --upload-only`, `PROGRESS.md` STEP-0044 | Synthetic 1x1 PNG only; no user data or generation submit; provider reference is intentionally not recorded |
| L05-LIVE-004 | Authorized ephemeral structurally changed graph executes and returns outputs | live | PASS | `scripts/test-live.mjs --structural-graph`, `PROGRESS.md` STEP-0061 | One workflow/node/profile only; output readiness was confirmed, but output dimensions and account-wide compatibility were not measured |
| L05-LIVE-005 | Authorized ephemeral Workflow API task is cancelled through the durable runner | live | PASS | `scripts/test-live.mjs --cancel`, `PROGRESS.md` STEP-0067 | One workflow/profile only; provider cancel response confirmed `CANCELLED`, without account-wide compatibility or natural expiry evidence |
| L05-LIVE-006 | Authorized read-only unknown-task status reconciles explicit provider not-found/expiry marker | live | PASS | `scripts/test-live.mjs --expiry --task-id 9223372036854775807`, `PROGRESS.md` STEP-0088 | One profile and one unknown task ID; natural expiry of an existing task remains unverified |
| L07-LORA-001 | Dedicated LoRA upload/cache and `RHLoraLoader` binding | synthetic_contract | PASS | `tests/execution/l07.test.mjs`, `tests/unit/storage.test.mjs` | MD5/get-upload-URL/signed PUT and profile-scoped `fileName` cache are offline-only; real profile LoRA availability and signed URL expiry remain NOT_RUN |

## Evidence policy

- Synthetic fixtures are suitable for deterministic offline tests only.
- A successful source import or parser test must never be upgraded to a recorded/live backend result.
- Live cases will be added with sanitized evidence paths and without keys, private payloads, or signed URLs.
