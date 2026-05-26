import type { MetricCategory, MetricConfig } from "@agency-terminal/core";
import { and, desc, eq } from "drizzle-orm";
import { metricConfig } from "../schema/drizzle-schema";
import { db } from "./client";

export async function getLatestMetricConfig(
  guildId: string,
  category: string,
): Promise<MetricConfig | null> {
  const rows = await db.select({
    category: metricConfig.category,
    basePoints: metricConfig.basePoints,
    visibility: metricConfig.visibility,
    enabled: metricConfig.enabled,
    version: metricConfig.version,
  })
    .from(metricConfig)
    .where(and(
      eq(metricConfig.guildId, guildId),
      eq(metricConfig.category, category as typeof metricConfig.$inferSelect.category),
    ))
    .orderBy(desc(metricConfig.version))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    category: row.category as MetricCategory,
    basePoints: row.basePoints,
    visibility: row.visibility,
    enabled: row.enabled,
    version: row.version,
  };
}
