import type { DB } from "./db.js";

export const HISTORY_RETENTION_MS = 24 * 60 * 60 * 1000;

/** Purge operational history, never the live queue or booking source of truth. */
export function pruneHistory(db: DB, now = Date.now()) {
  const cutoff = now - HISTORY_RETENTION_MS;
  return db.tx(async () => ({
    jobs: Number(
      (await db.run(
        "DELETE FROM jobs WHERE state IN ('done','failed') AND COALESCE(finished_at,locked_at,run_at)<?",
        cutoff,
      )).changes,
    ),
    syncRuns: Number(
      (await db.run(
        "DELETE FROM sync_runs WHERE status IN ('success','failed') AND COALESCE(finished_at,started_at)<?",
        cutoff,
      )).changes,
    ),
    audit: Number((await db.run("DELETE FROM audit WHERE at<?", cutoff)).changes),
  }));
}
