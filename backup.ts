import "dotenv/config";
import { pathToFileURL } from "node:url";
import { getSupabaseClient, isSupabaseConfigured } from "./db/supabase";

export interface EshotHat {
  HAT_NO?: string | number;
  HAT_ADI?: string;
  HAT_BASLANGIC?: string;
  HAT_BITIS?: string;
  [key: string]: unknown;
}

export interface IstasyonRecord {
  [key: string]: unknown;
}

export interface EshotApi {
  getHatlar(): Promise<EshotHat[]>;
  getDuraklar(): Promise<EshotHat[]>;
  getHatGuzergahlari(): Promise<EshotHat[]>;
  getHareketSaatleri(): Promise<EshotHat[]>;
}

export interface MetroApi {
  getIstasyonList(): Promise<IstasyonRecord[]>;
}

export interface IzbanApi {
  getIstasyonList(): Promise<IstasyonRecord[]>;
}

export interface TramvayApi {
  getHatList(): Promise<IstasyonRecord[]>;
}

export interface SupabasePersistResult {
  runId: number;
  hatlar: number;
  duraklar: number;
  guzergahlar: number;
  saatler: number;
  metroIstasyonlar: number;
  izbanIstasyonlar: number;
  tramvayHatlar: number;
}

export async function createEshotApi(): Promise<EshotApi> {
  const [{ IzmirClient }, { eshot }] = await Promise.all([
    import("izmir-open-data-js/dist/client.js"),
    import("izmir-open-data-js/dist/endpoints/eshot.js"),
  ]);

  const client = new IzmirClient();
  return eshot(client) as unknown as EshotApi;
}

export async function createMetroApi(): Promise<MetroApi> {
  const [{ IzmirClient }, { metro }] = await Promise.all([
    import("izmir-open-data-js/dist/client.js"),
    import("izmir-open-data-js/dist/endpoints/metro.js"),
  ]);

  const client = new IzmirClient();
  return metro(client) as unknown as MetroApi;
}

export async function createIzbanApi(): Promise<IzbanApi> {
  const [{ IzmirClient }, { izban }] = await Promise.all([
    import("izmir-open-data-js/dist/client.js"),
    import("izmir-open-data-js/dist/endpoints/izban.js"),
  ]);

  const client = new IzmirClient();
  return izban(client) as unknown as IzbanApi;
}

export async function createTramvayApi(): Promise<TramvayApi> {
  const [{ IzmirClient }, { tramvay }] = await Promise.all([
    import("izmir-open-data-js/dist/client.js"),
    import("izmir-open-data-js/dist/endpoints/tramvay.js"),
  ]);

  const client = new IzmirClient();
  return tramvay(client) as unknown as TramvayApi;
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

function pickBool(record: EshotHat, key: string): boolean | null {
  const raw = record[key];
  if (raw === undefined || raw === null) return null;
  const value = String(raw).trim().toLowerCase();
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
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

export async function persistAllToSupabase(
  now: Date,
  hatlar: EshotHat[],
  duraklar: EshotHat[],
  guzergahlar: EshotHat[],
  saatler: EshotHat[],
  metroIstasyonlar: IstasyonRecord[],
  izbanIstasyonlar: IstasyonRecord[],
  tramvayHatlar: IstasyonRecord[]
): Promise<SupabasePersistResult> {
  const supabase = getSupabaseClient();
  const nowIso = now.toISOString();

  // Backup run başlat
  const { data: runData, error: runError } = await supabase
    .from("backup_runs")
    .insert({
      source: "backup.ts",
      started_at: nowIso,
      status: "running",
      notes: "Veriler API'den cekildi, Supabase yazimi basliyor",
    })
    .select("id")
    .single();

  if (runError || !runData) {
    throw new Error(`Backup run başlatılamadı: ${runError?.message}`);
  }
  const runId = runData.id;

  try {
    // Mevcut verileri temizle
    console.log("  Mevcut veriler temizleniyor...");
    await supabase.from("eshot_hareket_saatleri").delete().neq("id", 0);
    await supabase.from("eshot_guzergah_noktalari").delete().neq("id", 0);
    await supabase.from("eshot_duraktan_gecen_hatlar").delete().neq("id", 0);
    await supabase.from("eshot_duraklar").delete().neq("id", 0);
    await supabase.from("eshot_hatlar").delete().neq("hat_no", "");
    await supabase.from("metro_istasyonlar").delete().neq("id", 0);
    await supabase.from("izban_istasyonlar").delete().neq("id", 0);
    await supabase.from("tramvay_hatlar").delete().neq("id", 0);

    // Hatları yaz
    console.log("  Hatlar yazılıyor...");
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
      const { error } = await supabase.from("eshot_hatlar").upsert(hatlarData, { onConflict: "hat_no" });
      if (error) throw new Error(`Hatlar yazılamadı: ${error.message}`);
    }

    // Durakları yaz
    console.log("  Duraklar yazılıyor...");
    const durakTanGecenHatlarBatch: { durak_id: number; hat_no: string; updated_at: string }[] = [];

    for (const row of duraklar) {
      const durakId = pickNumber(row, ["DURAK_ID", "ID"]);
      const hatNo = getHatNo(row);

      const { error } = await supabase.from("eshot_duraklar").upsert(
        {
          hat_no: hatNo,
          durak_id: durakId,
          durak_adi: pickText(row, ["DURAK_ADI", "ADI"]),
          enlem: pickNumber(row, ["ENLEM", "LAT", "Y"]),
          boylam: pickNumber(row, ["BOYLAM", "LON", "X"]),
          updated_at: nowIso,
        },
        { onConflict: "hat_no,durak_id" }
      );
      if (error) console.warn(`  Durak yazılamadı: ${error.message}`);

      // Duraktan geçen hatları topla
      if (durakId !== null) {
        for (const gecenHatNo of parseDuraktanGecenHatlar(row)) {
          durakTanGecenHatlarBatch.push({
            durak_id: durakId,
            hat_no: gecenHatNo,
            updated_at: nowIso,
          });
        }
      }
    }

    // Duraktan geçen hatları batch olarak yaz
    if (durakTanGecenHatlarBatch.length > 0) {
      console.log("  Duraktan geçen hatlar yazılıyor...");
      // Supabase'de batch upsert için 1000'lik parçalara böl
      for (let i = 0; i < durakTanGecenHatlarBatch.length; i += 1000) {
        const batch = durakTanGecenHatlarBatch.slice(i, i + 1000);
        const { error } = await supabase
          .from("eshot_duraktan_gecen_hatlar")
          .upsert(batch, { onConflict: "durak_id,hat_no" });
        if (error) console.warn(`  Duraktan geçen hatlar yazılamadı: ${error.message}`);
      }
    }

    // Güzergahları yaz
    console.log("  Güzergahlar yazılıyor...");
    let guzergahSira = 0;
    const guzergahBatch = guzergahlar.map((row) => {
      const sira = pickNumber(row, ["SIRA", "SIRANO", "NOKTA_SIRA"]) ?? ++guzergahSira;
      return {
        hat_no: getHatNo(row),
        yon: pickNumber(row, ["YON"]),
        sira,
        enlem: pickNumber(row, ["ENLEM", "LAT", "Y"]),
        boylam: pickNumber(row, ["BOYLAM", "LON", "X"]),
        updated_at: nowIso,
      };
    });

    // Batch olarak yaz
    for (let i = 0; i < guzergahBatch.length; i += 1000) {
      const batch = guzergahBatch.slice(i, i + 1000);
      const { error } = await supabase
        .from("eshot_guzergah_noktalari")
        .upsert(batch, { onConflict: "hat_no,yon,sira" });
      if (error) console.warn(`  Güzergah noktaları yazılamadı: ${error.message}`);
    }

    // Hareket saatlerini yaz
    console.log("  Hareket saatleri yazılıyor...");
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
      const { error } = await supabase.from("eshot_hareket_saatleri").insert(batch);
      if (error) console.warn(`  Hareket saatleri yazılamadı: ${error.message}`);
    }

    // Metro istasyonlarını yaz
    console.log("  Metro istasyonları yazılıyor...");
    const metroBatch = metroIstasyonlar.map((row) => ({
      istasyon_id: pickNumber(row, ["ISTASYON_ID", "ID"]),
      istasyon_adi: pickText(row, ["ISTASYON_ADI", "ADI"]),
      sira: pickNumber(row, ["SIRA"]),
      enlem: pickNumber(row, ["ENLEM", "LAT", "Y"]),
      boylam: pickNumber(row, ["BOYLAM", "LON", "X"]),
      updated_at: nowIso,
    }));

    if (metroBatch.length > 0) {
      const { error } = await supabase
        .from("metro_istasyonlar")
        .upsert(metroBatch, { onConflict: "istasyon_id" });
      if (error) console.warn(`  Metro istasyonları yazılamadı: ${error.message}`);
    }

    // İzban istasyonlarını yaz
    console.log("  İzban istasyonları yazılıyor...");
    const izbanBatch = izbanIstasyonlar.map((row) => ({
      istasyon_id: pickNumber(row, ["ISTASYON_ID", "ID"]),
      istasyon_adi: pickText(row, ["ISTASYON_ADI", "ADI"]),
      enlem: pickNumber(row, ["ENLEM", "LAT", "Y"]),
      boylam: pickNumber(row, ["BOYLAM", "LON", "X"]),
      updated_at: nowIso,
    }));

    if (izbanBatch.length > 0) {
      const { error } = await supabase
        .from("izban_istasyonlar")
        .upsert(izbanBatch, { onConflict: "istasyon_id" });
      if (error) console.warn(`  İzban istasyonları yazılamadı: ${error.message}`);
    }

    // Tramvay hatlarını yaz
    console.log("  Tramvay hatları yazılıyor...");
    const tramvayBatch = tramvayHatlar.map((row) => ({
      hat_id: pickNumber(row, ["HAT_ID", "ID", "SEFER_ID"]),
      hat_adi: pickText(row, ["HAT_ADI", "ADI", "SEFER_ADI"]),
      hat_kodu: pickText(row, ["HAT_KODU", "KOD"]),
      updated_at: nowIso,
    }));

    if (tramvayBatch.length > 0) {
      const { error } = await supabase
        .from("tramvay_hatlar")
        .upsert(tramvayBatch, { onConflict: "hat_id" });
      if (error) console.warn(`  Tramvay hatları yazılamadı: ${error.message}`);
    }

    // Backup run'ı başarılı olarak işaretle
    await supabase.from("backup_runs").update({
      finished_at: new Date().toISOString(),
      status: "success",
      notes: `hatlar=${hatlar.length}, duraklar=${duraklar.length}, guzergahlar=${guzergahlar.length}, saatler=${saatler.length}, metro=${metroIstasyonlar.length}, izban=${izbanIstasyonlar.length}, tramvay=${tramvayHatlar.length}`,
    }).eq("id", runId);

    return {
      runId,
      hatlar: hatlar.length,
      duraklar: duraklar.length,
      guzergahlar: guzergahlar.length,
      saatler: saatler.length,
      metroIstasyonlar: metroIstasyonlar.length,
      izbanIstasyonlar: izbanIstasyonlar.length,
      tramvayHatlar: tramvayHatlar.length,
    };
  } catch (error) {
    // Backup run'ı başarısız olarak işaretle
    await supabase.from("backup_runs").update({
      finished_at: new Date().toISOString(),
      status: "failed",
      notes: error instanceof Error ? error.message : "Bilinmeyen hata",
    }).eq("id", runId);
    throw error;
  }
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

export async function backupMetroIstasyonlar(api: MetroApi): Promise<{ total: number; records: IstasyonRecord[] }> {
  const records = await api.getIstasyonList();
  return { total: records.length, records };
}

export async function backupIzbanIstasyonlar(api: IzbanApi): Promise<{ total: number; records: IstasyonRecord[] }> {
  const records = await api.getIstasyonList();
  return { total: records.length, records };
}

export async function backupTramvayHatlar(api: TramvayApi): Promise<{ total: number; records: IstasyonRecord[] }> {
  const records = await api.getHatList();
  return { total: records.length, records };
}

export async function backupAll(dryRun = false): Promise<void> {
  const now = new Date();

  // API'leri oluştur
  const [eshotApi, metroApi, izbanApi, tramvayApi] = await Promise.all([
    createEshotApi(),
    createMetroApi(),
    createIzbanApi(),
    createTramvayApi(),
  ]);

  console.log("ESHOT hat bilgileri cekiliyor...");
  const hatlar = await backupHatlar(eshotApi);
  console.log(`  ✓ Hatlar: ${hatlar.records.length} kayit`);

  console.log("ESHOT durak bilgileri cekiliyor...");
  const duraklar = await backupDuraklar(eshotApi);
  console.log(`  ✓ Duraklar: ${duraklar.records.length} kayit`);

  console.log("ESHOT guzergahlar cekiliyor...");
  const guzergahlar = await backupHatGuzergahlari(eshotApi);
  console.log(`  ✓ Guzergahlar: ${guzergahlar.records.length} kayit`);

  console.log("ESHOT hareket saatleri cekiliyor...");
  const saatler = await backupHareketSaatleri(eshotApi);
  console.log(`  ✓ Hareket Saatleri: ${saatler.records.length} kayit`);

  console.log("Metro istasyonları cekiliyor...");
  const metroIstasyonlar = await backupMetroIstasyonlar(metroApi);
  console.log(`  ✓ Metro İstasyonları: ${metroIstasyonlar.records.length} kayit`);

  console.log("İzban istasyonları cekiliyor...");
  const izbanIstasyonlar = await backupIzbanIstasyonlar(izbanApi);
  console.log(`  ✓ İzban İstasyonları: ${izbanIstasyonlar.records.length} kayit`);

  console.log("Tramvay hatları cekiliyor...");
  const tramvayHatlar = await backupTramvayHatlar(tramvayApi);
  console.log(`  ✓ Tramvay Hatları: ${tramvayHatlar.records.length} kayit`);

  if (dryRun) return;

  console.log("Supabase veritabanına yazılıyor...");
  const result = await persistAllToSupabase(
    now,
    hatlar.records,
    duraklar.records,
    guzergahlar.records,
    saatler.records,
    metroIstasyonlar.records,
    izbanIstasyonlar.records,
    tramvayHatlar.records
  );
  console.log(`  ✓ run id  : ${result.runId}`);
  console.log(`  ✓ hatlar  : ${result.hatlar}`);
  console.log(`  ✓ duraklar: ${result.duraklar}`);
  console.log(`  ✓ metro   : ${result.metroIstasyonlar}`);
  console.log(`  ✓ izban   : ${result.izbanIstasyonlar}`);
  console.log(`  ✓ tramvay : ${result.tramvayHatlar}`);
}

export async function run(argv = process.argv): Promise<void> {
  const dryRun = argv.includes("--dry-run");

  // Supabase konfigürasyonunu kontrol et
  if (!dryRun && !isSupabaseConfigured()) {
    console.error("Hata: SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY environment variables tanımlanmalı");
    console.error("Örnek: SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=xxx npm run backup");
    process.exit(1);
  }

  if (dryRun) {
    console.log("[dry-run] Veri cekiliyor, DB'ye yazilmayacak...\n");
    await backupAll(true);
    console.log("\n[dry-run] Basarili!");
    return;
  }

  await backupAll();
  console.log("\n✓ Yedekleme tamamlandı!");
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  run().catch((error) => {
    console.error("Yedekleme hatası:", error);
    process.exit(1);
  });
}
