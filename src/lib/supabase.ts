import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** False until .env.local holds the Supabase URL and publishable key (see README). */
export const isConfigured = Boolean(url && key);

let client: SupabaseClient | null = null;

/**
 * Browser client. All data access goes through Row Level Security and the
 * SECURITY DEFINER functions in supabase/migrations: the publishable key is safe to ship.
 */
export function supabase(): SupabaseClient {
  if (!client) {
    client = createClient(url ?? "http://localhost:54321", key ?? "missing-key", {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return client;
}

/** Turns a Supabase/PostgREST error into a message that can be shown to a student. */
export function errorMessage(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? String(e);
  if (/Failed to fetch|NetworkError/i.test(msg)) return "Koneksi terputus. Periksa internetmu lalu coba lagi.";
  if (/Invalid login credentials/i.test(msg)) return "Email atau kata sandi salah.";
  if (/User already registered/i.test(msg)) return "Email ini sudah terdaftar. Silakan masuk.";
  if (/Email not confirmed/i.test(msg)) return "Email belum dikonfirmasi. Buka tautan konfirmasi di kotak masukmu.";
  if (/Password should be at least/i.test(msg)) return "Kata sandi minimal 8 karakter.";
  if (/profiles_username_key|duplicate key.*username/i.test(msg)) return "Nama pengguna sudah dipakai.";
  if (/rate limit|too many/i.test(msg)) return "Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.";
  return msg;
}
