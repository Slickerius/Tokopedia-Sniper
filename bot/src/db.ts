import { createPool } from "mariadb";
import type { Card } from "./types";
import type { DynamicConfig, SettableKey } from "./config";

const pool = createPool({
  host: process.env.DB_HOST ?? "db",
  user: process.env.DB_USER ?? "tokpedsniper",
  password: process.env.DB_PASSWORD ?? "tokpedsniper",
  database: process.env.DB_NAME ?? "tokpedsniper",
  connectionLimit: 5,
});

export const initDb = async (): Promise<void> => {
  const conn = await pool.getConnection();
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS items (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(256) NOT NULL,
        price VARCHAR(64) NOT NULL,
        url VARCHAR(1024) NOT NULL
      )
    `);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS config (
        \`key\` VARCHAR(64) PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);
    // Seed CSS selector defaults on first run only (INSERT IGNORE respects existing values)
    const defaults: [SettableKey, string][] = [
      ["CARD_ELEMENT", process.env.CARD_ELEMENT_DEFAULT ?? ""],
      ["CARD_NAME",    process.env.CARD_NAME_DEFAULT    ?? ""],
      ["CARD_IMG",     process.env.CARD_IMG_DEFAULT     ?? ""],
      ["CARD_PRICE",   process.env.CARD_PRICE_DEFAULT   ?? ""],
    ];
    for (const [key, value] of defaults) {
      await conn.query(
        "INSERT IGNORE INTO config (`key`, value) VALUES (?, ?)",
        [key, value]
      );
    }
    console.log("Database initialized.");
  } finally {
    conn.end();
  }
};

export const getDynamicConfig = async (): Promise<DynamicConfig> => {
  const conn = await pool.getConnection();
  try {
    const rows: { key: string; value: string }[] = await conn.query(
      "SELECT `key`, value FROM config WHERE `key` IN (?, ?, ?, ?)",
      ["CARD_ELEMENT", "CARD_NAME", "CARD_IMG", "CARD_PRICE"]
    );
    return Object.fromEntries(rows.map((r) => [r.key, r.value])) as unknown as DynamicConfig;
  } finally {
    conn.end();
  }
};

export const setConfigValue = async (key: SettableKey, value: string): Promise<void> => {
  const conn = await pool.getConnection();
  try {
    await conn.query(
      "INSERT INTO config (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?",
      [key, value, value]
    );
  } finally {
    conn.end();
  }
};

export const checkItem = async (card: Card): Promise<boolean> => {
  const conn = await pool.getConnection();
  try {
    const res = await conn.query(
      "SELECT * FROM items WHERE name = ? AND price = ? AND url = ?",
      [card[0], card[2], card[1]]
    );
    return res.length > 0;
  } finally {
    conn.end();
  }
};

export const saveItem = async (card: Card): Promise<void> => {
  const conn = await pool.getConnection();
  try {
    await conn.query(
      "INSERT INTO items (name, price, url) VALUES (?, ?, ?)",
      [card[0], card[2], card[1]]
    );
  } finally {
    conn.end();
  }
};
