import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = dirname(fileURLToPath(import.meta.url));
const KIT_ROOT = resolve(__dirname, "../..");
function readJson(path) {
    return JSON.parse(readFileSync(path, "utf-8"));
}
function readText(path) {
    return readFileSync(path, "utf-8");
}
export function loadRunningHubData(kitRoot = KIT_ROOT) {
    const registry = readJson(resolve(kitRoot, "model-registry.public.json"));
    const pricing = readJson(resolve(kitRoot, "pricing.public.json"));
    const contract = readText(resolve(kitRoot, "rh-api-contract.md"));
    const llms = readText(resolve(kitRoot, "llms.txt"));
    const modelsByEndpoint = new Map();
    for (const model of registry.models) {
        modelsByEndpoint.set(model.endpoint, model);
    }
    const pricingByEndpoint = new Map(pricing.pricing.map((entry) => [entry.endpoint, entry]));
    return {
        registry,
        pricing,
        contract,
        llms,
        modelsByEndpoint,
        pricingByEndpoint,
    };
}
export function getModelOrThrow(data, endpoint) {
    const model = data.modelsByEndpoint.get(endpoint);
    if (!model) {
        throw new Error(`Unknown RunningHub endpoint: ${endpoint}`);
    }
    return model;
}
export function jsonToolResult(value) {
    return {
        content: [
            {
                type: "text",
                text: JSON.stringify(value, null, 2),
            },
        ],
    };
}
//# sourceMappingURL=data.js.map