import { Scraper } from "./scraper";
import { Bot } from "./bot";

for (const key of ["BOT_TOKEN", "CHANNEL_ID", "OWNER_ID"]) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

// In K8s: POD_NAME is injected by the downward API (e.g. "bot-0", "bot-1")
// Locally: defaults to "bot-0" → shardIndex 0
const podName = process.env.POD_NAME ?? "bot-0";
const shardIndex = parseInt(podName.split("-").pop() ?? "0", 10);
const shardCount = parseInt(process.env.BOT_SHARD_COUNT ?? "1", 10);

console.log(`Starting pod "${podName}" — shard ${shardIndex + 1} of ${shardCount}`);

const scraper = new Scraper();
const bot = new Bot(scraper, shardIndex, shardCount);

bot.start();
