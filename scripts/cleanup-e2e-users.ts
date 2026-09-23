import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Credenciales Supabase incompletas");

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
let page = 1;
let removed = 0;

while (true) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
  if (error) throw error;
  const matches = data.users.filter((user) => user.email?.startsWith("ruta-e2e-"));
  for (const user of matches) {
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;
    removed += 1;
  }
  if (data.users.length < 100) break;
  page += 1;
}

console.log(`Usuarios E2E eliminados: ${removed}`);
