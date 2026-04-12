import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createTables } from "./db/init";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "public", "data");
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

export interface EshotApi {
  getHatlar(): Promise<EshotHat[]>;
  getDuraklar(): Promise<EshotHat[]>;
  getHatGuzergahlari(): Promise<EshotHat[]>;
  getHareketSaatleri(): Promise<EshotHat[]>;
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
  const [{ IzmirClient }, { eshot }] = await Promise.all([
    import("izmir-open-data-js/dist/client.js"),
    import("izmir-open-data-js/dist/endpoints/eshot.js"),
  ]);

  const client = new IzmirClient();
  return eshot(client) as unknown as EshotApi;
}

function getHatNo(record: EshotHat): string | null {
  const raw = record.HAT_NO;
  if (raw === undefined || raw === null) return null;
  const value = String(raw).trim();
  return value ? value : null;
}

function pickNumber(record: EshotHat, keys: string[]): number | null {
  for (const key of keys) {
    const raw = record[key];
    if (raw === undefined || raw === null || raw === "") continue;
    const value = Number(raw);
    if (!Number.isNaN(value)) return value;
  }
  return null;
}

function pickText(record: EshotHat, keys: string[]): string | null {
  for (const key of keys) {
    const raw = record[key];
    if (raw === undefined || raw === null) continue;
    const value = String(raw).trim();
    if (value) return value;
  }
  return null;
}

function pickBool(record: EshotHat, key: string): number | null {
  const raw = record[key];
  if (raw === undefined || raw === null) return null;
  const value = String(raw).trim().toLowerCase();
  if (value === "true" || value === "1") return 1;
  if (value === "false" || value === "0") return 0;
  return null;
}

function parseDuraktanGecenHatlar(record: EshotHat): string[] {
  const raw = record.DURAKTAN_GECEN_HATLAR;
  if (raw === undefined || raw === null) return [];
  const text = String(raw).trim();
  if (!text) return [];
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
      `INSERT INTO duraklar (hat_no, durak_id, durak_adi, enlem, boylam, updated_at, raw_json)
       VALUES (@hatNo, @durakId, @durakAdi, @enlem, @boylam, @updatedAt, @rawJson)
       ON CONFLICT(hat_no, durak_id) DO UPDATE SET
         durak_adi = excluded.durak_adi,
         enlem = excluded.enlem,
         boylam = excluded.boylam,
         updated_at = excluded.updated_at,
         raw_json = excluded.raw_json`
    );

    const upsertDuraktanGecenHat = db.prepare(
      `INSERT INTO duraktan_gecen_hatlar (durak_id, hat_no, updated_at)
       VALUES (@durakId, @hatNo, @updatedAt)
       ON CONFLICT(durak_id, hat_no) DO UPDATE SET updated_at = excluded.updated_at`
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
      `INSERT INTO hareket_saatleri (hat_no, tarife_id, sira, gidis_saati, donus_saati, 
        gidis_engelli_destegi, donus_engelli_destegi, bisikletli_gidis, bisikletli_donus,
        gidis_elektrikli_otobus, donus_elektrikli_otobus, updated_at, raw_json)
       VALUES (@hatNo, @tarifeId, @sira, @gidisSaati, @donusSaati,
        @gidisEngelliDestegi, @donusEngelliDestegi, @bisikletliGidis, @bisikletliDonus,
        @gidisElektrikliOtobus, @donusElektrikliOtobus, @updatedAt, @rawJson)`
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
        updatedAt: nowIso,
        rawJson: JSON.stringify(row),
      });

      if (durakId !== null) {
        for (const hatNo of parseDuraktanGecenHatlar(row)) {
          upsertDuraktanGecenHat.run({ durakId, hatNo, updatedAt: nowIso });
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
        tarifeId: pickNumber(row, ["TARIFE_ID"]),
        sira: pickNumber(row, ["SIRA"]),
        gidisSaati: pickText(row, ["GIDIS_SAATI"]),
        donusSaati: pickText(row, ["DONUS_SAATI"]),
        gidisEngelliDestegi: pickBool(row, "GIDIS_ENGELLI_DESTEGI"),
        donusEngelliDestegi: pickBool(row, "DONUS_ENGELLI_DESTEGI"),
        bisikletliGidis: pickBool(row, "BISIKLETLI_GIDIS"),
        bisikletliDonus: pickBool(row, "BISIKLETLI_DONUS"),
        gidisElektrikliOtobus: pickBool(row, "GIDIS_ELEKTRIKLI_OTOBUS"),
        donusElektrikliOtobus: pickBool(row, "DONUS_ELEKTRIKLI_OTOBUS"),
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
  return { runId, dbFile: databaseFile, hatlar: hatlar.length, duraklar: duraklar.length, guzergahlar: guzergahlar.length, saatler: saatler.length };
}

export async function backupHatlar(api: EshotApi): Promise<{ total: number; records: EshotHat[] }> {
  const records = await api.getHatlar();
  records.sort((a, b) => String(a.HAT_NO || "").localeCompare(String(b.HAT_NO || ""), "tr"));
  return { total: records.length, records };
}

export async function backupDuraklar(api: EshotApi): Promise<{ total: number; records: EshotHat[] }> {
  const records = await api.getDuraklar();
  return { total: records.length, records };
}

export async function backupHatGuzergahlari(api: EshotApi): Promise<{ total: number; records: EshotHat[] }> {
  const records = await api.getHatGuzergahlari();
  return { total: records.length, records };
}

export async function backupHareketSaatleri(api: EshotApi): Promise<{ total: number; records: EshotHat[] }> {
  const records = await api.getHareketSaatleri();
  return { total: records.length, records };
}

export async function backupAll(api: EshotApi, dryRun = false): Promise<void> {
  const now = new Date();

  console.log("ESHOT hat bilgileri cekiliyor...");
  const hatlar = await backupHatlar(api);
  console.log(`  ✓ Hatlar: ${hatlar.records.length} kayit`);

  console.log("ESHOT durak bilgileri cekiliyor...");
  const duraklar = await backupDuraklar(api);
  console.log(`  ✓ Duraklar: ${duraklar.records.length} kayit`);

  console.log("ESHOT guzergahlar cekiliyor...");
  const guzergahlar = await backupHatGuzergahlari(api);
  console.log(`  ✓ Guzergahlar: ${guzergahlar.records.length} kayit`);

  console.log("ESHOT hareket saatleri cekiliyor...");
  const saatler = await backupHareketSaatleri(api);
  console.log(`  ✓ Hareket Saatleri: ${saatler.records.length} kayit`);

  if (dryRun) return;

  console.log("SQLite veritabanina yaziliyor...");
  const result = await persistAllToSqlite(now, hatlar.records, duraklar.records, guzergahlar.records, saatler.records);
  console.log(`  ✓ run id  : ${result.runId}`);
  console.log(`  ✓ db      : ${result.dbFile}`);
}

export async function run(argv = process.argv): Promise<void> {
  const dryRun = argv.includes("--dry-run");
  const api = await createEshotApi();

  if (dryRun) {
    console.log("[dry-run] Veri cekiliyor, DB'ye yazilmayacak...\n");
    await backupAll(api, true);
    console.log("\n[dry-run] Basarili!");
    return;
  }

  await backupAll(api);
  console.log(`\n✓ Yedekleme tamamlandi! -> ${DB_FILE}`);
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  run().catch((error) => {
    console.error("Yedekleme hatasi:", error);
    process.exit(1);
  });
}
