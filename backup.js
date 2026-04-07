import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PAGE_SIZE = 200;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_FILE = path.join(__dirname, "data", "eshot-hatlar.json");

async function createEshotApi() {
  try {
    // Paketin üst seviye export'u düzelirse doğrudan bu yol kullanılabilir.
    const lib = await import("izmir-open-data-js");
    const Client = lib.IzmirOpenData || lib.IzmirClient || lib.default;
    if (Client) {
      const client = new Client();
      if (client.eshot?.getHatlar) {
        return client.eshot;
      }
    }
  } catch {
    // Kütüphanenin mevcut sürümündeki import sorunu için alt modülden devam edilir.
  }

  const [{ IzmirClient }, { eshot }] = await Promise.all([
    import("izmir-open-data-js/dist/client.js"),
    import("izmir-open-data-js/dist/endpoints/eshot.js"),
  ]);

  const client = new IzmirClient();
  return eshot(client);
}

async function fetchAllHatlar(api) {
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

async function run() {
  const dryRun = process.argv.includes("--dry-run");
  const api = await createEshotApi();
  const { total, records } = await fetchAllHatlar(api);

  const payload = {
    updatedAt: new Date().toISOString(),
    source: "izmir-open-data-js / ESHOT getHatlar",
    total,
    hatlar: records,
  };

  if (dryRun) {
    console.log(`[dry-run] ${records.length} hat kaydi cekildi.`);
    return;
  }

  await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await fs.writeFile(OUTPUT_FILE, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log(`Yedekleme tamamlandi: ${OUTPUT_FILE}`);
  console.log(`Toplam hat kaydi: ${records.length}`);
}

run().catch((error) => {
  console.error("Yedekleme hatasi:", error);
  process.exit(1);
});

