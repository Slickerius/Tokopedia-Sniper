export interface StaticConfig {
  URL: string;
  BLACKLIST: string[];
  SEARCH: string[];
}

export interface DynamicConfig {
  CARD_ELEMENT: string;
  CARD_NAME: string;
  CARD_IMG: string;
  CARD_PRICE: string;
}

export type Config = StaticConfig & DynamicConfig;

export const SETTABLE_KEYS = [
  "CARD_ELEMENT",
  "CARD_NAME",
  "CARD_IMG",
  "CARD_PRICE",
] as const;

export type SettableKey = (typeof SETTABLE_KEYS)[number];

export const loadStaticConfig = (): StaticConfig => ({
  URL: process.env.SEARCH_URL!,
  BLACKLIST: JSON.parse(process.env.BLACKLIST ?? "[]"),
  SEARCH: JSON.parse(process.env.SEARCH ?? "[]"),
});
