# Tokopedia Sniper Bot

A project initiated by Slickerius, intended to assist in hunting for rare items on the Indonesian e-commerce marketplace Tokopedia, inspired by his endeavours in hunting for antique 70s cassette tapes.

Sometimes certain items are just so rare that they're listed for only a very brief amount of time. This bot periodically scrapes Tokopedia's newest listings for a set of configured search queries and posts new findings to a Discord channel of your choosing.

![](https://cdn.discordapp.com/attachments/815844122673938453/1036559382428798986/unknown.png)

---

## Project Structure

```
Tokopedia-Sniper/
├── bot/
│   ├── src/
│   │   ├── index.ts              # Entry point — env validation + startup
│   │   ├── types.ts              # Shared types (Card)
│   │   ├── config.ts             # Config loader/saver
│   │   ├── db.ts                 # MariaDB connection + queries
│   │   ├── utils.ts              # sleep(), image URL normalisation
│   │   ├── scraper.ts            # Puppeteer scraping engine
│   │   ├── bot.ts                # Discord bot (client, cron, events)
│   │   └── commands/
│   │       ├── index.ts          # Command interface + CommandHandler
│   │       ├── refresh.ts        # !refresh — trigger immediate scrape
│   │       └── set.ts            # !set — update config selectors live
│   ├── config.json               # Search queries, blacklist, CSS selectors
│   ├── .env                      # Discord credentials (not committed)
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
├── docker-compose.yml            # MariaDB + bot services
└── README.md
```

---

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) + Docker Compose

For local development without Docker:
- [Bun](https://bun.sh) v1.0+
- A running MariaDB instance

---

## Configuration

**`bot/.env`** — Discord credentials:
```env
BOT_TOKEN=your_discord_bot_token
CHANNEL_ID=channel_to_post_notifications
OWNER_ID=your_discord_user_id
```

**`bot/config.json`** — scraping configuration:
```jsonc
{
  "URL": "https://www.tokopedia.com/search?...",
  "SEARCH": ["kaset koes", "kaset rollies", ...],  // queries to monitor
  "BLACKLIST": ["cd", "vinyl", ...],               // keywords to exclude
  "CARD_ELEMENT": ".ClassName==",                  // CSS selectors for scraping
  "CARD_NAME": ".ClassName==",
  "CARD_IMG": ".ClassName==",
  "CARD_PRICE": ".ClassName=="
}
```

> **Note:** Tokopedia's CSS class names are obfuscated and change periodically. Use the `!set` command (see below) to update them without restarting the bot.

---

## Running

### With Docker (recommended)

```bash
# Build and start MariaDB + bot
docker-compose up --build

# Run in background
docker-compose up --build -d

# View bot logs
docker-compose logs -f bot

# Stop everything
docker-compose down
```

### Local development (bot only)

Requires a running MariaDB instance. You can start just the DB via Docker:

```bash
# Terminal 1 — DB only
docker-compose up db

# Terminal 2 — bot with auto-restart on file changes
cd bot
bun install
bun run dev
```

---

## Discord Commands

All commands are restricted to the `OWNER_ID` configured in `.env`.

| Command | Description |
|---------|-------------|
| `!refresh` | Immediately trigger a full scrape of all search queries |
| `!set CARD_ELEMENT <selector>` | Update the product card CSS selector |
| `!set CARD_NAME <selector>` | Update the product name CSS selector |
| `!set CARD_IMG <selector>` | Update the product image CSS selector |
| `!set CARD_PRICE <selector>` | Update the product price CSS selector |

Changes made via `!set` are persisted to `config.json` immediately.

---

## Tech Stack

| | |
|-|--|
| Runtime | [Bun](https://bun.sh) |
| Language | TypeScript |
| Discord | discord.js v14 |
| Scraping | Puppeteer Core + Chromium |
| Database | MariaDB |
| Scheduling | node-cron |
| Container | Docker + Docker Compose |
