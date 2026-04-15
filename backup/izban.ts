// .env dosyası varsa yükle (local development için)
try { await import("dotenv/config"); } catch { /* ignore */ }

import { getSupabaseClient, isSupabaseConfigured } from "../db/supabase";

interface IzbanRecord {
  [key: string]: unknown;
}

interface IzbanApi {
  getIstasyonList(): Promise<IzbanRecord[]>;
}

async function createIzbanApi(): Promise<IzbanApi> {
  const [{ IzmirClient }, { izban }] = await Promise.all([
    import("izmir-open-data-js/dist/client.js"),
    import("izmir-open-data-js/dist/endpoints/izban.js"),
  ]);
  const client = new IzmirClient();
  return izban(client) as unknown as IzbanApi;
}

function pickNumber(record: IzbanRecord, keys: string[]): number | null {
  for (const key of keys) {
    const raw = record[key];
    if (raw === undefined || raw === null || raw === "") continue;
    const value = Number(raw);
    if (!Number.isNaN(value)) return value;
  }
  return null;
}

function pickText(record: IzbanRecord, keys: string[]): string | null {
  for (const key of keys) {
    const raw = record[key];
    if (raw === undefined || raw === null) continue;
    const value = String(raw).trim();
    if (value) return value;
  }
  return null;
}

async function backupIzban(dryRun = false): Promise<void> {
  const api = await createIzbanApi();
  const now = new Date();
  const nowIso = now.toISOString();

  console.log("İzban istasyonları çekiliyor...");
  const istasyonlar = await api.getIstasyonList();
  console.log(`  ✓ İzban İstasyonları: ${istasyonlar.length} kayıt`);

  if (dryRun) {
    console.log("\n[dry-run] Veriler çekildi, DB'ye yazılmayacak.");
    return;
  }

  const supabase = getSupabaseClient();

  // Backup run başlat
  const { data: runData, error: runError } = await supabase
    .from("backup_runs")
    .insert({ source: "izban", started_at: nowIso, status: "running", notes: "İzban yedekleme başladı" })
    .select("id")
    .single();

  if (runError || !runData) {
    throw new Error(`Backup run başlatılamadı: ${runError?.message}`);
  }
  const runId = runData.id;

  try {
    console.log("\nSupabase'e yazılıyor...");

    // Temizle
    await supabase.from("izban_istasyonlar").delete().neq("id", 0);

    // Yaz
    const batch = istasyonlar.map((row) => ({
      istasyon_id: pickNumber(row, ["ISTASYON_ID", "ID"]),
      istasyon_adi: pickText(row, ["ISTASYON_ADI", "ADI"]),
      enlem: pickNumber(row, ["ENLEM", "LAT", "Y"]),
      boylam: pickNumber(row, ["BOYLAM", "LON", "X"]),
      updated_at: nowIso,
    }));

    if (batch.length > 0) {
      const { error } = await supabase.from("izban_istasyonlar").upsert(batch, { onConflict: "istasyon_id" });
      if (error) throw new Error(`İzban istasyonları yazılamadı: ${error.message}`);
    }
    console.log(`  ✓ İzban istasyonları yazıldı`);

    // Başarılı
    await supabase.from("backup_runs").update({
      finished_at: new Date().toISOString(),
      status: "success",
      notes: `izban_istasyonlar=${istasyonlar.length}`,
    }).eq("id", runId);

    console.log("\n✓ İzban yedekleme tamamlandı!");
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

backupIzban(dryRun).catch((err) => {
  console.error("İzban yedekleme hatası:", err);
  process.exit(1);
});

