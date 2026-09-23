import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Credenciales Supabase incompletas");

const email = process.argv[2];
if (!email?.startsWith("ruta-e2e-")) throw new Error("Indica el correo temporal E2E");
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: users, error: usersError } = await admin.auth.admin.listUsers({ page: 1, perPage: 100 });
if (usersError) throw usersError;
const user = users.users.find((item) => item.email === email);
if (!user) throw new Error("Usuario E2E no encontrado");

const [profile, sessions, measurements, plans] = await Promise.all([
  admin.from("users").select("id, nombre, email").eq("id", user.id),
  admin.from("sesiones_ruta").select("id, progreso, completada, motivo_consulta").eq("user_id", user.id),
  admin.from("mediciones").select("id, valor, unidad, origen_dato").eq("user_id", user.id),
  admin.from("planes").select("id, estado, accion_elegida").eq("user_id", user.id),
]);
for (const result of [profile, sessions, measurements, plans]) if (result.error) throw result.error;

console.log(JSON.stringify({
  profileRows: profile.data.length,
  sessions: sessions.data,
  measurements: measurements.data,
  plans: plans.data,
}, null, 2));
