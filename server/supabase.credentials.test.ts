import { describe, expect, it } from "vitest";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.SUPABASE_DATABASE_URL;

async function checkAuthHealth(apiKey: string) {
  const response = await fetch(`${supabaseUrl}/auth/v1/health`, {
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
    },
  });

  return {
    ok: response.ok,
    status: response.status,
    body: await response.text(),
  };
}

describe("Supabase credentials", () => {
  it("has a valid project URL and database connection string", () => {
    expect(supabaseUrl).toMatch(/^https:\/\/[a-z0-9-]+\.supabase\.co$/);
    expect(databaseUrl).toMatch(/^postgres(?:ql)?:\/\//);
  });

  it("accepts the anon key at the Auth health endpoint", async () => {
    expect(anonKey).toBeTruthy();
    const result = await checkAuthHealth(anonKey!);
    expect(result, result.body).toMatchObject({ ok: true, status: 200 });
  });

  it("accepts the service role key at the Auth health endpoint", async () => {
    expect(serviceRoleKey).toBeTruthy();
    const result = await checkAuthHealth(serviceRoleKey!);
    expect(result, result.body).toMatchObject({ ok: true, status: 200 });
  });
});
