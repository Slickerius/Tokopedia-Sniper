import { readFileSync, writeFileSync } from "fs";

export interface Config {
  URL: string;
  BLACKLIST: string[];
  SEARCH: string[];
  CARD_ELEMENT: string;
  CARD_NAME: string;
  CARD_IMG: string;
  CARD_PRICE: string;
}

export const SETTABLE_KEYS = [
  "CARD_ELEMENT",
  "CARD_NAME",
  "CARD_IMG",
  "CARD_PRICE",
] as const;

export type SettableKey = (typeof SETTABLE_KEYS)[number];

const CONFIG_PATH = "./config.json";

export const loadConfig = (): Config =>
  JSON.parse(readFileSync(CONFIG_PATH, "utf-8")) as Config;

export const saveConfig = (config: Config): void =>
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 4));
