import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.VITE_SUPABASE_URL!;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

const stamp = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const password = `Ruta-${stamp}-A9!`;
const emailA = `ruta-a-${stamp}@example.com`;
const emailB = `ruta-b-${stamp}@example.com`;
let userAId = "";
let userBId = "";
let sessionId = "";

function userClient() {
  return createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

beforeAll(async () => {
  const a = await admin.auth.admin.createUser({ email: emailA, password, email_confirm: true, user_metadata: { nombre: "Prueba A" } });
  const b = await admin.auth.admin.createUser({ email: emailB, password, email_confirm: true, user_metadata: { nombre: "Prueba B" } });
  if (a.error || b.error) throw a.error || b.error;
  userAId = a.data.user.id;
  userBId = b.data.user.id;
});

afterAll(async () => {
  if (userAId) await admin.auth.admin.deleteUser(userAId);
  if (userBId) await admin.auth.admin.deleteUser(userBId);
});

describe("Ruta Clara Supabase", () => {
  it("inicia sesión y entrega un refresh token", async () => {
    const client = userClient();
    const { data, error } = await client.auth.signInWithPassword({ email: emailA, password });
    expect(error).toBeNull();
    expect(data.session?.user.id).toBe(userAId);
    expect(data.session?.refresh_token).toBeTruthy();
  });

  it("crea sesión, medición y plan para el usuario autenticado", async () => {
    const client = userClient();
    await client.auth.signInWithPassword({ email: emailA, password });
    const session = await client.from("sesiones_ruta").insert({
      user_id: userAId,
      motivo_consulta: "Prueba de persistencia",
      contexto_medicion_json: { value: "110", unit: "mg/dL", timing: "No lo sé", source: "Laboratorio", date: "2026-09-10", reviewed: "No" },
      resumen_privado_json: { situation: "measurement", barrier: "miedo", consult: { reason: "Prueba de persistencia" }, habit: "bebida", days: ["L"], country: "colombia", progress: { route: true } },
      plan_accion: "bebida",
      progreso: 17,
      completada: false,
    }).select("id, progreso").single();
    expect(session.error).toBeNull();
    sessionId = session.data!.id;

    const measurement = await client.from("mediciones").insert({ user_id: userAId, sesion_id: sessionId, valor: 110, unidad: "mg/dL", origen_dato: "Laboratorio", fecha: "2026-09-10", notas: "No lo sé" });
    const plan = await client.from("planes").insert({ user_id: userAId, sesion_id: sessionId, fecha_inicio: "2026-09-10", accion_elegida: "bebida", estado: "activo" });
    expect(measurement.error).toBeNull();
    expect(plan.error).toBeNull();
  });

  it("impide que otro usuario lea o modifique la sesión por RLS", async () => {
    const client = userClient();
    await client.auth.signInWithPassword({ email: emailB, password });
    const read = await client.from("sesiones_ruta").select("id").eq("id", sessionId);
    const update = await client.from("sesiones_ruta").update({ progreso: 100 }).eq("id", sessionId).select("id");
    expect(read.error).toBeNull();
    expect(read.data).toEqual([]);
    expect(update.error).toBeNull();
    expect(update.data).toEqual([]);
  });

  it("permite reanudar y actualizar el avance propio", async () => {
    const client = userClient();
    await client.auth.signInWithPassword({ email: emailA, password });
    const update = await client.from("sesiones_ruta").update({ progreso: 67 }).eq("id", sessionId).select("progreso").single();
    expect(update.error).toBeNull();
    expect(update.data?.progreso).toBe(67);
  });

  it("borra la cuenta autenticada y todos sus datos relacionados", async () => {
    const client = userClient();
    await client.auth.signInWithPassword({ email: emailA, password });
    const deletion = await client.rpc("delete_my_account");
    expect(deletion.error).toBeNull();
    const lookup = await admin.auth.admin.getUserById(userAId);
    expect(lookup.error).toBeTruthy();
    userAId = "";
  });
});
