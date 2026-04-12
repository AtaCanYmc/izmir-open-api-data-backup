import { describe, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  createPayload,
  fetchAllHatlar,
  backupHatlar,
  backupDuraklar,
  backupHatGuzergahlari,
  backupHareketSaatleri,
  persistAllToSqlite,
  writeHatBasedFiles,
  type EshotApi,
} from "../backup";
import Database from "better-sqlite3";

describe("fetchAllHatlar", () => {
  it("tum sayfalari toplar ve HAT_NO'ya gore siralar", async () => {
    const api: EshotApi = {
      async getHatlar(limit = 100, offset = 0) {
        if (limit !== 200) {
          throw new Error("Unexpected limit");
        }

        if (offset === 0) {
          return {
            total: 201,
            records: [
              { HAT_NO: "300", HAT_ADI: "Test 300" },
              { HAT_NO: "10", HAT_ADI: "Test 10" },
            ],
          };
        }

        if (offset === 200) {
          return {
            total: 201,
            records: [{ HAT_NO: "20", HAT_ADI: "Test 20" }],
          };
        }

        return { total: 201, records: [] };
      },
      getDuraklar: async () => ({ records: [] }),
      getHatGuzergahlari: async () => ({ records: [] }),
      getHareketSaatleri: async () => ({ records: [] }),
    };

    const result = await fetchAllHatlar(api);

    expect(result.total).toBe(201);
    expect(result.records.map((item) => String(item.HAT_NO))).toEqual(["10", "20", "300"]);
  });

  it("total yoksa ilk sayfa uzunlugunu total kabul eder", async () => {
    const api: EshotApi = {
      async getHatlar() {
        return {
          records: [{ HAT_NO: "5" }, { HAT_NO: "1" }],
        };
      },
      getDuraklar: async () => ({ records: [] }),
      getHatGuzergahlari: async () => ({ records: [] }),
      getHareketSaatleri: async () => ({ records: [] }),
    };

    const result = await fetchAllHatlar(api);

    expect(result.total).toBe(2);
    expect(result.records.map((item) => String(item.HAT_NO))).toEqual(["1", "5"]);
  });
});

describe("createPayload", () => {
  it("beklenen payload seklini uretir", () => {
    const now = new Date("2026-04-08T20:00:00.000Z");
    const payload = createPayload(2, [{ HAT_NO: "1" }, { HAT_NO: "2" }], now);

    expect(payload).toEqual({
      updatedAt: "2026-04-08T20:00:00.000Z",
      source: "izmir-open-data-js / ESHOT getHatlar",
      total: 2,
      hatlar: [{ HAT_NO: "1" }, { HAT_NO: "2" }],
    });
  });
});

describe("backupHatlar", () => {
  it("hatlar endpoint'ini cagirir ve dosya yazdigini simule eder", async () => {
    const mkdirSpy = vi.spyOn(fs, "mkdir").mockResolvedValue(undefined);
    const writeFileSpy = vi.spyOn(fs, "writeFile").mockResolvedValue(undefined);

    const mockApi: EshotApi = {
      async getHatlar() {
        return {
          total: 2,
          records: [{ HAT_NO: "1", HAT_ADI: "Test 1" }],
        };
      },
      getDuraklar: async () => ({ records: [] }),
      getHatGuzergahlari: async () => ({ records: [] }),
      getHareketSaatleri: async () => ({ records: [] }),
    };

    const now = new Date("2026-04-08T20:00:00.000Z");
    const result = await backupHatlar(mockApi, now);

    expect(result.total).toBe(2);
    expect(result.records.length).toBe(1);
    expect(mkdirSpy).toHaveBeenCalled();
    expect(writeFileSpy).toHaveBeenCalled();

    mkdirSpy.mockRestore();
    writeFileSpy.mockRestore();
  });
});

describe("backupDuraklar", () => {
  it("duraklar endpoint'ini cagirir", async () => {
    const mockApi: EshotApi = {
      getHatlar: async () => ({ records: [] }),
      async getDuraklar() {
        return {
          total: 100,
          records: [{ HAT_NO: "D1" }],
        };
      },
      getHatGuzergahlari: async () => ({ records: [] }),
      getHareketSaatleri: async () => ({ records: [] }),
    };

    const result = await backupDuraklar(mockApi);
    expect(result.total).toBe(100);
  });
});

describe("backupHatGuzergahlari", () => {
  it("guzergahlar endpoint'ini cagirir", async () => {
    const mockApi: EshotApi = {
      getHatlar: async () => ({ records: [] }),
      getDuraklar: async () => ({ records: [] }),
      async getHatGuzergahlari() {
        return {
          total: 500,
          records: [{ HAT_NO: "G1" }],
        };
      },
      getHareketSaatleri: async () => ({ records: [] }),
    };

    const result = await backupHatGuzergahlari(mockApi);
    expect(result.total).toBe(500);
  });
});

describe("backupHareketSaatleri", () => {
  it("hareket saatleri endpoint'ini cagirir", async () => {
    const mockApi: EshotApi = {
      getHatlar: async () => ({ records: [] }),
      getDuraklar: async () => ({ records: [] }),
      getHatGuzergahlari: async () => ({ records: [] }),
      async getHareketSaatleri() {
        return {
          total: 1000,
          records: [{ HAT_NO: "H1" }],
        };
      },
    };

    const result = await backupHareketSaatleri(mockApi);
    expect(result.total).toBe(1000);
  });
});

describe("writeHatBasedFiles", () => {
  it("her hat icin klasor ve durak/guzergah/saatler dosyalarini olusturur", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "eshot-backup-test-"));
    const now = new Date("2026-04-12T20:00:00.000Z");

    const index = await writeHatBasedFiles(
      tempDir,
      now,
      [{ HAT_NO: "10", HAT_ADI: "F.Altay - Konak" }],
      [{ HAT_NO: "10", DURAK_ID: 1, DURAK_ADI: "Durak 1" }],
      [{ HAT_NO: "10", YON: 1, ENLEM: 38.4, BOYLAM: 27.1 }],
      [{ HAT_NO: "10", SAAT: "06:00" }]
    );

    expect(index.total).toBe(1);
    expect(index.hatlar[0]?.hatNo).toBe("10");

    const base = path.join(tempDir, "eshot", "10");
    const duraklarRaw = await fs.readFile(path.join(base, "duraklar.json"), "utf8");
    const guzergahRaw = await fs.readFile(path.join(base, "guzergah.json"), "utf8");
    const saatlerRaw = await fs.readFile(path.join(base, "saatler.json"), "utf8");

    const duraklarPayload = JSON.parse(duraklarRaw) as { total: number; duraklar: Array<{ DURAK_ID?: number }> };
    const guzergahPayload = JSON.parse(guzergahRaw) as { total: number; guzergah: Array<{ YON?: number }> };
    const saatlerPayload = JSON.parse(saatlerRaw) as { total: number; saatler: Array<{ SAAT?: string }> };

    expect(duraklarPayload.total).toBe(1);
    expect(duraklarPayload.duraklar[0]?.DURAK_ID).toBe(1);
    expect(guzergahPayload.total).toBe(1);
    expect(guzergahPayload.guzergah[0]?.YON).toBe(1);
    expect(saatlerPayload.total).toBe(1);
    expect(saatlerPayload.saatler[0]?.SAAT).toBe("06:00");

    const indexRaw = await fs.readFile(path.join(tempDir, "eshot", "index.json"), "utf8");
    const parsedIndex = JSON.parse(indexRaw) as { total: number; hatlar: Array<{ hatNo: string }> };
    expect(parsedIndex.total).toBe(1);
    expect(parsedIndex.hatlar[0]?.hatNo).toBe("10");
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
    const duraktanGecenCount =
      (db.prepare("SELECT COUNT(*) as total FROM duraktan_gecen_hatlar").get() as { total: number }).total;
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


