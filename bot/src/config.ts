export interface StaticConfig {
  BLACKLIST: string[];
  SEARCH: string[];
}

export const loadStaticConfig = (): StaticConfig => ({
  BLACKLIST: JSON.parse(process.env.BLACKLIST ?? "[]"),
  SEARCH: JSON.parse(process.env.SEARCH ?? "[]"),
});
