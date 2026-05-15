# Tokopedia Sniper Bot

A project initiated by Slickerius, intended to assist in hunting for rare items on the Indonesian e-commerce marketplace Tokopedia, inspired by his endeavours in hunting for antique 70s cassette tapes.

Sometimes certain items are just so rare that they're listed for only a very brief amount of time. This bot periodically queries Tokopedia's newest listings for a set of configured search queries and posts new findings to a Discord channel of your choosing.

![](https://cdn.discordapp.com/attachments/815844122673938453/1036559382428798986/unknown.png)

---

## Project Structure

```
Tokopedia-Sniper/
├── bot/
│   ├── src/
│   │   ├── index.ts              # Entry point, env validation
│   │   ├── types.ts              # Shared types (Card)
│   │   ├── config.ts             # StaticConfig (env vars)
│   │   ├── db.ts                 # MariaDB - items table, query queue
│   │   ├── utils.ts              # Image URL normalisation
│   │   ├── scraper.ts            # Tokopedia fetcher
│   │   ├── bot.ts                # Discord client, cron scheduler
│   │   └── commands/
│   │       ├── index.ts          # Command interface + CommandHandler registry
│   │       └── refresh.ts        # !refresh - trigger immediate scrape
│   ├── .env                      # Local credentials (not committed - copy from sample.env)
│   ├── sample.env                # Template for all required env vars
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
├── docker-compose.yml            # Local dev - MariaDB + single bot instance
└── README.md
```

Kubernetes manifests have moved to [sl0ck-k8s](https://github.com/Slickerius/sl0ck-k8s).

---

## How configuration works

| Field | Where | How to change |
|---|---|---|
| `SEARCH` | Env var / K8s ConfigMap | Edit ConfigMap in [sl0ck-k8s](https://github.com/Slickerius/sl0ck-k8s) + redeploy |
| `BLACKLIST` | Env var / K8s ConfigMap | Same as above |

---

## Discord Commands

All commands are restricted to the `OWNER_ID`.

| Command | Description |
|---|---|
| `!refresh` | Immediately trigger a full scrape cycle |

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
| Database | MariaDB 10.11 |
| Scheduling | node-cron |
| Orchestration | k3s (lightweight Kubernetes) |
| Encryption | WireGuard (Flannel `wireguard-native` backend) |
| Container registry | GitHub Container Registry (ghcr.io) |
