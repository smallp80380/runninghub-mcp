import { AppError } from "../errors.js";
import { isLoraAsset } from "./lora.js";
export const WORKFLOW_MEDIA_PROFILE = {
    id: "runninghub-workflow-media-v1",
    max_reference_images: 4,
    max_masks: 1,
    max_videos: 1,
    max_total_inputs: 6,
};
function isObject(value) {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
function roles(asset) {
    try {
        const value = JSON.parse(asset.roles_json);
        return new Set(Array.isArray(value) ? value.filter((role) => typeof role === "string").map((role) => role.trim().toLowerCase()) : []);
    }
    catch {
        return new Set();
    }
}
function mediaError(message, context = {}) {
    throw new AppError("INVALID_CONFIGURATION", message, {
        context,
        recoverable: true,
        suggestedFix: "Use the selected media profile and bind project-owned media with matching roles and representations.",
    });
}
function mediaKind(representation, asset) {
    const value = representation.toLowerCase();
    if (value === "mask" || value.endsWith("_mask") || value === "image_mask")
        return "mask";
    if (value === "video" || value === "motion_video")
        return "video";
    if (asset.mime.toLowerCase().startsWith("video/"))
        return "video";
    if (asset.mime.toLowerCase().startsWith("image/"))
        return "reference";
    mediaError(`Asset ${asset.id} has unsupported media MIME ${asset.mime}.`, { asset_id: asset.id });
}
function assetReference(value) {
    if (typeof value !== "string" || !value.startsWith("asset://"))
        return undefined;
    const reference = value.slice("asset://".length);
    const separator = reference.lastIndexOf("/");
    if (separator <= 0 || separator === reference.length - 1) {
        mediaError(`Asset reference ${value} is malformed.`);
    }
    return { asset_id: reference.slice(0, separator), representation: reference.slice(separator + 1) };
}
function collectReferences(value, nodeId, inputName, assets, output) {
    const reference = assetReference(value);
    if (reference) {
        const asset = assets.get(reference.asset_id);
        if (!asset)
            throw new AppError("ASSET_MISSING", `Asset ${reference.asset_id} referenced by ${nodeId}.${inputName} is not registered.`, { recoverable: true });
        if (isLoraAsset(asset) && reference.representation.toLowerCase() === "lora")
            return;
        output.push({ ...reference, node_id: nodeId, input_name: inputName, kind: mediaKind(reference.representation, asset) });
        return;
    }
    if (Array.isArray(value)) {
        for (const item of value)
            collectReferences(item, nodeId, inputName, assets, output);
        return;
    }
    if (isObject(value)) {
        for (const item of Object.values(value))
            collectReferences(item, nodeId, inputName, assets, output);
    }
}
function collectWorkflowReferences(workflow, assets) {
    if (!isObject(workflow))
        mediaError("Workflow media validation requires an API-format object graph.");
    const references = [];
    for (const [nodeId, rawNode] of Object.entries(workflow)) {
        if (!isObject(rawNode) || !isObject(rawNode.inputs))
            continue;
        for (const [inputName, value] of Object.entries(rawNode.inputs))
            collectReferences(value, nodeId, inputName, assets, references);
    }
    return references;
}
function uint32Be(bytes, offset) {
    return ((bytes[offset] ?? 0) * 0x1000000) + ((bytes[offset + 1] ?? 0) << 16) + ((bytes[offset + 2] ?? 0) << 8) + (bytes[offset + 3] ?? 0);
}
function uint16(bytes, offset, littleEndian) {
    return littleEndian ? (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8) : ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
}
function uint32(bytes, offset, littleEndian) {
    return littleEndian
        ? (bytes[offset] ?? 0) + ((bytes[offset + 1] ?? 0) << 8) + ((bytes[offset + 2] ?? 0) << 16) + ((bytes[offset + 3] ?? 0) * 0x1000000)
        : uint32Be(bytes, offset);
}
function ascii(bytes, offset, length) {
    return String.fromCharCode(...bytes.slice(offset, offset + length));
}
function pngHeader(bytes) {
    const signature = [137, 80, 78, 71, 13, 10, 26, 10];
    if (bytes.length < signature.length || !signature.every((value, index) => bytes[index] === value))
        return undefined;
    let offset = signature.length;
    let header;
    let hasTransparencyChunk = false;
    while (offset + 12 <= bytes.length) {
        const length = uint32Be(bytes, offset);
        const type = ascii(bytes, offset + 4, 4);
        const end = offset + 12 + length;
        if (end > bytes.length)
            return undefined;
        if (type === "IHDR") {
            if (header || length !== 13)
                return undefined;
            const width = uint32Be(bytes, offset + 8);
            const height = uint32Be(bytes, offset + 12);
            const colorType = bytes[offset + 17] ?? -1;
            if (!width || !height || ![0, 2, 3, 4, 6].includes(colorType))
                return undefined;
            header = { width, height, color_type: colorType, has_alpha: colorType === 4 || colorType === 6 };
        }
        else if (type === "tRNS") {
            hasTransparencyChunk = true;
        }
        else if (type === "IEND") {
            return header ? { ...header, has_alpha: header.has_alpha || hasTransparencyChunk } : undefined;
        }
        offset = end;
    }
    return undefined;
}
function jpegInfo(bytes) {
    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8)
        return undefined;
    let offset = 2;
    let exifOrientation;
    while (offset + 4 <= bytes.length) {
        if (bytes[offset] !== 0xff)
            return undefined;
        while (bytes[offset] === 0xff)
            offset += 1;
        const marker = bytes[offset++] ?? 0;
        if (marker === 0xd9 || marker === 0xda)
            break;
        if (marker >= 0xd0 && marker <= 0xd7)
            continue;
        const length = uint16(bytes, offset, false);
        if (length < 2 || offset + length > bytes.length)
            return undefined;
        const dataStart = offset + 2;
        const dataEnd = offset + length;
        if (marker === 0xe1 && dataEnd - dataStart >= 6 && ascii(bytes, dataStart, 6) === "Exif\0\0") {
            const tiff = dataStart + 6;
            const littleEndian = ascii(bytes, tiff, 2) === "II";
            if ((littleEndian || ascii(bytes, tiff, 2) === "MM") && uint16(bytes, tiff + 2, littleEndian) === 42) {
                const directory = tiff + uint32(bytes, tiff + 4, littleEndian);
                if (directory + 2 <= dataEnd) {
                    const count = uint16(bytes, directory, littleEndian);
                    for (let index = 0; index < count; index += 1) {
                        const entry = directory + 2 + index * 12;
                        if (entry + 12 > dataEnd)
                            break;
                        if (uint16(bytes, entry, littleEndian) === 0x0112) {
                            exifOrientation = uint16(bytes, entry + 8, littleEndian);
                            break;
                        }
                    }
                }
            }
        }
        if (marker >= 0xc0 && marker <= 0xc3 || marker >= 0xc5 && marker <= 0xc7 || marker >= 0xc9 && marker <= 0xcb || marker >= 0xcd && marker <= 0xcf) {
            if (length < 7)
                return undefined;
            return { has_alpha: false, exif_orientation: exifOrientation };
        }
        offset = dataEnd;
    }
    return { has_alpha: false, ...(exifOrientation === undefined ? {} : { exif_orientation: exifOrientation }) };
}
function inspectMedia(bytes) {
    const png = pngHeader(bytes);
    if (png)
        return { kind: "image", mime: "image/png", has_alpha: png.has_alpha, png_color_type: png.color_type };
    const jpeg = jpegInfo(bytes);
    if (jpeg)
        return { kind: "image", mime: "image/jpeg", ...jpeg };
    if (bytes.length >= 16 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
        return { kind: "image", mime: "image/webp", has_alpha: Boolean((bytes[20] ?? 0) & 0x10) };
    }
    if (bytes.length >= 16 && ascii(bytes, 4, 4) === "ftyp") {
        return { kind: "video", mime: ascii(bytes, 8, 4) === "qt  " ? "video/quicktime" : "video/mp4", has_alpha: false };
    }
    return undefined;
}
function mimeCompatible(declared, detected) {
    return declared === detected || (declared.startsWith("video/") && detected.startsWith("video/"));
}
function validateRoleSemantics(reference, asset) {
    const assetRoles = roles(asset);
    if (reference.kind === "mask" && !assetRoles.has("mask")) {
        mediaError(`Mask input ${reference.node_id}.${reference.input_name} requires asset ${asset.id} to have the mask role.`, { asset_id: asset.id, node_id: reference.node_id });
    }
    if (assetRoles.has("mask") && reference.kind !== "mask") {
        mediaError(`Mask asset ${asset.id} must use a mask representation, not ${reference.representation}.`, { asset_id: asset.id, node_id: reference.node_id });
    }
    if (reference.kind === "video" && !asset.mime.toLowerCase().startsWith("video/")) {
        mediaError(`Video input ${reference.node_id}.${reference.input_name} requires a video asset, received ${asset.mime}.`, { asset_id: asset.id, node_id: reference.node_id });
    }
}
function validateBytes(reference, asset, bytes) {
    const info = inspectMedia(bytes);
    if (!info)
        mediaError(`Asset ${asset.id} is not a supported image or video container.`, { asset_id: asset.id });
    if (!mimeCompatible(asset.mime.toLowerCase(), info.mime)) {
        mediaError(`Asset ${asset.id} declares ${asset.mime}, but its bytes are ${info.mime}.`, { asset_id: asset.id });
    }
    if (reference.kind === "mask") {
        if (info.mime !== "image/png" || ![0, 4].includes(info.png_color_type ?? -1)) {
            mediaError(`Mask asset ${asset.id} must be a grayscale PNG with optional alpha.`, { asset_id: asset.id });
        }
    }
    else if (reference.kind === "video" && info.kind !== "video") {
        mediaError(`Video asset ${asset.id} does not contain a supported video container.`, { asset_id: asset.id });
    }
    else if (reference.kind === "reference" && info.kind !== "image") {
        mediaError(`Reference asset ${asset.id} must be an image, not ${info.mime}.`, { asset_id: asset.id });
    }
    if (info.exif_orientation !== undefined && info.exif_orientation !== 1) {
        mediaError(`Image asset ${asset.id} has unsupported EXIF orientation ${info.exif_orientation}; normalize pixels before binding.`, { asset_id: asset.id });
    }
}
export function validateMediaBindings(input) {
    const references = collectWorkflowReferences(input.workflow, input.assets);
    const bindings = new Set(input.asset_bindings.map((binding) => binding.asset_id));
    for (const reference of references) {
        const asset = input.assets.get(reference.asset_id);
        if (!asset)
            continue;
        if (!bindings.has(reference.asset_id)) {
            throw new AppError("ASSET_MISSING", `Media asset ${reference.asset_id} is referenced by the workflow but is not bound to the execution plan.`, { recoverable: true });
        }
        validateRoleSemantics(reference, asset);
        if (input.strict_bytes) {
            const binding = input.asset_bindings.find((candidate) => candidate.asset_id === reference.asset_id);
            if (!binding || !input.read_asset)
                throw new AppError("ASSET_MISSING", `Media asset ${reference.asset_id} has no readable execution binding.`, { recoverable: true });
            validateBytes(reference, asset, input.read_asset(reference.asset_id, binding.content_hash));
        }
    }
    const imageReferences = references.filter((reference) => reference.kind === "reference");
    const masks = references.filter((reference) => reference.kind === "mask");
    const videos = references.filter((reference) => reference.kind === "video");
    if (imageReferences.length > WORKFLOW_MEDIA_PROFILE.max_reference_images) {
        mediaError(`Media profile ${WORKFLOW_MEDIA_PROFILE.id} allows at most ${WORKFLOW_MEDIA_PROFILE.max_reference_images} image references; received ${imageReferences.length}.`);
    }
    if (masks.length > WORKFLOW_MEDIA_PROFILE.max_masks) {
        mediaError(`Media profile ${WORKFLOW_MEDIA_PROFILE.id} allows at most ${WORKFLOW_MEDIA_PROFILE.max_masks} mask; received ${masks.length}.`);
    }
    if (videos.length > WORKFLOW_MEDIA_PROFILE.max_videos) {
        mediaError(`Media profile ${WORKFLOW_MEDIA_PROFILE.id} allows at most ${WORKFLOW_MEDIA_PROFILE.max_videos} video input; received ${videos.length}.`);
    }
    if (references.length > WORKFLOW_MEDIA_PROFILE.max_total_inputs) {
        mediaError(`Media profile ${WORKFLOW_MEDIA_PROFILE.id} allows at most ${WORKFLOW_MEDIA_PROFILE.max_total_inputs} media inputs; received ${references.length}.`);
    }
    return { profile_id: WORKFLOW_MEDIA_PROFILE.id, references: imageReferences.length, masks: masks.length, videos: videos.length };
}
//# sourceMappingURL=media.js.map