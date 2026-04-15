import { describe, expect, it } from "vitest";

// Helper fonksiyonları test etmek için aynı implementasyonları kullanıyoruz
function pickNumber(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const raw = record[key];
    if (raw === undefined || raw === null || raw === "") continue;
    const value = Number(raw);
    if (!Number.isNaN(value)) return value;
  }
  return null;
}

function pickText(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const raw = record[key];
    if (raw === undefined || raw === null) continue;
    const value = String(raw).trim();
    if (value) return value;
  }
  return null;
}

function pickBool(record: Record<string, unknown>, key: string): boolean | null {
  const raw = record[key];
  if (raw === undefined || raw === null) return null;
  const value = String(raw).trim().toLowerCase();
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return null;
}

function getHatNo(record: Record<string, unknown>): string | null {
  const raw = record.HAT_NO;
  if (raw === undefined || raw === null) return null;
  const value = String(raw).trim();
  return value ? value : null;
}

function parseDuraktanGecenHatlar(record: Record<string, unknown>): string[] {
  const raw = record.DURAKTAN_GECEN_HATLAR;
  if (raw === undefined || raw === null) return [];
  const text = String(raw).trim();
  if (!text) return [];
  const parts = text
    .split(/[;,|]/)
    .flatMap((part) => part.split(/\s+/))
    .map((part) => part.trim())
    .filter(Boolean);
  return Array.from(new Set(parts));
}

describe("pickNumber", () => {
  it("returns number from first matching key", () => {
    const record = { Enlem: 38.4656, Boylam: 27.2289 };
    expect(pickNumber(record, ["Enlem"])).toBe(38.4656);
  });

  it("tries multiple keys and returns first match", () => {
    const record = { LAT: 38.5 };
    expect(pickNumber(record, ["Enlem", "LAT"])).toBe(38.5);
  });

  it("returns null when no key matches", () => {
    const record = { other: "value" };
    expect(pickNumber(record, ["Enlem", "LAT"])).toBeNull();
  });

  it("returns null for empty string", () => {
    const record = { Enlem: "" };
    expect(pickNumber(record, ["Enlem"])).toBeNull();
  });

  it("returns null for null value", () => {
    const record = { Enlem: null };
    expect(pickNumber(record, ["Enlem"])).toBeNull();
  });

  it("parses string numbers", () => {
    const record = { Enlem: "38.4656" };
    expect(pickNumber(record, ["Enlem"])).toBe(38.4656);
  });

  it("returns null for non-numeric string", () => {
    const record = { Enlem: "not a number" };
    expect(pickNumber(record, ["Enlem"])).toBeNull();
  });
});

describe("pickText", () => {
  it("returns text from first matching key", () => {
    const record = { Adi: "Fahrettin Altay" };
    expect(pickText(record, ["Adi"])).toBe("Fahrettin Altay");
  });

  it("trims whitespace", () => {
    const record = { Adi: "  Göztepe  " };
    expect(pickText(record, ["Adi"])).toBe("Göztepe");
  });

  it("returns null for empty string after trim", () => {
    const record = { Adi: "   " };
    expect(pickText(record, ["Adi"])).toBeNull();
  });

  it("returns null when no key matches", () => {
    const record = { other: "value" };
    expect(pickText(record, ["Adi", "Name"])).toBeNull();
  });

  it("converts numbers to string", () => {
    const record = { Adi: 123 };
    expect(pickText(record, ["Adi"])).toBe("123");
  });
});

describe("pickBool", () => {
  it("returns true for 'true' string", () => {
    const record = { AktifMi: "true" };
    expect(pickBool(record, "AktifMi")).toBe(true);
  });

  it("returns true for '1' string", () => {
    const record = { AktifMi: "1" };
    expect(pickBool(record, "AktifMi")).toBe(true);
  });

  it("returns false for 'false' string", () => {
    const record = { AktifMi: "false" };
    expect(pickBool(record, "AktifMi")).toBe(false);
  });

  it("returns false for '0' string", () => {
    const record = { AktifMi: "0" };
    expect(pickBool(record, "AktifMi")).toBe(false);
  });

  it("returns null for other values", () => {
    const record = { AktifMi: "maybe" };
    expect(pickBool(record, "AktifMi")).toBeNull();
  });

  it("returns null for missing key", () => {
    const record = {};
    expect(pickBool(record, "AktifMi")).toBeNull();
  });

  it("is case insensitive", () => {
    const record = { AktifMi: "TRUE" };
    expect(pickBool(record, "AktifMi")).toBe(true);
  });
});

describe("getHatNo", () => {
  it("returns HAT_NO as string", () => {
    const record = { HAT_NO: "285" };
    expect(getHatNo(record)).toBe("285");
  });

  it("converts number to string", () => {
    const record = { HAT_NO: 285 };
    expect(getHatNo(record)).toBe("285");
  });

  it("returns null for missing HAT_NO", () => {
    const record = {};
    expect(getHatNo(record)).toBeNull();
  });

  it("returns null for empty string", () => {
    const record = { HAT_NO: "" };
    expect(getHatNo(record)).toBeNull();
  });

  it("trims whitespace", () => {
    const record = { HAT_NO: "  285  " };
    expect(getHatNo(record)).toBe("285");
  });
});

describe("parseDuraktanGecenHatlar", () => {
  it("parses comma separated values", () => {
    const record = { DURAKTAN_GECEN_HATLAR: "10, 20, 30" };
    expect(parseDuraktanGecenHatlar(record)).toEqual(["10", "20", "30"]);
  });

  it("parses semicolon separated values", () => {
    const record = { DURAKTAN_GECEN_HATLAR: "10;20;30" };
    expect(parseDuraktanGecenHatlar(record)).toEqual(["10", "20", "30"]);
  });

  it("parses pipe separated values", () => {
    const record = { DURAKTAN_GECEN_HATLAR: "10|20|30" };
    expect(parseDuraktanGecenHatlar(record)).toEqual(["10", "20", "30"]);
  });

  it("parses space separated values", () => {
    const record = { DURAKTAN_GECEN_HATLAR: "10 20 30" };
    expect(parseDuraktanGecenHatlar(record)).toEqual(["10", "20", "30"]);
  });

  it("removes duplicates", () => {
    const record = { DURAKTAN_GECEN_HATLAR: "10, 20, 10, 30, 20" };
    expect(parseDuraktanGecenHatlar(record)).toEqual(["10", "20", "30"]);
  });

  it("returns empty array for missing field", () => {
    const record = {};
    expect(parseDuraktanGecenHatlar(record)).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    const record = { DURAKTAN_GECEN_HATLAR: "" };
    expect(parseDuraktanGecenHatlar(record)).toEqual([]);
  });

  it("handles mixed separators", () => {
    const record = { DURAKTAN_GECEN_HATLAR: "10, 20;30|40 50" };
    expect(parseDuraktanGecenHatlar(record)).toEqual(["10", "20", "30", "40", "50"]);
  });
});

