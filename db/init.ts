import * as fs from "node:fs";
import * as path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(path.join(process.cwd(), "package.json"));
const Database = require("better-sqlite3") as typeof import("better-sqlite3");
const rootDir = process.cwd();
const dataDir = path.join(rootDir, "data");
const dbPath = path.join(dataDir, "eshot.db");

export function createTables(databaseFile = dbPath): string {
  fs.mkdirSync(path.dirname(databaseFile), { recursive: true });
  const db = new Database(databaseFile);

  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS backup_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      status TEXT NOT NULL,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS hatlar (
      hat_no TEXT PRIMARY KEY,
      hat_adi TEXT,
      hat_baslangic TEXT,
      hat_bitis TEXT,
      updated_at TEXT NOT NULL,
      raw_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS duraklar (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hat_no TEXT,
      durak_id INTEGER,
      durak_adi TEXT,
      enlem REAL,
      boylam REAL,
      yon INTEGER,
      updated_at TEXT NOT NULL,
      raw_json TEXT NOT NULL,
      UNIQUE (hat_no, durak_id, yon)
    );

    CREATE TABLE IF NOT EXISTS guzergah_noktalari (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hat_no TEXT,
      yon INTEGER,
      sira INTEGER,
      enlem REAL,
      boylam REAL,
      updated_at TEXT NOT NULL,
      raw_json TEXT NOT NULL,
      UNIQUE (hat_no, yon, sira)
    );

    CREATE TABLE IF NOT EXISTS hareket_saatleri (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hat_no TEXT,
      yon INTEGER,
      kalkis_saati TEXT,
      aciklama TEXT,
      updated_at TEXT NOT NULL,
      raw_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS duraktan_gecen_hatlar (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      durak_id INTEGER NOT NULL,
      hat_no TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (durak_id, hat_no)
    );

    CREATE INDEX IF NOT EXISTS idx_duraklar_hat_no ON duraklar (hat_no);
    CREATE INDEX IF NOT EXISTS idx_duraktan_gecen_hatlar_durak_id ON duraktan_gecen_hatlar (durak_id);
    CREATE INDEX IF NOT EXISTS idx_duraktan_gecen_hatlar_hat_no ON duraktan_gecen_hatlar (hat_no);
    CREATE INDEX IF NOT EXISTS idx_guzergah_hat_no ON guzergah_noktalari (hat_no);
    CREATE INDEX IF NOT EXISTS idx_saatler_hat_no ON hareket_saatleri (hat_no);
  `);

  db.close();
  return databaseFile;
}

if (process.argv[1] && (process.argv[1].endsWith("db/init.ts") || process.argv[1].endsWith("db/init.js"))) {
  const file = createTables();
  console.log(`SQLite tablolari hazir: ${file}`);
}
