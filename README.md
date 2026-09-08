# RunningHub MCP

The project is being implemented as a standalone TypeScript MCP server. The current local milestone is L06: local graph/project context, durable execution, validated result originals, and derived image previews/video posters. Cloud availability remains unverified.

## Local setup

```text
npm.cmd ci
npm.cmd run typecheck
npm.cmd run build
npm.cmd run test:acceptance:offline
```

The server uses Node.js `>=22.5.0` because L01 uses the built-in `node:sqlite` API. Run it with `npm.cmd start` or the installed `runninghub-mcp` binary. MCP protocol messages are written only to stdout; diagnostics go to stderr.

## Current tools

- `rh_get_capabilities`
- `rh_search_models`
- `rh_get_model_schema`
- `rh_estimate_price`
- `rh_validate_payload`
- `rh_get_integration_guide`
- `rh_build_example_payload`
- `rh_create_workflow`, `rh_get_workflow`, `rh_edit_workflow`, `rh_validate_workflow`, `rh_export_workflow`
- `rh_project`, `rh_scene`, `rh_work_item`, `rh_search_workflows`, `rh_import_workflow`
- `rh_asset`, `rh_prepare_generation`, `rh_run_workflow`, `rh_job`, `rh_get_results`, `rh_review_result`

The catalog tools are discovery/validation helpers from the pinned public snapshot. They do not prove account availability. `rh_asset` keeps project-owned asset metadata local and uploads through the built-in official Workflow API route. `rh_prepare_generation` creates a local immutable plan; submit and provider polling require the `RUNNINGHUB_WORKFLOW_API_KEY` described below. The upload route has only scoped live evidence for a synthetic asset and does not prove generation or account-wide availability. Workflow selection is runtime data: an explicit user workflow takes precedence, otherwise the project workflow context is used. `rh_get_results` downloads confirmed provider outputs into validated local original files without another submit, creates local PNG previews for images and first-frame PNG posters for videos through the configured ffmpeg executable, writes an immutable project-local manifest through the SQLite outbox, and returns opaque MCP resource links for originals and derivatives. `rh_review_result` records one idempotent user decision for a saved result; a bare approval never starts another generation, while an explicit `continuation` can run one already prepared next plan in the same chain. An explicit `revision_request` on `CHANGES_REQUESTED` creates a new local workflow revision and work item in the same chain without submitting it. Review state is local and derived from SQLite events. Audio derivatives are not implemented.

The structural live harness is opt-in and ephemeral: `npm.cmd run test:live -- --structural-graph --workflow-id <numeric-id> --resize-width <n> --resize-height <n>`. It requires `RUNNINGHUB_LIVE_CASES=full`, changes only an explicitly selected or unambiguous `width`/`height` node, and must be run only after explicit permission for a paid submit. It does not persist the acceptance workflow.

The cancellation live harness is opt-in and ephemeral: `npm.cmd run test:live -- --cancel --workflow-id <numeric-id>`. It requires `RUNNINGHUB_LIVE_CASES=full` and explicit permission for one submit followed by provider cancellation; it does not persist the acceptance workflow.

The ephemeral generation probe can use `--duration-seconds <n>` to override a linked video length input for a short authorized test; this is scoped to the selected workflow and does not prove account-wide compatibility or natural expiry.

Configuration is described in [`docs/configuration.md`](docs/configuration.md). Provenance and live-test limits are in [`UPSTREAM.md`](UPSTREAM.md) and [`ACCEPTANCE.md`](ACCEPTANCE.md).
