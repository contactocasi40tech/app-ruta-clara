import { createClient } from "@supabase/supabase-js";
import { indexedDbStorage } from "./indexedDbStorage";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Ruta Clara no tiene configuradas las credenciales públicas de Supabase.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: "pkce",
    storage: indexedDbStorage,
    storageKey: "ruta-clara-auth-session",
  },
});
