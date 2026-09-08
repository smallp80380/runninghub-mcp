# Configuration

The server has no embedded credentials and never accepts an API key in tool arguments or workflow JSON. Local state variables are:

| Variable | Default | Purpose |
| --- | --- | --- |
| `RUNNINGHUB_DATA_DIR` | `%USERPROFILE%/.runninghub` | Local operational data directory |
| `RUNNINGHUB_DB_PATH` | `<data dir>/runninghub.sqlite` | SQLite path; use only for an explicitly selected absolute path |
| `RUNNINGHUB_CATALOG_DIR` | `<working directory>/data/upstream` | Pinned public catalog snapshot |
| `RUNNINGHUB_PROJECT_ROOT` | unset | Reserved project root for later packages |
| `RUNNINGHUB_FFMPEG_PATH` | `ffmpeg` on `PATH` | Local executable used for image previews and video posters |

Successful `rh_get_results` calls also write an immutable manifest to `.runninghub/runs/<job_id>/manifest.json` under the registered project root. SQLite stores its idempotent `result_manifest` publication event in the outbox; the manifest review snapshot starts at `PENDING_REVIEW`. `rh_review_result` stores the user decision as a durable idempotent event. With `CHANGES_REQUESTED`, an explicit typed `revision_request` creates a child local revision and a new work item in the original chain; it never prepares or submits a provider task. A bare `APPROVED` never starts another generation. An explicit `continuation` can durably arm one already prepared same-chain plan and submit it idempotently; the continuation still requires the configured backend. Subsequent `rh_get_results` calls return the current review state.

To enable the L05 Workflow API adapter, set only the API key. It is read into process memory and is never accepted in MCP arguments, stored in SQLite, or returned by capabilities:

| Variable | Purpose |
| --- | --- |
| `RUNNINGHUB_WORKFLOW_API_KEY` | Secret bearer key supplied by the environment |

The adapter determines the official host and routes internally: `https://www.runninghub.ai`, Workflow API `/openapi/v2`, task query `/openapi/v2/query`, media upload `/openapi/v2/media/upload/binary`, and cancellation `/task/openapi/cancel`. A selected workflow endpoint or ID is runtime data, not an environment variable. The agent may use a workflow explicitly named by the user or resolve a local project workflow; the test workflow used during acceptance must not be persisted as a project workflow.

`rh_prepare_generation` is local and does not submit. `rh_asset` can inspect/register/prepare assets locally; its `upload` action and asset-bearing `rh_run_workflow` use the built-in upload route. `rh_run_workflow` and provider-dependent `rh_job` actions return `CAPABILITY_UNKNOWN` when the key is absent. Upload, submit, polling, outputs, cancellation, and unknown-task reconciliation have scoped live evidence for one configured profile; local recovery normalizes explicit expiry/not-found responses without resubmitting, but natural expiry remains unverified.

The opt-in structural probe is separate from the server tools: `npm.cmd run test:live -- --structural-graph --workflow-id <numeric-id> --resize-width <n> --resize-height <n>`. It requires `RUNNINGHUB_LIVE_CASES=full` and explicit permission for a paid submit. It refuses ambiguous resize-node selection and keeps all state ephemeral.

The opt-in cancellation probe is also separate from server tools: `npm.cmd run test:live -- --cancel --workflow-id <numeric-id>`. It requires `RUNNINGHUB_LIVE_CASES=full` and explicit permission for one submit followed by provider cancellation; it keeps workflow and task state ephemeral.

The ephemeral generation probe accepts `--duration-seconds <n>` for a supported linked video length input. This changes only the in-memory submitted snapshot; it is intended for a short authorized probe and does not prove account-wide workflow compatibility or natural task expiry.

For a clean offline run from the repository root:

```powershell
$env:RUNNINGHUB_DATA_DIR = Join-Path $PWD ".tmp\runninghub-data"
npm.cmd start
```

Do not send keys, signed URLs, private payloads, or arbitrary filesystem paths through MCP tools. Live testing is opt-in and requires `RUNNINGHUB_LIVE_CASES=full`; it must not persist the acceptance workflow in a project.
