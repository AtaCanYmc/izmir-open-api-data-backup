import { describe, expect, it } from "vitest";
import { createPayload, fetchAllHatlar, backupHatlar, backupDuraklar, backupHatGuzergahlari, backupHareketSaatleri, type EshotApi } from "../backup";

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


