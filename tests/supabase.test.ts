import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

describe("supabase", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("isSupabaseConfigured", () => {
    it("returns false when SUPABASE_URL is missing", async () => {
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      
      const { isSupabaseConfigured } = await import("../db/supabase");
      expect(isSupabaseConfigured()).toBe(false);
    });

    it("returns false when SUPABASE_SERVICE_ROLE_KEY is missing", async () => {
      process.env.SUPABASE_URL = "https://test.supabase.co";
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      
      const { isSupabaseConfigured } = await import("../db/supabase");
      expect(isSupabaseConfigured()).toBe(false);
    });

    it("returns true when both env vars are set", async () => {
      process.env.SUPABASE_URL = "https://test.supabase.co";
      process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
      
      const { isSupabaseConfigured } = await import("../db/supabase");
      expect(isSupabaseConfigured()).toBe(true);
    });
  });

  describe("getSupabaseClient", () => {
    it("throws when SUPABASE_URL is missing", async () => {
      delete process.env.SUPABASE_URL;
      process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
      
      const { getSupabaseClient } = await import("../db/supabase");
      expect(() => getSupabaseClient()).toThrow("SUPABASE_URL environment variable tanımlanmamış");
    });

    it("throws when SUPABASE_SERVICE_ROLE_KEY is missing", async () => {
      process.env.SUPABASE_URL = "https://test.supabase.co";
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      
      const { getSupabaseClient } = await import("../db/supabase");
      expect(() => getSupabaseClient()).toThrow("SUPABASE_SERVICE_ROLE_KEY environment variable tanımlanmamış");
    });

    it("returns a client when env vars are set", async () => {
      process.env.SUPABASE_URL = "https://test.supabase.co";
      process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
      
      const { getSupabaseClient } = await import("../db/supabase");
      const client = getSupabaseClient();
      expect(client).toBeDefined();
      expect(client.from).toBeDefined();
    });
  });
});

