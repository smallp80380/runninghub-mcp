import type { PricingEntry, PricingRule } from "./types.js";
export declare function summarizePricing(entry: PricingEntry | undefined): string;
export declare function estimatePrice(entry: PricingEntry | undefined, payload?: Record<string, unknown>): {
    estimable: boolean;
    reason: string;
    pricing_type?: undefined;
    currency?: undefined;
    unit?: undefined;
    price?: undefined;
    note?: undefined;
    matched_rule?: undefined;
    depends_on?: undefined;
    price_range?: undefined;
    rules?: undefined;
} | {
    estimable: boolean;
    pricing_type: string;
    currency: string;
    unit: string;
    price: number;
    note: string;
    reason?: undefined;
    matched_rule?: undefined;
    depends_on?: undefined;
    price_range?: undefined;
    rules?: undefined;
} | {
    estimable: boolean;
    pricing_type: string;
    currency: string;
    unit: string;
    price: number;
    matched_rule: Record<string, string>;
    note: string;
    reason?: undefined;
    depends_on?: undefined;
    price_range?: undefined;
    rules?: undefined;
} | {
    estimable: boolean;
    pricing_type: string;
    currency: string;
    unit: string;
    depends_on: string[];
    price_range: {
        min: number | undefined;
        max: number | undefined;
    } | undefined;
    reason: string;
    rules: PricingRule[];
    price?: undefined;
    note?: undefined;
    matched_rule?: undefined;
} | {
    estimable: boolean;
    pricing_type: string;
    reason: string;
    currency?: undefined;
    unit?: undefined;
    price?: undefined;
    note?: undefined;
    matched_rule?: undefined;
    depends_on?: undefined;
    price_range?: undefined;
    rules?: undefined;
};
