import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createTables } from "./db/init";

const PAGE_SIZE = 200;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "data");
const HATLAR_FILE = path.join(DATA_DIR, "eshot-hatlar.json");
const DB_FILE = path.join(DATA_DIR, "eshot.db");
const require = createRequire(path.join(process.cwd(), "package.json"));
const Database = require("better-sqlite3") as typeof import("better-sqlite3");

export interface EshotHat {
  HAT_NO?: string | number;
  HAT_ADI?: string;
  HAT_BASLANGIC?: string;
  HAT_BITIS?: string;
  [key: string]: unknown;
}

interface HatlarResponse {
  total?: number;
  records?: EshotHat[];
}

export interface EshotApi {
  getHatlar(limit?: number, offset?: number): Promise<HatlarResponse>;
  getDuraklar(limit?: number, offset?: number): Promise<HatlarResponse>;
  getHatGuzergahlari(limit?: number, offset?: number): Promise<HatlarResponse>;
  getHareketSaatleri(limit?: number, offset?: number): Promise<HatlarResponse>;
}

export interface BackupPayload {
  updatedAt: string;
  source: string;
  total: number;
  hatlar: EshotHat[];
}

export interface DurakPayload {
  updatedAt: string;
  source: string;
  total: number;
  duraklar: EshotHat[];
}

export interface GuzergahPayload {
  updatedAt: string;
  source: string;
  total: number;
  guzergahlar: EshotHat[];
}

export interface HareketSaatleriPayload {
  updatedAt: string;
  source: string;
  total: number;
  saatler: EshotHat[];
}

export interface EshotIndexEntry {
  hatNo: string;
  folder: string;
  hatAdi?: string;
  baslangic?: string;
  bitis?: string;
  counts: {
    duraklar: number;
    guzergah: number;
    saatler: number;
  };
}

export interface EshotIndexPayload {
  updatedAt: string;
  source: string;
  total: number;
  hatlar: EshotIndexEntry[];
}

export interface SqlitePersistResult {
  runId: number;
  dbFile: string;
  hatlar: number;
  duraklar: number;
  guzergahlar: number;
  saatler: number;
}

export async function createEshotApi(): Promise<EshotApi> {
  try {
    const lib = await import("izmir-open-data-js");
    const Client =
      (lib as { IzmirOpenData?: new () => unknown; IzmirClient?: new () => unknown; default?: new () => unknown })
        .IzmirOpenData ||
      (lib as { IzmirOpenData?: new () => unknown; IzmirClient?: new () => unknown; default?: new () => unknown })
        .IzmirClient ||
      (lib as { IzmirOpenData?: new () => unknown; IzmirClient?: new () => unknown; default?: new () => unknown })
        .default;

    if (Client) {
      const client = new Client() as { eshot?: EshotApi };
      if (client.eshot?.getHatlar) {
        return client.eshot;
      }
    }
  } catch {
    // Paketin mevcut surumundeki import sorunu nedeniyle fallback yoluna gecilir.
  }

  const [{ IzmirClient }, { eshot }] = await Promise.all([
    import("izmir-open-data-js/dist/client.js"),
    import("izmir-open-data-js/dist/endpoints/eshot.js"),
  ]);

  const client = new IzmirClient();
  return eshot(client) as unknown as EshotApi;
}

export async function fetchAllHatlar(api: EshotApi): Promise<{ total: number; records: EshotHat[] }> {
  return fetchAllByMethod(api, "getHatlar");
}

export function createPayload(total: number, records: EshotHat[], now = new Date()): BackupPayload {
  return {
    updatedAt: now.toISOString(),
    source: "izmir-open-data-js / ESHOT getHatlar",
    total,
    hatlar: records,
  };
}

async function fetchAllByMethod(api: EshotApi, method: keyof EshotApi): Promise<{ total: number; records: EshotHat[] }> {
  const fn = api[method];
  if (typeof fn !== "function") {
    throw new Error(`${method} is not a function`);
  }

  const firstPage = await (fn as (limit?: number, offset?: number) => Promise<HatlarResponse>)(PAGE_SIZE, 0);
  const total = Number(firstPage.total) || (firstPage.records?.length ?? 0);
  const allRecords = [...(firstPage.records || [])];

  for (let offset = PAGE_SIZE; offset < total; offset += PAGE_SIZE) {
    const page = await (fn as (limit?: number, offset?: number) => Promise<HatlarResponse>)(PAGE_SIZE, offset);
    if (!page.records?.length) {
      break;
    }
    allRecords.push(...page.records);
  }

  allRecords.sort((a, b) => String(a.HAT_NO || "").localeCompare(String(b.HAT_NO || ""), "tr"));
  return { total, records: allRecords };
}

async function writeJsonFile(targetFile: string, payload: unknown): Promise<void> {
  await fs.mkdir(path.dirname(targetFile), { recursive: true });
  await fs.writeFile(targetFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function getHatNo(record: EshotHat): string | null {
  const raw = record.HAT_NO;
  if (raw === undefined || raw === null) {
    return null;
  }

  const value = String(raw).trim();
  return value ? value : null;
}

function pickNumber(record: EshotHat, keys: string[]): number | null {
  for (const key of keys) {
    const raw = record[key];
    if (raw === undefined || raw === null || raw === "") continue;
    const value = Number(raw);
    if (!Number.isNaN(value)) {
      return value;
    }
  }
  return null;
}

function pickText(record: EshotHat, keys: string[]): string | null {
  for (const key of keys) {
    const raw = record[key];
    if (raw === undefined || raw === null) continue;
    const value = String(raw).trim();
    if (value) {
      return value;
    }
  }
  return null;
}

function parseDuraktanGecenHatlar(record: EshotHat): string[] {
  const raw = record.DURAKTAN_GECEN_HATLAR;
  if (raw === undefined || raw === null) {
    return [];
  }

  const text = String(raw).trim();
  if (!text) {
    return [];
  }

  const parts = text
    .split(/[;,|]/)
    .flatMap((part) => part.split(/\s+/))
    .map((part) => part.trim())
    .filter(Boolean);

  return [...new Set(parts)];
}

export async function persistAllToSqlite(
  now: Date,
  hatlar: EshotHat[],
  duraklar: EshotHat[],
  guzergahlar: EshotHat[],
  saatler: EshotHat[],
  databaseFile = DB_FILE
): Promise<SqlitePersistResult> {
  createTables(databaseFile);
  const db = new Database(databaseFile);
  const nowIso = now.toISOString();

  const runStartStmt = db.prepare(
    `INSERT INTO backup_runs (source, started_at, status, notes) VALUES (@source, @startedAt, @status, @notes)`
  );
  const runFinishStmt = db.prepare(
    `UPDATE backup_runs SET finished_at = @finishedAt, status = @status, notes = @notes WHERE id = @id`
  );

  const runResult = runStartStmt.run({
    source: "backup.ts",
    startedAt: nowIso,
    status: "running",
    notes: "Veriler API'den cekildi, SQLite yazimi basliyor",
  });
  const runId = Number(runResult.lastInsertRowid);

  const writeAll = db.transaction(() => {
    db.exec(
      "DELETE FROM hatlar; DELETE FROM duraklar; DELETE FROM duraktan_gecen_hatlar; DELETE FROM guzergah_noktalari; DELETE FROM hareket_saatleri;"
    );

    const upsertHat = db.prepare(
      `INSERT INTO hatlar (hat_no, hat_adi, hat_baslangic, hat_bitis, updated_at, raw_json)
       VALUES (@hatNo, @hatAdi, @hatBaslangic, @hatBitis, @updatedAt, @rawJson)
       ON CONFLICT(hat_no) DO UPDATE SET
         hat_adi = excluded.hat_adi,
         hat_baslangic = excluded.hat_baslangic,
         hat_bitis = excluded.hat_bitis,
         updated_at = excluded.updated_at,
         raw_json = excluded.raw_json`
    );

    const upsertDurak = db.prepare(
      `INSERT INTO duraklar (hat_no, durak_id, durak_adi, enlem, boylam, yon, updated_at, raw_json)
       VALUES (@hatNo, @durakId, @durakAdi, @enlem, @boylam, @yon, @updatedAt, @rawJson)
       ON CONFLICT(hat_no, durak_id, yon) DO UPDATE SET
         durak_adi = excluded.durak_adi,
         enlem = excluded.enlem,
         boylam = excluded.boylam,
         updated_at = excluded.updated_at,
         raw_json = excluded.raw_json`
    );

    const upsertDuraktanGecenHat = db.prepare(
      `INSERT INTO duraktan_gecen_hatlar (durak_id, hat_no, updated_at)
       VALUES (@durakId, @hatNo, @updatedAt)
       ON CONFLICT(durak_id, hat_no) DO UPDATE SET
         updated_at = excluded.updated_at`
    );

    const upsertGuzergah = db.prepare(
      `INSERT INTO guzergah_noktalari (hat_no, yon, sira, enlem, boylam, updated_at, raw_json)
       VALUES (@hatNo, @yon, @sira, @enlem, @boylam, @updatedAt, @rawJson)
       ON CONFLICT(hat_no, yon, sira) DO UPDATE SET
         enlem = excluded.enlem,
         boylam = excluded.boylam,
         updated_at = excluded.updated_at,
         raw_json = excluded.raw_json`
    );

    const insertSaat = db.prepare(
      `INSERT INTO hareket_saatleri (hat_no, yon, kalkis_saati, aciklama, updated_at, raw_json)
       VALUES (@hatNo, @yon, @kalkisSaati, @aciklama, @updatedAt, @rawJson)`
    );

    for (const row of hatlar) {
      const hatNo = getHatNo(row);
      if (!hatNo) continue;
      upsertHat.run({
        hatNo,
        hatAdi: pickText(row, ["HAT_ADI"]),
        hatBaslangic: pickText(row, ["HAT_BASLANGIC"]),
        hatBitis: pickText(row, ["HAT_BITIS"]),
        updatedAt: nowIso,
        rawJson: JSON.stringify(row),
      });
    }

    for (const row of duraklar) {
      const durakId = pickNumber(row, ["DURAK_ID", "ID"]);
      upsertDurak.run({
        hatNo: getHatNo(row),
        durakId,
        durakAdi: pickText(row, ["DURAK_ADI", "ADI"]),
        enlem: pickNumber(row, ["ENLEM", "LAT", "Y"]),
        boylam: pickNumber(row, ["BOYLAM", "LON", "X"]),
        yon: pickNumber(row, ["YON"]),
        updatedAt: nowIso,
        rawJson: JSON.stringify(row),
      });

      if (durakId !== null) {
        const lines = parseDuraktanGecenHatlar(row);
        for (const hatNo of lines) {
          upsertDuraktanGecenHat.run({
            durakId,
            hatNo,
            updatedAt: nowIso,
          });
        }
      }
    }

    let guzergahSira = 0;
    for (const row of guzergahlar) {
      const sira = pickNumber(row, ["SIRA", "SIRANO", "NOKTA_SIRA"]) ?? ++guzergahSira;
      upsertGuzergah.run({
        hatNo: getHatNo(row),
        yon: pickNumber(row, ["YON"]),
        sira,
        enlem: pickNumber(row, ["ENLEM", "LAT", "Y"]),
        boylam: pickNumber(row, ["BOYLAM", "LON", "X"]),
        updatedAt: nowIso,
        rawJson: JSON.stringify(row),
      });
    }

    for (const row of saatler) {
      insertSaat.run({
        hatNo: getHatNo(row),
        yon: pickNumber(row, ["YON"]),
        kalkisSaati: pickText(row, ["KALKIS_SAATI", "HAREKET_SAATI", "SAAT", "GIDIS_SAATI", "DONUS_SAATI"]),
        aciklama: pickText(row, ["ACIKLAMA", "NOT", "TIP"]),
        updatedAt: nowIso,
        rawJson: JSON.stringify(row),
      });
    }
  });

  try {
    writeAll();
    runFinishStmt.run({
      id: runId,
      finishedAt: new Date().toISOString(),
      status: "success",
      notes: `hatlar=${hatlar.length}, duraklar=${duraklar.length}, guzergahlar=${guzergahlar.length}, saatler=${saatler.length}`,
    });
  } catch (error) {
    runFinishStmt.run({
      id: runId,
      finishedAt: new Date().toISOString(),
      status: "failed",
      notes: error instanceof Error ? error.message : "Bilinmeyen hata",
    });
    db.close();
    throw error;
  }

  db.close();

  return {
    runId,
    dbFile: databaseFile,
    hatlar: hatlar.length,
    duraklar: duraklar.length,
    guzergahlar: guzergahlar.length,
    saatler: saatler.length,
  };
}

function normalizeFolderName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function groupByHatNo(records: EshotHat[]): Map<string, EshotHat[]> {
  const grouped = new Map<string, EshotHat[]>();
  for (const record of records) {
    const hatNo = getHatNo(record);
    if (!hatNo) {
      continue;
    }
    const bucket = grouped.get(hatNo);
    if (bucket) {
      bucket.push(record);
      continue;
    }
    grouped.set(hatNo, [record]);
  }
  return grouped;
}

export async function writeHatBasedFiles(
  baseDataDir: string,
  now: Date,
  hatlar: EshotHat[],
  duraklar: EshotHat[],
  guzergahlar: EshotHat[],
  saatler: EshotHat[]
): Promise<EshotIndexPayload> {
  const targetEshotDir = path.join(baseDataDir, "eshot");
  await fs.rm(targetEshotDir, { recursive: true, force: true });
  await fs.mkdir(targetEshotDir, { recursive: true });

  const durakByHat = groupByHatNo(duraklar);
  const guzergahByHat = groupByHatNo(guzergahlar);
  const saatlerByHat = groupByHatNo(saatler);

  const hatInfoByNo = new Map<string, EshotHat>();
  const hatNumbers = new Set<string>();

  for (const hat of hatlar) {
    const hatNo = getHatNo(hat);
    if (!hatNo) {
      continue;
    }
    hatNumbers.add(hatNo);
    if (!hatInfoByNo.has(hatNo)) {
      hatInfoByNo.set(hatNo, hat);
    }
  }

  for (const key of durakByHat.keys()) hatNumbers.add(key);
  for (const key of guzergahByHat.keys()) hatNumbers.add(key);
  for (const key of saatlerByHat.keys()) hatNumbers.add(key);

  const sortedHatNumbers = [...hatNumbers].sort((a, b) => a.localeCompare(b, "tr", { numeric: true }));
  const indexRows: EshotIndexEntry[] = [];

  for (const hatNo of sortedHatNumbers) {
    const folder = normalizeFolderName(hatNo);
    const lineDir = path.join(targetEshotDir, folder);
    const lineInfo = hatInfoByNo.get(hatNo);
    const lineDuraklar = durakByHat.get(hatNo) || [];
    const lineGuzergahlar = guzergahByHat.get(hatNo) || [];
    const lineSaatler = saatlerByHat.get(hatNo) || [];

    await fs.mkdir(lineDir, { recursive: true });

    await writeJsonFile(path.join(lineDir, "duraklar.json"), {
      updatedAt: now.toISOString(),
      source: "izmir-open-data-js / ESHOT getDuraklar",
      hatNo,
      total: lineDuraklar.length,
      duraklar: lineDuraklar,
    });

    await writeJsonFile(path.join(lineDir, "guzergah.json"), {
      updatedAt: now.toISOString(),
      source: "izmir-open-data-js / ESHOT getHatGuzergahlari",
      hatNo,
      total: lineGuzergahlar.length,
      guzergah: lineGuzergahlar,
    });

    await writeJsonFile(path.join(lineDir, "saatler.json"), {
      updatedAt: now.toISOString(),
      source: "izmir-open-data-js / ESHOT getHareketSaatleri",
      hatNo,
      total: lineSaatler.length,
      saatler: lineSaatler,
    });

    indexRows.push({
      hatNo,
      folder,
      hatAdi: lineInfo?.HAT_ADI ? String(lineInfo.HAT_ADI) : undefined,
      baslangic: lineInfo?.HAT_BASLANGIC ? String(lineInfo.HAT_BASLANGIC) : undefined,
      bitis: lineInfo?.HAT_BITIS ? String(lineInfo.HAT_BITIS) : undefined,
      counts: {
        duraklar: lineDuraklar.length,
        guzergah: lineGuzergahlar.length,
        saatler: lineSaatler.length,
      },
    });
  }

  const payload: EshotIndexPayload = {
    updatedAt: now.toISOString(),
    source: "izmir-open-data-js / ESHOT grouped by HAT_NO",
    total: indexRows.length,
    hatlar: indexRows,
  };

  await writeJsonFile(path.join(targetEshotDir, "index.json"), payload);
  return payload;
}

export async function backupHatlar(api: EshotApi, now = new Date()): Promise<{ total: number; records: EshotHat[] }> {
  const result = await fetchAllByMethod(api, "getHatlar");
  await writeJsonFile(HATLAR_FILE, createPayload(result.total, result.records, now));
  return result;
}

export async function backupDuraklar(api: EshotApi, now = new Date()): Promise<{ total: number; records: EshotHat[] }> {
  void now;
  return fetchAllByMethod(api, "getDuraklar");
}

export async function backupHatGuzergahlari(api: EshotApi, now = new Date()): Promise<{ total: number; records: EshotHat[] }> {
  void now;
  return fetchAllByMethod(api, "getHatGuzergahlari");
}

export async function backupHareketSaatleri(api: EshotApi, now = new Date()): Promise<{ total: number; records: EshotHat[] }> {
  void now;
  return fetchAllByMethod(api, "getHareketSaatleri");
}

export async function backupAll(api: EshotApi, dryRun = false): Promise<void> {
  const now = new Date();

  console.log("ESHOT hat bilgileri yedekleniyor...");
  const hatlarResult = await backupHatlar(api, now);
  if (!dryRun) console.log(`  ✓ Hatlar: ${hatlarResult.records.length} kayit`);

  console.log("ESHOT durak bilgileri yedekleniyor...");
  const duraklar = await backupDuraklar(api, now);
  if (!dryRun) console.log(`  ✓ Duraklar: ${duraklar.records.length} kayit`);

  console.log("ESHOT hat guzergahları yedekleniyor...");
  const guzergahlar = await backupHatGuzergahlari(api, now);
  if (!dryRun) console.log(`  ✓ Guzergahlar: ${guzergahlar.records.length} kayit`);

  console.log("ESHOT hareket saatleri yedekleniyor...");
  const saatler = await backupHareketSaatleri(api, now);
  if (!dryRun) console.log(`  ✓ Hareket Saatleri: ${saatler.records.length} kayit`);

  if (!dryRun) {
    console.log("Veriler SQLite veritabanina yaziliyor...");
    const persistResult = await persistAllToSqlite(now, hatlarResult.records, duraklar.records, guzergahlar.records, saatler.records);
    console.log(`  ✓ SQLite run id: ${persistResult.runId}`);
    console.log(`  ✓ SQLite dosyasi: ${persistResult.dbFile}`);
  }
}

export async function run(argv = process.argv): Promise<void> {
  const dryRun = argv.includes("--dry-run");
  const api = await createEshotApi();

  if (dryRun) {
    console.log("[dry-run modu] Veri cekiliyor...\n");
    await backupAll(api, true);
    console.log("\n[dry-run] Testim basarili!");
    return;
  }

  await backupAll(api);
  console.log("\n✓ Tum yedeklemeler tamamlandi!");
  console.log(`  - ${HATLAR_FILE}`);
  console.log(`  - ${DB_FILE}`);
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  run().catch((error) => {
    console.error("Yedekleme hatasi:", error);
    process.exit(1);
  });
}

