# Supported schema and UI profiles

L03 deliberately supports one explicit synthetic profile:

- `synthetic-basic@1` — `Source`, `Transform`, `Save`, `SharedLoader`, `ModelConsumer`, and `Reroute`.
- UI adapter `comfyui-ui-basic-v1` — root layout, numeric/string node IDs, links, mapped `Transform` prompt/seed widgets, `Save` filename widget, and modes `0`/`4`.
- Model profile evidence: `fixtures/contracts/schema-profiles.json`, origin `synthetic`, backend scope `synthetic-offline`.

Unknown node classes, widget positions without an explicit mapping, unsupported node modes, root extensions, and unrecognized UI fields are rejected with the original UI JSON available on `UiCodecError.source_json`. No local ComfyUI `object_info` or synthetic schema is presented as proof of RunningHub cloud availability.
