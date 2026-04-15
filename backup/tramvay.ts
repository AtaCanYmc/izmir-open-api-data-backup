// .env dosyası varsa yükle (local development için)
try {
    await import("dotenv/config");
} catch { /* ignore */
}

import {getSupabaseClient, isSupabaseConfigured} from "../db/supabase";

interface TramvayRecord {
    [key: string]: unknown;
}

interface TramvayApi {
    getHatList(): Promise<TramvayRecord[]>;
}

async function createTramvayApi(): Promise<TramvayApi> {
    const [{IzmirClient}, {tramvay}] = await Promise.all([
        import("izmir-open-data-js/dist/client.js"),
        import("izmir-open-data-js/dist/endpoints/tramvay.js"),
    ]);
    const client = new IzmirClient();
    return tramvay(client) as unknown as TramvayApi;
}

function pickNumber(record: TramvayRecord, keys: string[]): number | null {
    for (const key of keys) {
        const raw = record[key];
        if (raw === undefined || raw === null || raw === "") continue;
        const value = Number(raw);
        if (!Number.isNaN(value)) return value;
    }
    return null;
}

function pickText(record: TramvayRecord, keys: string[]): string | null {
    for (const key of keys) {
        const raw = record[key];
        if (raw === undefined || raw === null) continue;
        const value = String(raw).trim();
        if (value) return value;
    }
    return null;
}

async function backupTramvay(dryRun = false): Promise<void> {
    const api = await createTramvayApi();
    const now = new Date();
    const nowIso = now.toISOString();

    console.log("Tramvay hatları çekiliyor...");
    const hatlar = await api.getHatList();
    console.log(`  ✓ Tramvay Hatları: ${hatlar.length} kayıt`);

    if (dryRun) {
        console.log("\n[dry-run] Veriler çekildi, DB'ye yazılmayacak.");
        return;
    }

    const supabase = getSupabaseClient();

    // Backup run başlat
    const {data: runData, error: runError} = await supabase
        .from("backup_runs")
        .insert({source: "tramvay", started_at: nowIso, status: "running", notes: "Tramvay yedekleme başladı"})
        .select("id")
        .single();

    if (runError || !runData) {
        throw new Error(`Backup run başlatılamadı: ${runError?.message}`);
    }
    const runId = runData.id;

    try {
        console.log("\nSupabase'e yazılıyor...");

        // Temizle
        await supabase.from("tramvay_hatlar").delete().neq("id", 0);

        // Yaz
        const batch = hatlar.map((row) => ({
            hat_id: pickNumber(row, ["SeferId", "Id"]),
            hat_adi: pickText(row, ["Adi", "SeferAdi"]),
            hat_kodu: pickText(row, ["Kod", "HatKodu"]),
            updated_at: nowIso,
        }));

        if (batch.length > 0) {
            const {error} = await supabase.from("tramvay_hatlar").upsert(batch, {onConflict: "hat_id"});
            if (error) throw new Error(`Tramvay hatları yazılamadı: ${error.message}`);
        }
        console.log(`  ✓ Tramvay hatları yazıldı`);

        // Başarılı
        await supabase.from("backup_runs").update({
            finished_at: new Date().toISOString(),
            status: "success",
            notes: `tramvay_hatlar=${hatlar.length}`,
        }).eq("id", runId);

        console.log("\n✓ Tramvay yedekleme tamamlandı!");
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

backupTramvay(dryRun).catch((err) => {
    console.error("Tramvay yedekleme hatası:", err);
    process.exit(1);
});

