import { describe, expect, it } from "vitest";
import {
  backupHatlar,
  backupDuraklar,
  backupHatGuzergahlari,
  backupHareketSaatleri,
  backupMetroIstasyonlar,
  backupIzbanIstasyonlar,
  type EshotApi,
  type MetroApi,
  type IzbanApi,
} from "../backup";

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

describe("backupMetroIstasyonlar", () => {
  it("metro istasyonlari endpoint'ini cagirir", async () => {
    const mockApi: MetroApi = {
      async getIstasyonList() { 
        return [
          { ISTASYON_ID: 1, ISTASYON_ADI: "Fahrettin Altay" },
          { ISTASYON_ID: 2, ISTASYON_ADI: "Göztepe" },
        ]; 
      },
    };

    const result = await backupMetroIstasyonlar(mockApi);
    expect(result.records.length).toBe(2);
  });
});

describe("backupIzbanIstasyonlar", () => {
  it("izban istasyonlari endpoint'ini cagirir", async () => {
    const mockApi: IzbanApi = {
      async getIstasyonList() { 
        return [
          { ISTASYON_ID: 1, ISTASYON_ADI: "Alsancak" },
          { ISTASYON_ID: 2, ISTASYON_ADI: "Basmane" },
        ]; 
      },
    };

    const result = await backupIzbanIstasyonlar(mockApi);
    expect(result.records.length).toBe(2);
  });
});

// Not: persistAllToSupabase testleri Supabase mock gerektirdiğinden
// gerçek entegrasyon testleri CI/CD workflow'unda yapılmalıdır.
