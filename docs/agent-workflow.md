# Agent Workflow

This instruction describes the supported sequence for an agent using the RunningHub MCP server. It is also summarized in the MCP `initialize` response as server instructions.

## Sequence

1. Establish project context with `rh_project` using `register`, `inspect`, or `index`. Keep every later operation scoped to the selected `project_id`.
2. Resolve or read the requested scene with `rh_scene`. Use the indexed project documents and their source references to extract the scene. Store mandatory constraints separately from preferences. Do not invent a required asset that is absent.
3. Create one `rh_work_item` for the user request. Keep its `work_item_id`, `project_id`, and `chain_id` through preparation, execution, and review.
4. Select a workflow with `rh_search_workflows`, or import/create one with `rh_import_workflow` or `rh_create_workflow`. Inspect it with `rh_get_workflow`, apply structural edits with `rh_edit_workflow`, and run `rh_validate_workflow` after edits. A `DRAFT` can be stored while a graph is being built; an invalid or unverified graph is not runnable.
5. Inspect or register only project-owned assets with `rh_asset`. Preserve the registered role, content hash, and order of reference bindings. Use `rh_upload_lora` for an asset with the `lora` role. LoRA references are dedicated to `RHLoraLoader` and must not use regular media upload.
6. Call `rh_prepare_generation` with the exact work item, immutable workflow revision, asset bindings, backend profile, and output contract. This creates a local plan and does not submit a provider task.
7. Call `rh_run_workflow` once for the prepared plan with a stable `request_id`. A repeated request returns the existing local job. Do not repeat a paid submit after a timeout or lost response.
8. Use `rh_job` for `status`, bounded `wait`, or `resume`. If submit state is uncertain, preserve `SUBMIT_UNKNOWN` and reconcile the existing job instead of submitting again. If a real provider task ID is found outside the MCP, call `rh_job resume` with that exact `provider_task_id`, then call `rh_job wait`; never guess or invent an ID.
9. After confirmed provider success, call `rh_get_results`. Present any returned inline image content directly in the current chat, and retain the validated original files, derived preview/poster links, and manifest. Download retry is not generation retry.
10. Present the result and stop for the user's response. Call `rh_review_result` only for an explicit user decision about that exact result.
11. For `CHANGES_REQUESTED`, send an explicit typed `revision_request` and preserve the prior revision/result. A bare `APPROVED` does not start another generation. Use `continuation` only when the user explicitly requests the already prepared same-chain continuation.

## Scene And Assets

The agent extracts scene meaning from project documents; the MCP stores the normalized scene and validates its shape. Scene aliases must resolve uniquely. Required roles may include characters, location, prop, style, composition, first/last frame, mask, or motion reference. A missing or changed required asset is an error, not permission to substitute an arbitrary file.

Media limits, alpha handling, mask semantics, and JPEG orientation checks are local supported-profile rules. They do not prove account-wide provider limits. Do not claim a model, node, LoRA, or workflow is cloud-compatible unless the capability response contains corresponding evidence.

## Stop Conditions

Stop before submission and report the structured error when:

- the project or scene is missing, ambiguous, or outside the selected project;
- a required asset is missing, changed, or outside the current work item;
- graph structure, input types, connections, or required outputs are invalid;
- backend compatibility is `unknown` or `unsupported` for the requested production run;
- local media rules reject the planned references, mask, video, or total input count.

Stop after execution and do not create a review when:

- the provider returns an application error, explicit failure, cancellation, or uncertain submit;
- the output list is empty or local result validation/download fails;
- the user has not yet responded to a `PENDING_REVIEW` result.

Never expose `RUNNINGHUB_WORKFLOW_API_KEY`, signed upload URLs, private payloads, or arbitrary filesystem paths in tool arguments, workflow JSON, manifests, or messages. Do not use mock or synthetic tests as live evidence, and do not silently retry a paid submit.
