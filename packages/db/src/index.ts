// @agency-terminal/db
// Drizzle ORM client backed by PostgreSQL via postgres-js.
// DATABASE_URL must be set in the environment before importing.

export { db, pool } from "./client";
export * from "../schema/drizzle-schema";
