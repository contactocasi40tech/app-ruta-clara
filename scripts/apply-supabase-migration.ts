import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const databaseUrl = process.env.SUPABASE_DATABASE_URL;
if (!databaseUrl) throw new Error("SUPABASE_DATABASE_URL no está configurada");

const migrationPath = path.resolve(process.argv[2] ?? "supabase/migrations/20260910_ruta_clara_saas.sql");
const sql = await readFile(migrationPath, "utf8");
const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  await client.query(sql);
  const result = await client.query<{ table_name: string }>(
    "select table_name from information_schema.tables where table_schema = 'public' and table_name in ('users','sesiones_ruta','mediciones','planes','suscripciones','ruta_pilares_progreso') order by table_name",
  );
  console.log(`Migración ${path.basename(migrationPath)} aplicada. Tablas verificadas: ${result.rows.map((row) => row.table_name).join(", ")}`);
} finally {
  await client.end();
}
