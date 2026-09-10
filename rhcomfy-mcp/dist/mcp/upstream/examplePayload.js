import { getOptionValues, isMediaParam } from "./validation.js";
export function buildExamplePayload(model, mode = "minimal") {
    const payload = {};
    const localFiles = {};
    const notes = [];
    for (const param of model.params) {
        const include = param.required || mode === "with_optional_defaults";
        if (!include) {
            continue;
        }
        if (isMediaParam(param)) {
            const placeholderUrl = param.multipleInputs || isArrayField(param.fieldKey)
                ? [`<uploaded-${mediaName(param)}-url>`]
                : `<uploaded-${mediaName(param)}-url>`;
            payload[param.fieldKey] = placeholderUrl;
            localFiles[param.fieldKey] = [`./input.${defaultExtension(param)}`];
            notes.push(`${param.fieldKey}: upload local media via /media/upload/binary, then use data.download_url.`);
            continue;
        }
        const value = exampleValueForParam(param);
        if (value !== undefined) {
            payload[param.fieldKey] = value;
            if (param.defaultValue !== undefined) {
                notes.push(`${param.fieldKey}: uses schema default value.`);
            }
        }
    }
    return {
        endpoint: model.endpoint,
        output_type: model.output_type,
        payload,
        local_files: localFiles,
        notes,
    };
}
function exampleValueForParam(param) {
    if (param.defaultValue !== undefined) {
        return normalizeDefaultValue(param);
    }
    switch (param.type) {
        case "STRING":
            return promptLike(param.fieldKey) ? "A cinematic cat in neon light" : "example";
        case "LIST":
            return getOptionValues(param)[0];
        case "BOOLEAN":
            return false;
        case "INT":
            return typeof param.min === "number" ? param.min : 1;
        case "FLOAT":
            return typeof param.min === "number" ? param.min : 1.0;
        default:
            return undefined;
    }
}
function normalizeDefaultValue(param) {
    if (param.type === "BOOLEAN" && typeof param.defaultValue === "string") {
        return ["true", "1", "yes"].includes(param.defaultValue.toLowerCase());
    }
    if (param.type === "INT" && typeof param.defaultValue === "string") {
        const parsed = Number.parseInt(param.defaultValue, 10);
        return Number.isNaN(parsed) ? param.defaultValue : parsed;
    }
    if (param.type === "FLOAT" && typeof param.defaultValue === "string") {
        const parsed = Number.parseFloat(param.defaultValue);
        return Number.isNaN(parsed) ? param.defaultValue : parsed;
    }
    return param.defaultValue;
}
function promptLike(fieldKey) {
    return ["prompt", "text", "description"].includes(fieldKey.toLowerCase());
}
function isArrayField(fieldKey) {
    return fieldKey.endsWith("Urls") || fieldKey === "videos";
}
function mediaName(param) {
    return String(param.type).toLowerCase();
}
function defaultExtension(param) {
    if (param.type === "VIDEO") {
        return "mp4";
    }
    if (param.type === "AUDIO") {
        return "mp3";
    }
    return "png";
}
//# sourceMappingURL=examplePayload.js.map