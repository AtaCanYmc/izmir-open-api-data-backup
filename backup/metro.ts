// .env dosyası varsa yükle (local development için)
try { await import("dotenv/config"); } catch { /* ignore */ }

import { getSupabaseClient, isSupabaseConfigured } from "../db/supabase";

interface MetroRecord {
  [key: string]: unknown;
}

interface MetroApi {
  getIstasyonList(): Promise<MetroRecord[]>;
}

async function createMetroApi(): Promise<MetroApi> {
  const [{ IzmirClient }, { metro }] = await Promise.all([
    import("izmir-open-data-js/dist/client.js"),
    import("izmir-open-data-js/dist/endpoints/metro.js"),
  ]);
  const client = new IzmirClient();
  return metro(client) as unknown as MetroApi;
}

function pickNumber(record: MetroRecord, keys: string[]): number | null {
  for (const key of keys) {
    const raw = record[key];
    if (raw === undefined || raw === null || raw === "") continue;
    const value = Number(raw);
    if (!Number.isNaN(value)) return value;
  }
  return null;
}

function pickText(record: MetroRecord, keys: string[]): string | null {
  for (const key of keys) {
    const raw = record[key];
    if (raw === undefined || raw === null) continue;
    const value = String(raw).trim();
    if (value) return value;
  }
  return null;
}

async function backupMetro(dryRun = false): Promise<void> {
  const api = await createMetroApi();
  const now = new Date();
  const nowIso = now.toISOString();

  console.log("Metro istasyonları çekiliyor...");
  const istasyonlar = await api.getIstasyonList();
  console.log(`  ✓ Metro İstasyonları: ${istasyonlar.length} kayıt`);

  if (dryRun) {
    console.log("\n[dry-run] Veriler çekildi, DB'ye yazılmayacak.");
    return;
  }

  const supabase = getSupabaseClient();

  // Backup run başlat
  const { data: runData, error: runError } = await supabase
    .from("backup_runs")
    .insert({ source: "metro", started_at: nowIso, status: "running", notes: "Metro yedekleme başladı" })
    .select("id")
    .single();

  if (runError || !runData) {
    throw new Error(`Backup run başlatılamadı: ${runError?.message}`);
  }
  const runId = runData.id;

  try {
    console.log("\nSupabase'e yazılıyor...");

    // Temizle
    await supabase.from("metro_istasyonlar").delete().neq("id", 0);

    // Yaz
    const batch = istasyonlar.map((row) => ({
      istasyon_id: pickNumber(row, ["ISTASYON_ID", "ID"]),
      istasyon_adi: pickText(row, ["ISTASYON_ADI", "ADI"]),
      sira: pickNumber(row, ["SIRA"]),
      enlem: pickNumber(row, ["ENLEM", "LAT", "Y"]),
      boylam: pickNumber(row, ["BOYLAM", "LON", "X"]),
      updated_at: nowIso,
    }));

    if (batch.length > 0) {
      const { error } = await supabase.from("metro_istasyonlar").upsert(batch, { onConflict: "istasyon_id" });
      if (error) throw new Error(`Metro istasyonları yazılamadı: ${error.message}`);
    }
    console.log(`  ✓ Metro istasyonları yazıldı`);

    // Başarılı
    await supabase.from("backup_runs").update({
      finished_at: new Date().toISOString(),
      status: "success",
      notes: `metro_istasyonlar=${istasyonlar.length}`,
    }).eq("id", runId);

    console.log("\n✓ Metro yedekleme tamamlandı!");
  } catch (error) {
    await supabase.from("backup_runs").update({
      finished_at: new Date().toISOString(),
      status: "failed",
      notes: error instanceof Error ? error.message : "Bilinmeyen hata",
    }).eq("id", runId);
    throw error;
  }
}

// CLI
const dryRun = process.argv.includes("--dry-run");
if (!dryRun && !isSupabaseConfigured()) {
  console.error("Hata: SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY tanımlanmalı");
  process.exit(1);
}

backupMetro(dryRun).catch((err) => {
  console.error("Metro yedekleme hatası:", err);
  process.exit(1);
});

