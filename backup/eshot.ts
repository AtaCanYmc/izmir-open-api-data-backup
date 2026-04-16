// .env dosyası varsa yükle (local development için)
try {
    await import("dotenv/config");
} catch { /* ignore */
}

import {getSupabaseClient, isSupabaseConfigured} from "../db/supabase";

interface EshotRecord {
    [key: string]: unknown;
}

interface EshotApi {
    getHatlar(): Promise<EshotRecord[]>;

    getDuraklar(): Promise<EshotRecord[]>;

    getHatGuzergahlari(): Promise<EshotRecord[]>;

    getHareketSaatleri(): Promise<EshotRecord[]>;
}

async function createEshotApi(): Promise<EshotApi> {
    const [{IzmirClient}, {eshot}] = await Promise.all([
        import("izmir-open-data-js/dist/client.js"),
        import("izmir-open-data-js/dist/endpoints/eshot.js"),
    ]);
    const client = new IzmirClient();
    return eshot(client) as unknown as EshotApi;
}

function getHatNo(record: EshotRecord): string | null {
    const raw = record.HAT_NO;
    if (raw === undefined || raw === null) return null;
    const value = String(raw).trim();
    return value ? value : null;
}

function pickNumber(record: EshotRecord, keys: string[]): number | null {
    for (const key of keys) {
        const raw = record[key];
        if (raw === undefined || raw === null || raw === "") continue;
        const value = Number(raw);
        if (!Number.isNaN(value)) return value;
    }
    return null;
}

function pickText(record: EshotRecord, keys: string[]): string | null {
    for (const key of keys) {
        const raw = record[key];
        if (raw === undefined || raw === null) continue;
        const value = String(raw).trim();
        if (value) return value;
    }
    return null;
}

function pickBool(record: EshotRecord, key: string): boolean | null {
    const raw = record[key];
    if (raw === undefined || raw === null) return null;
    const value = String(raw).trim().toLowerCase();
    if (value === "true" || value === "1") return true;
    if (value === "false" || value === "0") return false;
    return null;
}

async function backupEshot(dryRun = false): Promise<void> {
    const api = await createEshotApi();
    const now = new Date();
    const nowIso = now.toISOString();

    console.log("ESHOT hat bilgileri çekiliyor...");
    const hatlar = await api.getHatlar();
    hatlar.sort((a, b) => String(a.HAT_NO || "").localeCompare(String(b.HAT_NO || ""), "tr"));
    console.log(`  ✓ Hatlar: ${hatlar.length} kayıt`);

    console.log("ESHOT durak bilgileri çekiliyor...");
    const duraklar = await api.getDuraklar();
    console.log(`  ✓ Duraklar: ${duraklar.length} kayıt`);

    console.log("ESHOT güzergahlar çekiliyor...");
    const guzergahlar = await api.getHatGuzergahlari();
    console.log(`  ✓ Güzergahlar: ${guzergahlar.length} kayıt`);

    console.log("ESHOT hareket saatleri çekiliyor...");
    const saatler = await api.getHareketSaatleri();
    console.log(`  ✓ Hareket Saatleri: ${saatler.length} kayıt`);

    if (dryRun) {
        console.log("\n[dry-run] Veriler çekildi, DB'ye yazılmayacak.");
        return;
    }

    const supabase = getSupabaseClient();

    // Backup run başlat
    const {data: runData, error: runError} = await supabase
        .from("backup_runs")
        .insert({source: "eshot", started_at: nowIso, status: "running", notes: "ESHOT yedekleme başladı"})
        .select("id")
        .single();

    if (runError || !runData) {
        throw new Error(`Backup run başlatılamadı: ${runError?.message}`);
    }
    const runId = runData.id;

    try {
        console.log("\nSupabase'e yazılıyor...");

        // Temizle
        await supabase.from("eshot_hareket_saatleri").delete().neq("id", 0);
        await supabase.from("eshot_guzergah_noktalari").delete().neq("id", 0);
        await supabase.from("eshot_duraktan_gecen_hatlar").delete().neq("id", 0);
        await supabase.from("eshot_duraklar").delete().neq("id", 0);
        await supabase.from("eshot_hatlar").delete().neq("hat_no", "");

        // Hatlar
        const hatlarData = hatlar
            .map((row) => {
                const hatNo = getHatNo(row);
                if (!hatNo) return null;
                return {
                    hat_no: hatNo,
                    hat_adi: pickText(row, ["HAT_ADI"]),
                    hat_baslangic: pickText(row, ["HAT_BASLANGIC"]),
                    hat_bitis: pickText(row, ["HAT_BITIS"]),
                    updated_at: nowIso,
                };
            })
            .filter(Boolean);

        if (hatlarData.length > 0) {
            const {error} = await supabase.from("eshot_hatlar").upsert(hatlarData, {onConflict: "hat_no"});
            if (error) throw new Error(`Hatlar yazılamadı: ${error.message}`);
        }
        console.log(`  ✓ Hatlar yazıldı`);

        // Duraklar
        for (const row of duraklar) {
            const durakId = pickNumber(row, ["DURAK_ID", "ID"]);
            const hatNo = getHatNo(row);
            await supabase.from("eshot_duraklar").upsert({
                hat_no: hatNo,
                durak_id: durakId,
                durak_adi: pickText(row, ["DURAK_ADI", "ADI"]),
                duraktan_gecen_hatlar: pickText(row, ["DURAKTAN_GECEN_HATLAR"]),
                enlem: pickNumber(row, ["ENLEM", "LAT", "Y"]),
                boylam: pickNumber(row, ["BOYLAM", "LON", "X"]),
                updated_at: nowIso,
            }, {onConflict: "hat_no,durak_id"});
        }
        console.log(`  ✓ Duraklar yazıldı`);
        console.log(`  ✓ Duraktan geçen hatlar yazıldı`);

        // Güzergahlar
        let guzergahSira = 0;
        const guzergahBatch = guzergahlar.map((row) => ({
            hat_no: getHatNo(row),
            yon: pickNumber(row, ["YON"]),
            sira: pickNumber(row, ["SIRA", "SIRANO", "NOKTA_SIRA"]) ?? ++guzergahSira,
            enlem: pickNumber(row, ["ENLEM", "LAT", "Y"]),
            boylam: pickNumber(row, ["BOYLAM", "LON", "X"]),
            updated_at: nowIso,
        }));

        for (let i = 0; i < guzergahBatch.length; i += 1000) {
            const batch = guzergahBatch.slice(i, i + 1000);
            await supabase.from("eshot_guzergah_noktalari").upsert(batch, {onConflict: "hat_no,yon,sira"});
        }
        console.log(`  ✓ Güzergahlar yazıldı`);

        // Hareket saatleri
        const saatlerBatch = saatler.map((row) => ({
            hat_no: getHatNo(row),
            tarife_id: pickNumber(row, ["TARIFE_ID"]),
            sira: pickNumber(row, ["SIRA"]),
            gidis_saati: pickText(row, ["GIDIS_SAATI"]),
            donus_saati: pickText(row, ["DONUS_SAATI"]),
            gidis_engelli_destegi: pickBool(row, "GIDIS_ENGELLI_DESTEGI"),
            donus_engelli_destegi: pickBool(row, "DONUS_ENGELLI_DESTEGI"),
            bisikletli_gidis: pickBool(row, "BISIKLETLI_GIDIS"),
            bisikletli_donus: pickBool(row, "BISIKLETLI_DONUS"),
            gidis_elektrikli_otobus: pickBool(row, "GIDIS_ELEKTRIKLI_OTOBUS"),
            donus_elektrikli_otobus: pickBool(row, "DONUS_ELEKTRIKLI_OTOBUS"),
            updated_at: nowIso,
        }));

        for (let i = 0; i < saatlerBatch.length; i += 1000) {
            const batch = saatlerBatch.slice(i, i + 1000);
            await supabase.from("eshot_hareket_saatleri").insert(batch);
        }
        console.log(`  ✓ Hareket saatleri yazıldı`);

        // Başarılı
        await supabase.from("backup_runs").update({
            finished_at: new Date().toISOString(),
            status: "success",
            notes: `hatlar=${hatlar.length}, duraklar=${duraklar.length}, guzergahlar=${guzergahlar.length}, saatler=${saatler.length}`,
        }).eq("id", runId);

        console.log("\n✓ ESHOT yedekleme tamamlandı!");
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

backupEshot(dryRun).catch((err) => {
    console.error("ESHOT yedekleme hatası:", err);
    process.exit(1);
});

