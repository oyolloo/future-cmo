import "server-only";

import { db, eq, pillars, sql, subPillars, topics } from "@kit/database";

export type PillarSummary = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  subPillarCount: number;
  topicCount: number;
};

export async function loadPillars(): Promise<PillarSummary[]> {
  const rows = await db
    .select({
      id: pillars.id,
      slug: pillars.slug,
      name: pillars.name,
      description: pillars.description,
      subPillarCount: sql<number>`COUNT(DISTINCT ${subPillars.id})::int`,
      topicCount: sql<number>`COUNT(DISTINCT ${topics.id})::int`,
    })
    .from(pillars)
    .leftJoin(subPillars, eq(subPillars.pillarId, pillars.id))
    .leftJoin(topics, eq(topics.subPillarId, subPillars.id))
    .groupBy(pillars.id, pillars.position)
    .orderBy(pillars.position);

  return rows;
}
