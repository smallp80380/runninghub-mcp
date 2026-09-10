export class MapNodeCatalog {
    schemas;
    constructor(schemas = []) {
        this.schemas = new Map(schemas.map((schema) => [`${schema.class_type}@${schema.schema_revision}`, schema]));
    }
    get(classType, schemaRevision) {
        if (schemaRevision) {
            return this.schemas.get(`${classType}@${schemaRevision}`);
        }
        const match = [...this.schemas.entries()].find(([key]) => key.startsWith(`${classType}@`));
        return match?.[1];
    }
}
export function createEmptyGraph(metadata = {}) {
    return {
        schema_version: "1",
        nodes: {},
        output_nodes: [],
        metadata,
    };
}
//# sourceMappingURL=types.js.map