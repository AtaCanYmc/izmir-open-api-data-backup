import * as fs from "node:fs";
import * as path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(path.join(process.cwd(), "package.json"));
const Database = require("better-sqlite3") as typeof import("better-sqlite3");

const rootDir = process.cwd();
const dbPath = path.join(rootDir, "data", "eshot.db");
const outputDir = path.join(rootDir, "public", "data");

// --------------- types ---------------

interface HatRow {
  hat_no: string;
  hat_adi: string | null;
  hat_baslangic: string | null;
  hat_bitis: string | null;
}

interface DurakRow {
  durak_id: number;
  durak_adi: string | null;
  enlem: number | null;
  boylam: number | null;
}

interface GuzergahRow {
  yon: number | null;
  sira: number;
  enlem: number | null;
  boylam: number | null;
}

interface SaatRow {
  yon: number | null;
  kalkis_saati: string | null;
  aciklama: string | null;
}

// --------------- main ---------------

export function exportData(databaseFile = dbPath, targetDir = outputDir): void {
  if (!fs.existsSync(databaseFile)) {
    throw new Error(`DB bulunamadi: ${databaseFile}. Once "npm run backup" calistirin.`);
  }

  const db = new Database(databaseFile, { readonly: true });
  const hatDir = path.join(targetDir, "hat");
  fs.mkdirSync(hatDir, { recursive: true });

  // --- hat listesi (sadece ozet alanlar, raw_json yok) ---
  const hatlar = db
    .prepare(
      `SELECT hat_no, hat_adi, hat_baslangic, hat_bitis
       FROM hatlar
       ORDER BY CAST(hat_no AS INTEGER), hat_no`
    )
    .all() as HatRow[];

  fs.writeFileSync(
    path.join(targetDir, "hatlar.json"),
    JSON.stringify({ total: hatlar.length, hatlar }, null, 2) + "\n",
    "utf8"
  );

  // --- prepared statements ---
  const getDuraklar = db.prepare(
    `SELECT d.durak_id, d.durak_adi, d.enlem, d.boylam
     FROM duraktan_gecen_hatlar dgh
     JOIN duraklar d ON d.durak_id = dgh.durak_id
     WHERE dgh.hat_no = ?
     ORDER BY d.durak_id`
  );

  const getGuzergah = db.prepare(
    `SELECT yon, sira, enlem, boylam
     FROM guzergah_noktalari
     WHERE hat_no = ?
     ORDER BY yon, sira`
  );

  const getSaatler = db.prepare(
    `SELECT yon, kalkis_saati, aciklama
     FROM hareket_saatleri
     WHERE hat_no = ?
     ORDER BY yon, kalkis_saati`
  );

  // --- per-hat detail dosyasi ---
  let exported = 0;
  for (const hat of hatlar) {
    const duraklar = getDuraklar.all(hat.hat_no) as DurakRow[];
    const guzergah = getGuzergah.all(hat.hat_no) as GuzergahRow[];
    const saatler = getSaatler.all(hat.hat_no) as SaatRow[];

    const detail = {
      hat_no: hat.hat_no,
      hat_adi: hat.hat_adi,
      hat_baslangic: hat.hat_baslangic,
      hat_bitis: hat.hat_bitis,
      duraklar,
      guzergah,
      saatler,
    };

    const safeNo = hat.hat_no.replace(/[^a-zA-Z0-9._-]/g, "_");
    fs.writeFileSync(
      path.join(hatDir, `${safeNo}.json`),
      JSON.stringify(detail, null, 2) + "\n",
      "utf8"
    );
    exported++;
  }

  db.close();
  console.log(`✓ ${exported} hat export edildi -> ${targetDir}`);
}

if (
  process.argv[1] &&
  (process.argv[1].endsWith("db/export.ts") || process.argv[1].endsWith("db/export.js"))
) {
  exportData();
}

