import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PAGE_SIZE = 200;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "data");
const HATLAR_FILE = path.join(DATA_DIR, "eshot-hatlar.json");
const ESHOT_DIR = path.join(DATA_DIR, "eshot");
const ESHOT_INDEX_FILE = path.join(ESHOT_DIR, "index.json");

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
    console.log("Veriler hat bazli klasorlere yaziliyor...");
    const index = await writeHatBasedFiles(DATA_DIR, now, hatlarResult.records, duraklar.records, guzergahlar.records, saatler.records);
    console.log(`  ✓ Hat klasorleri: ${index.total}`);
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
  console.log(`  - ${ESHOT_INDEX_FILE}`);
  console.log(`  - ${ESHOT_DIR}/<hatNo>/duraklar.json`);
  console.log(`  - ${ESHOT_DIR}/<hatNo>/guzergah.json`);
  console.log(`  - ${ESHOT_DIR}/<hatNo>/saatler.json`);
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  run().catch((error) => {
    console.error("Yedekleme hatasi:", error);
    process.exit(1);
  });
}

