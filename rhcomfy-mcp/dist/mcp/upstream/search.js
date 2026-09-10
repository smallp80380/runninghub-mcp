import { summarizePricing } from "./pricing.js";
import { isMediaParam } from "./validation.js";
export function searchModels(data, input) {
    const query = normalize(input.query || "");
    const limit = Math.min(Math.max(input.limit || 10, 1), 50);
    const results = data.registry.models
        .filter((model) => matchesOutputType(model, input.output_type))
        .filter((model) => matchesMediaInput(model, input.has_media_input))
        .filter((model) => matchesQuery(model, query))
        .map((model) => ({
        score: scoreModel(model, query),
        model,
        pricing: data.pricingByEndpoint.get(model.endpoint),
    }))
        .filter((item) => matchesMaxPrice(item.pricing, input.max_price))
        .sort((a, b) => b.score - a.score || a.model.endpoint.localeCompare(b.model.endpoint))
        .slice(0, limit);
    return {
        count: results.length,
        models: results.map(({ model, pricing }) => ({
            endpoint: model.endpoint,
            name_cn: model.name_cn,
            name_en: model.name_en,
            output_type: model.output_type,
            category: model.category,
            pricing_summary: summarizePricing(pricing),
            inputs: model.params.map((param) => ({
                fieldKey: param.fieldKey,
                type: param.type,
                required: param.required,
            })),
        })),
    };
}
function matchesOutputType(model, outputType) {
    return !outputType || model.output_type === outputType;
}
function matchesMediaInput(model, hasMediaInput) {
    if (hasMediaInput === undefined) {
        return true;
    }
    const hasMedia = model.params.some(isMediaParam);
    return hasMedia === hasMediaInput;
}
function matchesQuery(model, query) {
    if (!query) {
        return true;
    }
    const haystack = normalize([
        model.endpoint,
        model.name_cn,
        model.name_en,
        model.display_name,
        model.category,
        model.output_type,
        ...model.params.map((param) => `${param.fieldKey} ${param.type} ${param.description || ""}`),
    ].join(" "));
    return query.split(/\s+/).filter(Boolean).every((token) => haystack.includes(token));
}
function scoreModel(model, query) {
    if (!query) {
        return 0;
    }
    const endpoint = normalize(model.endpoint);
    const name = normalize(`${model.name_en || ""} ${model.name_cn || ""}`);
    let score = 0;
    for (const token of query.split(/\s+/).filter(Boolean)) {
        if (endpoint.includes(token)) {
            score += 5;
        }
        if (name.includes(token)) {
            score += 3;
        }
    }
    return score;
}
function matchesMaxPrice(pricing, maxPrice) {
    if (maxPrice === undefined || !pricing) {
        return true;
    }
    if (pricing.pricing_type === "fixed" && typeof pricing.price === "number") {
        return pricing.price <= maxPrice;
    }
    if (pricing.rules?.length) {
        return Math.min(...pricing.rules.map((rule) => rule.price)) <= maxPrice;
    }
    return true;
}
function normalize(value) {
    return value.toLowerCase().replace(/[-_/]/g, " ");
}
//# sourceMappingURL=search.js.map