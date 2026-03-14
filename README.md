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
│   │   ├── index.ts              # Entry point — env validation, shard init
│   │   ├── types.ts              # Shared types (Card)
│   │   ├── config.ts             # StaticConfig (env vars) + DynamicConfig (DB)
│   │   ├── db.ts                 # MariaDB — items table, config table, queries
│   │   ├── utils.ts              # sleep(), image URL normalisation
│   │   ├── scraper.ts            # Puppeteer scraping engine
│   │   ├── bot.ts                # Discord client, cron scheduler, sharding
│   │   └── commands/
│   │       ├── index.ts          # Command interface + CommandHandler registry
│   │       ├── refresh.ts        # !refresh — trigger immediate scrape
│   │       └── set.ts            # !set — update CSS selectors live (writes to DB)
│   ├── .env                      # Local credentials (not committed — copy from sample.env)
│   ├── sample.env                # Template for all required env vars
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
├── k8s/
│   ├── namespace.yaml
│   ├── mariadb/
│   │   ├── secret.yaml           # DB credentials
│   │   ├── configmap.yaml        # MariaDB server config (charset, timeouts)
│   │   ├── statefulset.yaml      # MariaDB pod + PVC
│   │   ├── service.yaml          # ClusterIP (internal only)
│   │   └── networkpolicy.yaml    # Only bot pods may reach port 3306
│   └── bot/
│       ├── secret.yaml           # Discord credentials
│       ├── configmap.yaml        # SEARCH, BLACKLIST, URL, CSS selector defaults
│       ├── deployment.yaml       # Bot pods — centralized MariaDB work queue
│       └── networkpolicy.yaml    # Egress: DNS + MariaDB + internet (443)
├── docker-compose.yml            # Local dev — MariaDB + single bot instance
└── README.md
```

---

## How configuration works

Config is split by how it changes:

| Field | Where | How to change |
|---|---|---|
| `SEARCH`, `BLACKLIST`, `URL` | Env var / K8s ConfigMap | Edit ConfigMap + redeploy |
| `CARD_ELEMENT`, `CARD_NAME`, `CARD_IMG`, `CARD_PRICE` | MariaDB `config` table | `!set` in Discord (no restart needed) |

CSS selector defaults are seeded into the DB on first run from `CARD_*_DEFAULT` env vars (`INSERT IGNORE` — won't overwrite values already in the DB).

> Tokopedia's CSS class names are obfuscated and rotate whenever they redeploy. Use `!set` in Discord to update them live without touching the cluster.

---

## Discord Commands

All commands are restricted to the `OWNER_ID`.

| Command | Description |
|---|---|
| `!refresh` | Immediately trigger a full scrape for this shard's queries |
| `!set CARD_ELEMENT <selector>` | Update product card selector (persists to DB, all pods see it) |
| `!set CARD_NAME <selector>` | Update product name selector |
| `!set CARD_IMG <selector>` | Update product image selector |
| `!set CARD_PRICE <selector>` | Update product price selector |

---

## Local development

Copy the env template and fill in your values:

```bash
cp bot/sample.env bot/.env
```

Start MariaDB + bot locally:

```bash
# Full stack
docker-compose up --build

# Or: DB in Docker, bot with live reload
docker-compose up db
cd bot && bun run dev
```

---

## Tech Stack

| Category | Technology |
|---|---|
| Runtime | [Bun](https://bun.sh) |
| Language | TypeScript |
| Discord | discord.js v14 |
| Scraping | Puppeteer Core + Chromium |
| Database | MariaDB 10.11 |
| Scheduling | node-cron |
| Orchestration | k3s (lightweight Kubernetes) |
| Encryption | WireGuard (Flannel `wireguard-native` backend) |
| Container registry | GitHub Container Registry (ghcr.io) |
