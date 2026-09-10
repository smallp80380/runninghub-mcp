const MEDIA_TYPES = new Set(["IMAGE", "VIDEO", "AUDIO"]);
export function validatePayload(model, payload) {
    const errors = [];
    const warnings = [];
    const paramsByKey = new Map(model.params.map((param) => [param.fieldKey, param]));
    for (const param of model.params) {
        const value = payload[param.fieldKey];
        if (param.required && (isMissing(value) || (Array.isArray(value) && value.length === 0))) {
            errors.push(`Missing required parameter: ${param.fieldKey}`);
            continue;
        }
        if (isMissing(value)) {
            continue;
        }
        validateParamValue(param, value, errors);
    }
    for (const key of Object.keys(payload)) {
        if (!paramsByKey.has(key)) {
            warnings.push(`Unknown payload field: ${key}`);
        }
    }
    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
}
function validateParamValue(param, value, errors) {
    switch (param.type) {
        case "LIST": {
            const options = getOptionValues(param);
            if (options.length && !options.includes(String(value))) {
                errors.push(`Invalid enum value for ${param.fieldKey}: ${String(value)}. Allowed: ${options.join(", ")}`);
            }
            break;
        }
        case "BOOLEAN":
            if (typeof value !== "boolean") {
                errors.push(`Invalid boolean for ${param.fieldKey}: expected true/false, got ${typeof value}`);
            }
            break;
        case "INT":
            if (!Number.isSafeInteger(value)) {
                errors.push(`Invalid integer for ${param.fieldKey}: ${String(value)}`);
                break;
            }
            validateNumericBounds(param, value, errors);
            break;
        case "FLOAT":
            if (typeof value !== "number" || !Number.isFinite(value)) {
                errors.push(`Invalid number for ${param.fieldKey}: ${String(value)}`);
                break;
            }
            validateNumericBounds(param, value, errors);
            break;
        case "IMAGE":
        case "VIDEO":
        case "AUDIO":
            validateMediaValue(param, value, errors);
            break;
        case "STRING":
            if (typeof value !== "string") {
                errors.push(`Invalid string for ${param.fieldKey}: got ${typeof value}`);
            }
            else if (param.maxLength !== undefined && value.length > param.maxLength) {
                errors.push(`String too long for ${param.fieldKey}: maximum length is ${param.maxLength}`);
            }
            break;
        default:
            break;
    }
}
function validateNumericBounds(param, value, errors) {
    if (param.min !== undefined && value < param.min) {
        errors.push(`Value below minimum for ${param.fieldKey}: ${String(value)} < ${String(param.min)}`);
    }
    if (param.max !== undefined && value > param.max) {
        errors.push(`Value above maximum for ${param.fieldKey}: ${String(value)} > ${String(param.max)}`);
    }
    if (param.step !== undefined && param.step > 0) {
        const origin = param.min ?? 0;
        const steps = (value - origin) / param.step;
        if (Math.abs(steps - Math.round(steps)) > 1e-9) {
            errors.push(`Invalid step for ${param.fieldKey}: expected increments of ${String(param.step)}`);
        }
    }
}
function validateMediaValue(param, value, errors) {
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
        if (typeof item !== "string") {
            errors.push(`Invalid media URL for ${param.fieldKey}: expected URL string`);
            continue;
        }
        if (!isRemoteUrl(item) && !item.startsWith("asset://")) {
            errors.push(`Invalid media value for ${param.fieldKey}: local paths must be uploaded first via /media/upload/binary`);
        }
    }
}
export function isMediaParam(param) {
    return MEDIA_TYPES.has(String(param.type));
}
export function getOptionValues(param) {
    return (param.options || []).map((option) => {
        if (typeof option === "string") {
            return option;
        }
        return String(option.value);
    });
}
export function isMissing(value) {
    return value === undefined || value === null || value === "";
}
function isRemoteUrl(value) {
    return /^https?:\/\//i.test(value);
}
//# sourceMappingURL=validation.js.map