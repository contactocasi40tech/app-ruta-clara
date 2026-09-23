import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Credenciales Supabase incompletas");

const stamp = Date.now();
const email = `ruta-e2e-${stamp}@example.com`;
const password = `RutaClara-${stamp}-A!`;
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data, error } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { nombre: "Cliente de prueba" },
});
if (error) throw error;
console.log(JSON.stringify({ id: data.user.id, email, password }));
