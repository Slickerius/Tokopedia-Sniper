import type { NormalizedProduct } from "./types";
import { sleep } from "./utils";

// Shopee has no usable public search API, so Shopee listings are sourced
// from BigGo, a price-comparison site that mirrors Shopee's catalog and
// serves it through a Next.js RSC (React Server Components) response
// instead of a plain JSON API.
const BIGGO_ORIGIN = "https://biggo.id";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36";

// Independent of whatever total_page BigGo reports, so a bad or huge value
// can never turn one query into an unbounded crawl.
const MAX_PAGES = 150;
// Keeps the per-page crawl from hammering BigGo back-to-back.
const PAGE_DELAY_MS = 400;

interface BiggoItem {
  nindex: string;
  is_ad: boolean;
  is_offline: boolean;
  is_notfound: boolean;
  is_expired: boolean;
  title: string;
  purl: string;
  image: string;
  origin_image: string;
  price: number;
  symbol: string;
}

interface BiggoSsrData {
  total_page: number;
  list: BiggoItem[];
}

// BigGo's RSC payload isn't a single JSON document: it's a stream of
// "<id>:<prefix><payload>" rows, and the search results are embedded as a
// plain JSON object inline in one of those rows. Rather than parse the full
// Flight protocol, this locates the "ssrData" key directly in the raw text
// and decodes the JSON value that follows it by tracking brace depth
// (respecting quoted strings and escapes), which is robust to that value
// moving between rows across BigGo deploys.
function extractJsonAfter(text: string, marker: string): unknown | null {
  const markerIndex = text.indexOf(marker);
  if (markerIndex === -1) return null;

  let i = markerIndex + marker.length;
  while (i < text.length && /\s/.test(text[i]!)) i++;

  const open = text[i];
  if (open !== "{" && open !== "[") return null;
  const close = open === "{" ? "}" : "]";

  let depth = 0;
  let inString = false;
  let escaped = false;
  let end = -1;

  for (let j = i; j < text.length; j++) {
    const ch = text[j];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === open) {
      depth++;
    } else if (ch === close) {
      depth--;
      if (depth === 0) {
        end = j;
        break;
      }
    }
  }

  if (end === -1) return null;
  try {
    return JSON.parse(text.slice(i, end + 1));
  } catch {
    return null;
  }
}

function formatPrice(symbol: string, price: number): string {
  return `${symbol}${price.toLocaleString("id-ID")}`;
}

function isUsableShopeeItem(item: BiggoItem): boolean {
  return (
    item.nindex === "id_bid_shopeeid" &&
    !item.is_ad &&
    !item.is_offline &&
    !item.is_notfound &&
    !item.is_expired
  );
}

async function fetchPage(query: string, page: number): Promise<BiggoSsrData | null> {
  const searchPath = `/s/${encodeURIComponent(query)}`;

  try {
    const res = await fetch(`${BIGGO_ORIGIN}${searchPath}?p=${page}`, {
      signal: AbortSignal.timeout(20000),
      headers: {
        "Rsc": "1",
        "Accept": "*/*",
        "User-Agent": USER_AGENT,
        "Next-Url": searchPath,
        "Referer": `${BIGGO_ORIGIN}${searchPath}`,
      },
    });

    if (!res.ok) {
      console.error(`BigGo request failed for "${query}" page ${page}: ${res.status} ${res.statusText}`);
      return null;
    }

    const body = await res.text();
    return extractJsonAfter(body, '"ssrData":') as BiggoSsrData | null;
  } catch (e) {
    console.error(`BigGo fetch failed for "${query}" page ${page}: ${e}`);
    return null;
  }
}

export async function fetchShopeeProducts(query: string): Promise<NormalizedProduct[]> {
  const results: NormalizedProduct[] = [];

  const collect = (ssrData: BiggoSsrData) => {
    for (const item of ssrData.list) {
      if (!isUsableShopeeItem(item)) continue;
      results.push({
        name: item.title,
        url: item.purl.split("?")[0]!,
        price: formatPrice(item.symbol, item.price),
        image: item.origin_image || item.image,
      });
    }
  };

  const first = await fetchPage(query, 1);
  if (!first) return results;
  collect(first);

  const totalPages = Math.min(first.total_page || 1, MAX_PAGES);
  for (let page = 2; page <= totalPages; page++) {
    await sleep(PAGE_DELAY_MS);
    const ssrData = await fetchPage(query, page);
    if (!ssrData) break;
    collect(ssrData);
  }

  return results;
}
