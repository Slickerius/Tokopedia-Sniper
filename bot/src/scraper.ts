import puppeteer, { type Browser, type Page } from "puppeteer-core";
import type { TextChannel } from "discord.js";
import { loadStaticConfig, type Config } from "./config";
import { getDynamicConfig, checkItem, saveItem, initQueue, claimQuery, completeQuery, reclaimStaleQueries } from "./db";
import { sleep, convertToPermanentUrl } from "./utils";
import type { Card } from "./types";

const STD_INTERVAL = 2000;
const POD_ORIGIN = `${process.env.POD_NAME ?? "local"}@${process.env.NODE_NAME ?? "localhost"}`;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36";

export class Scraper {
  private browser: Browser | null = null;
  private isRunning = false;

  async init(): Promise<void> {
    this.browser = await puppeteer.launch({
      headless: true,
      timeout: 120000,
      executablePath: process.env.CHROME_BIN ?? undefined,
      args: [
        "--no-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--user-data-dir=/tmp/user_data/",
        "--start-maximized",
      ],
    });
    console.log(`Using User-Agent ${await this.browser.userAgent()}`);
  }

  async runQueue(queries: string[], postChannel: TextChannel): Promise<void> {
    if (this.isRunning) {
      console.log("Scrape already in progress, skipping.");
      return;
    }
    this.isRunning = true;
    const cycle = Math.floor(Date.now() / 3600000);
    try {
      await initQueue(queries, cycle);
      await reclaimStaleQueries(cycle);
      console.log(`Cycle ${cycle}: queue initialized with ${queries.length} queries.`);
      while (true) {
        const query = await claimQuery(POD_ORIGIN, cycle);
        if (!query) break;
        await this.scrape(query, postChannel);
        await completeQuery(query, cycle);
      }
      console.log(`Cycle ${cycle}: queue exhausted.`);
    } finally {
      this.isRunning = false;
    }
  }

  private async scrape(query: string, postChannel: TextChannel): Promise<void> {
    console.log("Refreshing configurations...");
    const staticConf = loadStaticConfig();
    const dynamicConf = await getDynamicConfig();
    const config: Config = { ...staticConf, ...dynamicConf };

    console.log(`Scraping for query "${query}"...`);

    const context = await this.browser!.createBrowserContext();
    const page = await context.newPage();

    await page.setUserAgent(USER_AGENT);
    await page.setViewport({ width: 1366, height: 768 });
    await page.setDefaultNavigationTimeout(0);

    await page.goto(config.URL + query, { waitUntil: "load" });
    await sleep(STD_INTERVAL);

    for (let it = 5; it > 0; it--) {
      await page.evaluate(
        `window.scrollTo(document.body.scrollWidth, document.body.scrollHeight / ${it})`
      );
      await sleep(STD_INTERVAL);
    }

    await sleep(STD_INTERVAL);

    const cardList = await this.extractCards(page, config);

    console.log(`Found a total of ${cardList.length} items.`);

    for (const card of cardList) {
      const exists = await checkItem(card);
      if (!exists && !this.isFiltered(card, query, config.BLACKLIST)) {
        card[3] = convertToPermanentUrl(card[3]);
        postChannel.send(
          `**New Item!**\n**Query**: "${query}"\n**Name**: ${card[0]}\n**Price**: **${card[2]}**\n**URL**: ${card[1]}\n**Pod**: \`${POD_ORIGIN}\`\n\n**Image**: ${card[3]}`
        );
        try {
          await saveItem(card);
        } catch (e) {
          console.error(`ERROR saving item: ${e}`);
        }
      }
    }

    await page.close();
    await context.close();
  }

  private async extractCards(page: Page, config: Config): Promise<Card[]> {
    const cardEls = await page.$$(config.CARD_ELEMENT);
    const cardList: Card[] = [];

    for (const cardEl of cardEls) {
      const cardIsAd = await cardEl.$(".GnvFY01xBCRPQXkPKtn0wg\\=\\=");
      if (cardIsAd !== null) continue;

      const cardNameEl = await cardEl.$(config.CARD_NAME);
      const name: string = await page.evaluate(
        (el) => (el as HTMLElement).innerHTML,
        cardNameEl
      );

      const url: string = await page.evaluate(
        (el) => (el as HTMLAnchorElement).href,
        cardEl
      );

      const cardImgEl = await cardEl.$(config.CARD_IMG);
      const img: string = await page.evaluate(
        (el) => (el as HTMLImageElement).src,
        cardImgEl
      );

      const cardPriceEl = await cardEl.$(config.CARD_PRICE);
      const price: string = await page.evaluate(
        (el) => (el as HTMLElement).innerHTML,
        cardPriceEl
      );

      cardList.push([name, url.split("?")[0], price, img]);
    }

    const isPromotedStoreExists = (await page.$$(`.css-1rzg7ys`)).length > 0;
    const withoutPromoted = isPromotedStoreExists ? cardList.slice(3) : cardList;

    const recommendationLabels = (await page.$$(`.css-1lekzkb`)).length;
    return recommendationLabels > 0
      ? withoutPromoted.slice(0, -1 * 5 * recommendationLabels)
      : withoutPromoted;
  }

  private isFiltered(card: Card, query: string, blacklist: string[]): boolean {
    for (const token of blacklist) {
      if (card[0].toLowerCase().includes(token)) {
        console.log(`Filtered (blacklist): ${card[0]}`);
        return true;
      }
    }

    if (card[1].length > 512 || card[0].length > 256) {
      console.log(`Filtered (too long): ${card[0]}`);
      return true;
    }

    if (!query.split(" ").every((token) => card[0].toLowerCase().includes(token))) {
      console.log(`Filtered (unrelated): ${card[0]}`);
      return true;
    }

    return false;
  }
}
