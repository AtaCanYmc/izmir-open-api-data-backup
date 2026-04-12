import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  backupHatlar,
  backupDuraklar,
  backupHatGuzergahlari,
  backupHareketSaatleri,
  persistAllToSqlite,
  type EshotApi,
} from "../backup";
import Database from "better-sqlite3";

describe("backupHatlar", () => {
  it("hatlar endpoint'ini cagirir ve kayitlari dondurur", async () => {
    const mockApi: EshotApi = {
      async getHatlar() { return [{ HAT_NO: "1", HAT_ADI: "Test 1" }]; },
      getDuraklar: async () => [],
      getHatGuzergahlari: async () => [],
      getHareketSaatleri: async () => [],
    };

    const result = await backupHatlar(mockApi);
    expect(result.records.length).toBe(1);
  });

  it("kayitlari HAT_NO'ya gore siralar", async () => {
    const mockApi: EshotApi = {
      async getHatlar() { 
        return [
          { HAT_NO: "300", HAT_ADI: "Test 300" },
          { HAT_NO: "10", HAT_ADI: "Test 10" },
          { HAT_NO: "20", HAT_ADI: "Test 20" },
        ]; 
      },
      getDuraklar: async () => [],
      getHatGuzergahlari: async () => [],
      getHareketSaatleri: async () => [],
    };

    const result = await backupHatlar(mockApi);
    expect(result.total).toBe(3);
    expect(result.records.map((item) => String(item.HAT_NO))).toEqual(["10", "20", "300"]);
  });
});

describe("backupDuraklar", () => {
  it("duraklar endpoint'ini cagirir", async () => {
    const mockApi: EshotApi = {
      getHatlar: async () => [],
      async getDuraklar() { return [{ HAT_NO: "D1" }]; },
      getHatGuzergahlari: async () => [],
      getHareketSaatleri: async () => [],
    };

    const result = await backupDuraklar(mockApi);
    expect(result.records.length).toBe(1);
  });
});

describe("backupHatGuzergahlari", () => {
  it("guzergahlar endpoint'ini cagirir", async () => {
    const mockApi: EshotApi = {
      getHatlar: async () => [],
      getDuraklar: async () => [],
      async getHatGuzergahlari() { return [{ HAT_NO: "G1" }]; },
      getHareketSaatleri: async () => [],
    };

    const result = await backupHatGuzergahlari(mockApi);
    expect(result.records.length).toBe(1);
  });
});

describe("backupHareketSaatleri", () => {
  it("hareket saatleri endpoint'ini cagirir", async () => {
    const mockApi: EshotApi = {
      getHatlar: async () => [],
      getDuraklar: async () => [],
      getHatGuzergahlari: async () => [],
      async getHareketSaatleri() { return [{ HAT_NO: "H1" }]; },
    };

    const result = await backupHareketSaatleri(mockApi);
    expect(result.records.length).toBe(1);
  });
});

describe("persistAllToSqlite", () => {
  it("tek transaction ile tablolari doldurur ve backup_runs log yazar", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "eshot-sqlite-test-"));
    const dbFile = path.join(tempDir, "eshot.db");
    const now = new Date("2026-04-12T20:00:00.000Z");

    const result = await persistAllToSqlite(
      now,
      [{ HAT_NO: "10", HAT_ADI: "F.Altay - Konak", HAT_BASLANGIC: "F.Altay", HAT_BITIS: "Konak" }],
      [{ HAT_NO: "10", DURAK_ID: 1, DURAK_ADI: "Durak 1", ENLEM: 38.4, BOYLAM: 27.1, YON: 1, DURAKTAN_GECEN_HATLAR: "10, 20" }],
      [{ HAT_NO: "10", YON: 1, SIRA: 1, ENLEM: 38.4, BOYLAM: 27.1 }],
      [{ HAT_NO: "10", YON: 1, SAAT: "06:00" }],
      dbFile
    );

    expect(result.runId).toBeGreaterThan(0);
    expect(result.hatlar).toBe(1);
    expect(result.duraklar).toBe(1);
    expect(result.guzergahlar).toBe(1);
    expect(result.saatler).toBe(1);

    const db = new Database(dbFile, { readonly: true });
    const hatCount = (db.prepare("SELECT COUNT(*) as total FROM hatlar").get() as { total: number }).total;
    const durakCount = (db.prepare("SELECT COUNT(*) as total FROM duraklar").get() as { total: number }).total;
    const duraktanGecenCount = (db.prepare("SELECT COUNT(*) as total FROM duraktan_gecen_hatlar").get() as { total: number }).total;
    const guzergahCount = (db.prepare("SELECT COUNT(*) as total FROM guzergah_noktalari").get() as { total: number }).total;
    const saatCount = (db.prepare("SELECT COUNT(*) as total FROM hareket_saatleri").get() as { total: number }).total;
    const lastRun = db.prepare("SELECT status FROM backup_runs ORDER BY id DESC LIMIT 1").get() as { status: string };

    expect(hatCount).toBe(1);
    expect(durakCount).toBe(1);
    expect(duraktanGecenCount).toBe(2);
    expect(guzergahCount).toBe(1);
    expect(saatCount).toBe(1);
    expect(lastRun.status).toBe("success");
    db.close();
  });
});

