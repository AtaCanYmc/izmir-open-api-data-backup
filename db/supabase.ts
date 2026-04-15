import {createClient, SupabaseClient} from "@supabase/supabase-js";

let supabaseClient: SupabaseClient | null = null;

/**
 * Supabase client'ı döndürür.
 * Service Role Key kullanır (yazma yetkisi için).
 * Environment variables tanımlanmamışsa hata fırlatır.
 */
export function getSupabaseClient(): SupabaseClient {
    if (supabaseClient) return supabaseClient;

    // Environment variables'ı fonksiyon çağrıldığında oku (dotenv yüklendikten sonra)
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url) {
        throw new Error("SUPABASE_URL environment variable tanımlanmamış");
    }
    if (!key) {
        throw new Error("SUPABASE_SERVICE_ROLE_KEY environment variable tanımlanmamış");
    }

    supabaseClient = createClient(url, key, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });

    return supabaseClient;
}

/**
 * Supabase'in kullanılabilir olup olmadığını kontrol eder
 */
export function isSupabaseConfigured(): boolean {
    return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Supabase bağlantısını test eder
 */
export async function testSupabaseConnection(): Promise<boolean> {
    try {
        const client = getSupabaseClient();
        const {error} = await client.from("backup_runs").select("id").limit(1);
        if (error) {
            console.error("Supabase bağlantı hatası:", error.message);
            return false;
        }
        return true;
    } catch (err) {
        console.error("Supabase bağlantı hatası:", err);
        return false;
    }
}

