import { createPool } from "mariadb";
import type { Card } from "./types";

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
    const res = await conn.query(`
      CREATE TABLE IF NOT EXISTS items (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(256) NOT NULL,
        price VARCHAR(64) NOT NULL,
        url VARCHAR(1024) NOT NULL
      )
    `);
    console.log(`Initializing database... ${res}`);
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
