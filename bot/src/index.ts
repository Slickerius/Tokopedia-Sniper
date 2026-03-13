import { Scraper } from "./scraper";
import { Bot } from "./bot";

for (const key of ["BOT_TOKEN", "CHANNEL_ID", "OWNER_ID"]) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const scraper = new Scraper();
const bot = new Bot(scraper);

bot.start();
