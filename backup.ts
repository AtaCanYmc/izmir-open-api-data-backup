import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PAGE_SIZE = 200;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "data");
const HATLAR_FILE = path.join(DATA_DIR, "eshot-hatlar.json");
const DURAKLAR_FILE = path.join(DATA_DIR, "eshot-duraklar.json");
const GUZERGAHLAR_FILE = path.join(DATA_DIR, "eshot-guzergahlar.json");
const HAREKET_SAATLERI_FILE = path.join(DATA_DIR, "eshot-hareket-saatleri.json");

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
  const firstPage = await api.getHatlar(PAGE_SIZE, 0);
  const total = Number(firstPage.total) || (firstPage.records?.length ?? 0);
  const allRecords = [...(firstPage.records || [])];

  for (let offset = PAGE_SIZE; offset < total; offset += PAGE_SIZE) {
    const page = await api.getHatlar(PAGE_SIZE, offset);
    if (!page.records?.length) {
      break;
    }
    allRecords.push(...page.records);
  }

  allRecords.sort((a, b) => String(a.HAT_NO || "").localeCompare(String(b.HAT_NO || ""), "tr"));
  return { total, records: allRecords };
}

export function createPayload(total: number, records: EshotHat[], now = new Date()): BackupPayload {
  return {
    updatedAt: now.toISOString(),
    source: "izmir-open-data-js / ESHOT getHatlar",
    total,
    hatlar: records,
  };
}

async function genericBackup(
  api: EshotApi,
  method: keyof EshotApi,
  filename: string,
  dataKey: string,
  now = new Date()
): Promise<{ total: number; records: EshotHat[] }> {
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

  const payload = {
    updatedAt: now.toISOString(),
    source: `izmir-open-data-js / ESHOT ${method}`,
    total,
    [dataKey]: allRecords,
  };

  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(filename, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  return { total, records: allRecords };
}

export async function backupHatlar(api: EshotApi, now = new Date()): Promise<{ total: number; records: EshotHat[] }> {
  return genericBackup(api, "getHatlar", HATLAR_FILE, "hatlar", now);
}

export async function backupDuraklar(api: EshotApi, now = new Date()): Promise<{ total: number; records: EshotHat[] }> {
  return genericBackup(api, "getDuraklar", DURAKLAR_FILE, "duraklar", now);
}

export async function backupHatGuzergahlari(api: EshotApi, now = new Date()): Promise<{ total: number; records: EshotHat[] }> {
  return genericBackup(api, "getHatGuzergahlari", GUZERGAHLAR_FILE, "guzergahlar", now);
}

export async function backupHareketSaatleri(api: EshotApi, now = new Date()): Promise<{ total: number; records: EshotHat[] }> {
  return genericBackup(api, "getHareketSaatleri", HAREKET_SAATLERI_FILE, "saatler", now);
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
  console.log(`  - ${DURAKLAR_FILE}`);
  console.log(`  - ${GUZERGAHLAR_FILE}`);
  console.log(`  - ${HAREKET_SAATLERI_FILE}`);
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  run().catch((error) => {
    console.error("Yedekleme hatasi:", error);
    process.exit(1);
  });
}

