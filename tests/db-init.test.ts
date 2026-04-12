import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { createTables } from "../db/init";

describe("createTables", () => {
  it("eshot tablolarini olusturur", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "eshot-db-test-"));
    const dbFile = path.join(tempDir, "eshot.db");

    createTables(dbFile);

    const db = new Database(dbFile, { readonly: true });
    const tableRows = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all() as Array<{ name: string }>;

    const names = tableRows.map((row) => row.name);
    expect(names).toContain("backup_runs");
    expect(names).toContain("hatlar");
    expect(names).toContain("duraklar");
    expect(names).toContain("guzergah_noktalari");
    expect(names).toContain("hareket_saatleri");

    db.close();
  });
});

