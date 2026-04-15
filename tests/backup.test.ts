import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock Supabase client
const mockSupabaseClient = {
  from: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  upsert: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  neq: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data: { id: 1 }, error: null }),
};

vi.mock("../db/supabase", () => ({
  getSupabaseClient: () => mockSupabaseClient,
  isSupabaseConfigured: () => true,
}));

// Mock izmir-open-data-js
vi.mock("izmir-open-data-js/dist/client.js", () => ({
  IzmirClient: vi.fn().mockImplementation(() => ({})),
}));

vi.mock("izmir-open-data-js/dist/endpoints/metro.js", () => ({
  metro: vi.fn().mockImplementation(() => ({
    getIstasyonList: vi.fn().mockResolvedValue([
      { IstasyonId: 1, Adi: "Fahrettin Altay", Sira: 1, Enlem: 38.4, Boylam: 27.1 },
      { IstasyonId: 2, Adi: "Göztepe", Sira: 2, Enlem: 38.5, Boylam: 27.2 },
    ]),
  })),
}));

vi.mock("izmir-open-data-js/dist/endpoints/izban.js", () => ({
  izban: vi.fn().mockImplementation(() => ({
    getIstasyonList: vi.fn().mockResolvedValue([
      { IstasyonId: 1, IstasyonAdi: "Aliağa", Enlem: "38.7889", Boylam: "26.9669" },
      { IstasyonId: 2, IstasyonAdi: "Alsancak", Enlem: "38.4356", Boylam: "27.1428" },
    ]),
  })),
}));

vi.mock("izmir-open-data-js/dist/endpoints/tramvay.js", () => ({
  tramvay: vi.fn().mockImplementation(() => ({
    getHatList: vi.fn().mockResolvedValue([
      { HatId: 1, Adi: "Fahrettin Altay - Halkapınar", Aciklama: "Kara Tarafı" },
      { HatId: 2, Adi: "Karşıyaka - Mavişehir", Aciklama: "Karşıyaka" },
    ]),
  })),
}));

vi.mock("izmir-open-data-js/dist/endpoints/eshot.js", () => ({
  eshot: vi.fn().mockImplementation(() => ({
    getHatlar: vi.fn().mockResolvedValue([
      { HAT_NO: "285", HAT_ADI: "Bornova - Konak" },
      { HAT_NO: "10", HAT_ADI: "Alsancak - Karşıyaka" },
    ]),
    getDuraklar: vi.fn().mockResolvedValue([
      { HAT_NO: "285", DURAK_ID: 1, DURAK_ADI: "Bornova Merkez", ENLEM: 38.4, BOYLAM: 27.2 },
    ]),
    getHatGuzergahlari: vi.fn().mockResolvedValue([
      { HAT_NO: "285", YON: 1, SIRA: 1, ENLEM: 38.4, BOYLAM: 27.2 },
    ]),
    getHareketSaatleri: vi.fn().mockResolvedValue([
      { HAT_NO: "285", GIDIS_SAATI: "06:00", DONUS_SAATI: "06:30" },
    ]),
  })),
}));

describe("Metro Backup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseClient.single.mockResolvedValue({ data: { id: 1 }, error: null });
    mockSupabaseClient.upsert.mockResolvedValue({ error: null });
    mockSupabaseClient.delete.mockReturnThis();
    mockSupabaseClient.neq.mockResolvedValue({ error: null });
    mockSupabaseClient.update.mockReturnThis();
    mockSupabaseClient.eq.mockResolvedValue({ error: null });
  });

  it("fetches metro stations from API", async () => {
    const { metro } = await import("izmir-open-data-js/dist/endpoints/metro.js");
    const { IzmirClient } = await import("izmir-open-data-js/dist/client.js");
    
    const client = new IzmirClient();
    const api = metro(client);
    const stations = await api.getIstasyonList();
    
    expect(stations).toHaveLength(2);
    expect(stations[0].Adi).toBe("Fahrettin Altay");
  });
});

describe("Izban Backup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches izban stations from API", async () => {
    const { izban } = await import("izmir-open-data-js/dist/endpoints/izban.js");
    const { IzmirClient } = await import("izmir-open-data-js/dist/client.js");
    
    const client = new IzmirClient();
    const api = izban(client);
    const stations = await api.getIstasyonList();
    
    expect(stations).toHaveLength(2);
    expect(stations[0].IstasyonAdi).toBe("Aliağa");
  });
});

describe("Tramvay Backup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches tramvay lines from API", async () => {
    const { tramvay } = await import("izmir-open-data-js/dist/endpoints/tramvay.js");
    const { IzmirClient } = await import("izmir-open-data-js/dist/client.js");
    
    const client = new IzmirClient();
    const api = tramvay(client);
    const lines = await api.getHatList();
    
    expect(lines).toHaveLength(2);
    expect(lines[0].Adi).toBe("Fahrettin Altay - Halkapınar");
  });
});

describe("ESHOT Backup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches eshot hatlar from API", async () => {
    const { eshot } = await import("izmir-open-data-js/dist/endpoints/eshot.js");
    const { IzmirClient } = await import("izmir-open-data-js/dist/client.js");
    
    const client = new IzmirClient();
    const api = eshot(client);
    const hatlar = await api.getHatlar();
    
    expect(hatlar).toHaveLength(2);
    expect(hatlar[0].HAT_NO).toBe("285");
  });

  it("fetches eshot duraklar from API", async () => {
    const { eshot } = await import("izmir-open-data-js/dist/endpoints/eshot.js");
    const { IzmirClient } = await import("izmir-open-data-js/dist/client.js");
    
    const client = new IzmirClient();
    const api = eshot(client);
    const duraklar = await api.getDuraklar();
    
    expect(duraklar).toHaveLength(1);
    expect(duraklar[0].DURAK_ADI).toBe("Bornova Merkez");
  });

  it("fetches eshot guzergahlar from API", async () => {
    const { eshot } = await import("izmir-open-data-js/dist/endpoints/eshot.js");
    const { IzmirClient } = await import("izmir-open-data-js/dist/client.js");
    
    const client = new IzmirClient();
    const api = eshot(client);
    const guzergahlar = await api.getHatGuzergahlari();
    
    expect(guzergahlar).toHaveLength(1);
  });

  it("fetches eshot hareket saatleri from API", async () => {
    const { eshot } = await import("izmir-open-data-js/dist/endpoints/eshot.js");
    const { IzmirClient } = await import("izmir-open-data-js/dist/client.js");
    
    const client = new IzmirClient();
    const api = eshot(client);
    const saatler = await api.getHareketSaatleri();
    
    expect(saatler).toHaveLength(1);
    expect(saatler[0].GIDIS_SAATI).toBe("06:00");
  });
});

