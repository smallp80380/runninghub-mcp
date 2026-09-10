declare const GUIDES: {
    auth: {
        steps: string[];
        must: string[];
        must_not: string[];
    };
    upload: {
        steps: string[];
        must: string[];
        must_not: string[];
    };
    submit: {
        steps: string[];
        must: string[];
        must_not: string[];
    };
    poll: {
        steps: string[];
        must: string[];
        must_not: string[];
    };
    result_parsing: {
        steps: string[];
        must: string[];
        must_not: string[];
    };
    retry: {
        steps: string[];
        must: string[];
        must_not: string[];
    };
    errors: {
        steps: string[];
        must: string[];
        must_not: string[];
    };
    pricing: {
        steps: string[];
        must: string[];
        must_not: string[];
    };
};
export type GuideTopic = keyof typeof GUIDES | "all";
export declare function getIntegrationGuide(topic?: GuideTopic): {
    topic: "all";
    guides: {
        auth: {
            steps: string[];
            must: string[];
            must_not: string[];
        };
        upload: {
            steps: string[];
            must: string[];
            must_not: string[];
        };
        submit: {
            steps: string[];
            must: string[];
            must_not: string[];
        };
        poll: {
            steps: string[];
            must: string[];
            must_not: string[];
        };
        result_parsing: {
            steps: string[];
            must: string[];
            must_not: string[];
        };
        retry: {
            steps: string[];
            must: string[];
            must_not: string[];
        };
        errors: {
            steps: string[];
            must: string[];
            must_not: string[];
        };
        pricing: {
            steps: string[];
            must: string[];
            must_not: string[];
        };
    };
    lifecycle: string[];
} | {
    steps: string[];
    must: string[];
    must_not: string[];
    topic: "submit" | "retry" | "upload" | "auth" | "poll" | "result_parsing" | "errors" | "pricing";
    guides?: undefined;
    lifecycle?: undefined;
};
export {};
