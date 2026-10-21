import { DB } from "./db.js";
import type { OfficialAdapter } from "./adapters/adapter.js";
export function operationalStatus(db: DB, adapter: OfficialAdapter) {
  const now = Date.now();
  const last = db.get<{ finished_at: number | null; status: string }>(
    "SELECT finished_at,status FROM sync_runs WHERE provider=? ORDER BY started_at DESC LIMIT 1",
    adapter.mode,
  );
  const lastSuccess = db.get<{ finished_at: number }>(
    "SELECT finished_at FROM sync_runs WHERE provider=? AND status='success' ORDER BY finished_at DESC LIMIT 1",
    adapter.mode,
  );
  const queue = db.get<{ pending: number; oldest: number | null }>(
    "SELECT COUNT(*) AS pending,MIN(run_at) AS oldest FROM jobs WHERE state='pending' AND (booking_id IS NULL OR booking_id IN (SELECT id FROM bookings WHERE provider=?))",
    adapter.mode,
  )!;
  const manual = db.get<{ n: number }>(
    "SELECT COUNT(*) AS n FROM bookings WHERE provider=? AND status IN ('manual_review','uncertain','cancel_uncertain')",
    adapter.mode,
  )!.n;
  const syncStale =
    !lastSuccess ||
    now - lastSuccess.finished_at >
      Math.max(180000, (adapter.syncIntervalMs ?? 60000) * 2);
  const connector = adapter.diagnostics?.().connector as
    { authentication?: string } | undefined;
  const authRequired = connector?.authentication === "auth_required";
  return {
    ready:
      !syncStale &&
      (last?.status === "success" || last?.status === "running") &&
      !authRequired &&
      connector?.authentication !== "degraded" &&
      adapter.mode !== "official-disabled",
    syncStale,
    lastSyncStatus: last?.status ?? "none",
    lastSuccessAt: lastSuccess?.finished_at ?? null,
    queuePending: queue.pending,
    queueOldestAt: queue.oldest,
    manualReview: manual,
    authRequired,
    paused: db.setting("paused") === "true",
    syncEnabled: db.setting("sync_enabled") === "true",
    bookingEnabled: db.setting("booking_enabled") === "true",
  };
}
export function monitor(db: DB, adapter: OfficialAdapter) {
  const status = operationalStatus(db, adapter);
  if (status.syncStale && status.syncEnabled) db.alert("SYNC_STALE");
  if (status.authRequired) {
    db.set("paused", "true");
    db.alert("AUTH_EXPIRED");
  }
  if (status.queueOldestAt && Date.now() - status.queueOldestAt > 10 * 60000)
    db.alert("QUEUE_BACKLOG");
  if (status.manualReview) db.alert("MANUAL_REVIEW");
  return status;
}
