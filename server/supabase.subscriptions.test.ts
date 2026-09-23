import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const databaseUrl = process.env.SUPABASE_DATABASE_URL;
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const describeIfConfigured = databaseUrl ? describe : describe.skip;

describeIfConfigured("Supabase subscription schema", () => {
  const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });

  beforeAll(async () => {
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
  });

  it("adds the fail-closed subscription status to public.users", async () => {
    const result = await client.query<{ column_name: string; column_default: string | null }>(`
      select column_name, column_default
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'users'
        and column_name in ('estado_suscripcion', 'estado_suscripcion_actualizado_at')
      order by column_name
    `);

    expect(result.rows.map((row) => row.column_name)).toEqual([
      "estado_suscripcion",
      "estado_suscripcion_actualizado_at",
    ]);
    expect(result.rows.find((row) => row.column_name === "estado_suscripcion")?.column_default).toContain("bloqueado");
  });

  it("creates the subscription source-of-truth table with RLS", async () => {
    const columns = await client.query<{ column_name: string }>(`
      select column_name
      from information_schema.columns
      where table_schema = 'public' and table_name = 'suscripciones'
    `);
    const names = columns.rows.map((row) => row.column_name);

    expect(names).toEqual(expect.arrayContaining([
      "id",
      "user_id",
      "proveedor",
      "referencia_externa",
      "email_comprador",
      "estado",
      "vigente_hasta",
      "ultimo_evento_id",
      "metadata_json",
    ]));

    const rls = await client.query<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>(`
      select relrowsecurity, relforcerowsecurity
      from pg_class
      where oid = 'public.suscripciones'::regclass
    `);
    expect(rls.rows[0]).toEqual({ relrowsecurity: true, relforcerowsecurity: true });
  });

  it("prevents authenticated clients from self-activating", async () => {
    const privileges = await client.query<{ can_update_status: boolean; can_update_name: boolean; can_read_own_subscription: boolean }>(`
      select
        has_column_privilege('authenticated', 'public.users', 'estado_suscripcion', 'UPDATE') as can_update_status,
        has_column_privilege('authenticated', 'public.users', 'nombre', 'UPDATE') as can_update_name,
        has_table_privilege('authenticated', 'public.suscripciones', 'SELECT') as can_read_own_subscription
    `);

    expect(privileges.rows[0]).toEqual({
      can_update_status: false,
      can_update_name: true,
      can_read_own_subscription: true,
    });
  });

  it("installs the automatic user-status synchronization trigger", async () => {
    const result = await client.query<{ trigger_name: string }>(`
      select trigger_name
      from information_schema.triggers
      where event_object_schema = 'public'
        and event_object_table = 'suscripciones'
        and trigger_name = 'suscripciones_sync_user_status'
      limit 1
    `);

    expect(result.rows).toHaveLength(1);
  });

  it("activates access from a backend subscription and rejects client self-activation", async () => {
    if (!supabaseUrl || !anonKey || !serviceRoleKey) throw new Error("Faltan credenciales Supabase");

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const stamp = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const email = `subscription-${stamp}@example.com`;
    const password = `Ruta-${stamp}-A9!`;
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre: "Prueba suscripción" },
    });
    if (created.error) throw created.error;
    const userId = created.data.user.id;

    try {
      const initial = await admin.from("users").select("estado_suscripcion").eq("id", userId).single();
      expect(initial.error).toBeNull();
      expect(initial.data?.estado_suscripcion).toBe("bloqueado");

      const subscription = await admin.from("suscripciones").insert({
        user_id: userId,
        proveedor: "hotmart",
        referencia_externa: `test-${stamp}`,
        email_comprador: email,
        estado: "activo",
      });
      expect(subscription.error).toBeNull();

      const activated = await admin.from("users").select("estado_suscripcion").eq("id", userId).single();
      expect(activated.error).toBeNull();
      expect(activated.data?.estado_suscripcion).toBe("activo");

      const login = await userClient.auth.signInWithPassword({ email, password });
      expect(login.error).toBeNull();
      const selfUpdate = await userClient
        .from("users")
        .update({ estado_suscripcion: "bloqueado" })
        .eq("id", userId);
      expect(selfUpdate.error).toBeTruthy();
    } finally {
      await admin.auth.admin.deleteUser(userId);
    }
  }, 15_000);
});
