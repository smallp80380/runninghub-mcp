import type { RevisionPersistence, WorkflowRevision } from "../graph/revisions.js";
import { Storage } from "./database.js";
export declare class SqliteRevisionPersistence implements RevisionPersistence {
    private readonly storage;
    constructor(storage: Storage);
    load(): readonly WorkflowRevision[];
    save(revision: WorkflowRevision, graphText: string): void;
    private fromRow;
}
