import { Scraper } from "./scraper";
import { Bot } from "./bot";

for (const key of ["BOT_TOKEN", "CHANNEL_ID", "OWNER_ID"]) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

console.log(`Starting pod "${process.env.POD_NAME ?? "local"}@${process.env.NODE_NAME ?? "localhost"}"`);

const scraper = new Scraper();
const bot = new Bot(scraper);

bot.start();
