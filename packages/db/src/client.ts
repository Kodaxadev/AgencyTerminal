import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../schema/drizzle-schema";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

// Parse connection pool size from env, default to 1 for serverless / dev
const maxConnections = parseInt(process.env.DB_MAX_CONNECTIONS ?? "1", 10);

const pool = postgres(DATABASE_URL, {
  max: maxConnections,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(pool, { schema });

export async function closeDbPool(): Promise<void> {
  await pool.end({ timeout: 5 });
}

export { pool };
