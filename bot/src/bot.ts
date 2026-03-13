import {
  Client,
  GatewayIntentBits,
  ActivityType,
  type TextChannel,
  type Message,
} from "discord.js";
import cron from "node-cron";
import { loadStaticConfig } from "./config";
import { initDb } from "./db";
import { Scraper } from "./scraper";
import { CommandHandler } from "./commands/index";
import { RefreshCommand } from "./commands/refresh";
import { SetCommand } from "./commands/set";

const CHANNEL_ID = process.env.CHANNEL_ID!;
const BOT_TOKEN = process.env.BOT_TOKEN!;
const OWNER_ID = process.env.OWNER_ID!;

export class Bot {
  private readonly client: Client;
  private readonly commandHandler: CommandHandler;
  private postChannel: TextChannel | null = null;

  constructor(private readonly scraper: Scraper) {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    this.commandHandler = new CommandHandler().register(
      new RefreshCommand(() => this.triggerScrape()),
      new SetCommand(),
    );

    this.client.on("clientReady", () => this.onReady());
    this.client.on("messageCreate", (msg) => this.onMessage(msg));

    this.setupCron();
  }

  start(): void {
    this.client.login(BOT_TOKEN);
  }

  private async onReady(): Promise<void> {
    console.log(`Connected as user: ${this.client.user!.username}`);

    this.client.user!.setActivity("Koes Plus - Dheg Dheg Plas", {
      type: ActivityType.Streaming,
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    });

    this.postChannel =
      (await this.client.channels.fetch(CHANNEL_ID).catch(() => null)) as TextChannel | null;

    await Promise.all([initDb(), this.scraper.init()]);
    this.triggerScrape();
  }

  private async onMessage(message: Message): Promise<void> {
    if (message.author.id !== OWNER_ID) return;
    await this.commandHandler.handle(message);
  }

  private triggerScrape(): void {
    if (!this.postChannel) {
      console.error("postChannel not set — cannot start scrape.");
      return;
    }
    const { SEARCH } = loadStaticConfig();
    this.scraper.runQueue(SEARCH, this.postChannel);
  }

  private setupCron(): void {
    cron.schedule("0 * * * *", () => {
      console.log("Starting periodic scraping...");
      this.triggerScrape();
    });
  }
}
