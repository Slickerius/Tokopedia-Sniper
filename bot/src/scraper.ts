import type { TextChannel } from "discord.js";
import { loadStaticConfig } from "./config";
import {
  checkItem,
  saveItem,
  initQueue,
  claimQuery,
  completeQuery,
  reclaimStaleQueries,
  hasShopeeRunToday,
  markShopeeRan,
} from "./db";
import { convertToPermanentUrl } from "./utils";
import { fetchShopeeProducts } from "./biggo";
import type { Card, NormalizedProduct } from "./types";

const POD_ORIGIN = `${process.env.POD_NAME ?? "local"}@${process.env.NODE_NAME ?? "localhost"}`;
const GQL_PROXY = process.env.GQL_PROXY || undefined;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36";

const GQL_ENDPOINT = "https://gql.tokopedia.com/graphql/SearchProductV5Query";

const SEARCH_QUERY = `query SearchProductV5Query($params: String!) {
  searchProductV5(params: $params) {
    header { totalData responseCode }
    data {
      products {
        name
        url
        price { text }
        mediaURL { image }
        ads { id }
      }
    }
  }
}`;

interface GqlProduct {
  name: string;
  url: string;
  price: { text: string };
  mediaURL: { image: string };
  ads: { id: string | null };
}

export class Scraper {
  private running = false;

  async runQueue(queries: string[], postChannel: TextChannel): Promise<void> {
    if (this.running) {
      console.log("Scrape already in progress, skipping.");
      return;
    }
    this.running = true;
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
      this.running = false;
    }
  }

  private async scrape(query: string, postChannel: TextChannel): Promise<void> {
    const config = loadStaticConfig();
    console.log(`Scraping for query "${query}"...`);

    const tokopediaProducts = await this.fetchTokopediaProducts(query);
    console.log(`Tokopedia: found ${tokopediaProducts.length} items for "${query}".`);
    for (const product of tokopediaProducts) {
      await this.processProduct(product, "Tokopedia", query, postChannel, config.BLACKLIST);
    }

    // Shopee (via BigGo) is paginated and heavier on the upstream site, so it
    // only runs once a day per query instead of every hourly cycle.
    const day = Math.floor(Date.now() / 86400000);
    if (await hasShopeeRunToday(query, day)) {
      console.log(`Shopee: already ran today for "${query}", skipping.`);
      return;
    }

    const shopeeProducts = await fetchShopeeProducts(query);
    console.log(`Shopee: found ${shopeeProducts.length} items for "${query}".`);
    for (const product of shopeeProducts) {
      await this.processProduct(product, "Shopee", query, postChannel, config.BLACKLIST);
    }
    await markShopeeRan(query, day);
  }

  private async processProduct(
    product: NormalizedProduct,
    source: string,
    query: string,
    postChannel: TextChannel,
    blacklist: string[]
  ): Promise<void> {
    const card: Card = [product.name, product.url, product.price, product.image];

    const exists = await checkItem(card);
    if (exists || this.isFiltered(card, query, blacklist)) return;

    postChannel.send(
      `**New Item!**\n**Source**: ${source}\n**Query**: "${query}"\n**Name**: ${card[0]}\n**Price**: **${card[2]}**\n**URL**: ${card[1]}\n**Pod**: \`${POD_ORIGIN}\`\n\n**Image**: ${card[3]}`
    );
    try {
      await saveItem(card);
    } catch (e) {
      console.error(`ERROR saving item: ${e}`);
    }
  }

  private async fetchTokopediaProducts(query: string): Promise<NormalizedProduct[]> {
    const params = `device=desktop&ob=9&page=1&q=${encodeURIComponent(query)}&rows=200&safe_search=false&source=search&st=product&start=0`;

    try {
      const res = await fetch(GQL_ENDPOINT, {
        method: "POST",
        signal: AbortSignal.timeout(30000),
        proxy: GQL_PROXY,
        headers: {
          "Content-Type": "application/json",
          "User-Agent": USER_AGENT,
          "Origin": "https://www.tokopedia.com",
          "Referer": "https://www.tokopedia.com/",
          "X-Source": "tokopedia-lite",
          "X-Device": "desktop-0.0",
          "X-Tkpd-Lite-Service": "zeus",
        },
        body: JSON.stringify([
          {
            operationName: "SearchProductV5Query",
            variables: { params },
            query: SEARCH_QUERY,
          },
        ]),
      });

      if (!res.ok) {
        console.error(`GraphQL request failed: ${res.status} ${res.statusText}`);
        return [];
      }

      const json = await res.json() as [{ data: { searchProductV5: { data: { products: GqlProduct[] } } } }];
      const products = json[0]?.data?.searchProductV5?.data?.products ?? [];

      return products
        .filter((p) => !p.ads?.id)
        .map((p): NormalizedProduct => ({
          name: p.name,
          url: p.url.split("?")[0]!,
          price: p.price.text,
          image: convertToPermanentUrl(p.mediaURL.image),
        }));
    } catch (e) {
      console.error(`Fetch failed for query "${query}": ${e}`);
      return [];
    }
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
