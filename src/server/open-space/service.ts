import { randomUUID, createHash } from "node:crypto";
import { DB } from "./db.js";
import { Accounts } from "./accounts.js";
import {
  AdapterError,
  type OfficialAdapter,
  type OfficialRecord,
} from "./adapters/adapter.js";
import {
  addDays,
  overlaps,
  slotInstant,
  terminal,
  today,
  validDate,
  coversRange,
  type BookingApplicant,
  type Availability,
  type Booking,
  type BookingStatus,
  type Policy,
  type Slot,
  type Space,
  type Module,
} from "@shared/open-space/domain.js";

export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
export interface SpaceRow {
  id: string;
  module: Module;
  official_id: string;
  name: string;
  location: string;
  description: string;
  capacity: number;
  amenities: string;
  policy: string;
  published: number;
  bookable: number;
  upstream_enabled: number;
  provider: string;
  permission: "allowed" | "denied" | "unknown";
  source_metadata: string;
}
export interface BookingRow {
  id: string;
  user_id: string;
  space_id: string;
  date: string;
  start: number;
  end: number;
  quantity: number;
  purpose: string;
  status: BookingStatus;
  message: string;
  official_ref: string | null;
  cancel_requested: number;
  idempotency_key: string;
  fingerprint: string;
  provider: string;
  created_at: number;
  updated_at: number;
  applicant_name: string | null;
  student_id: string | null;
  submission_user_id: string | null;
}
interface SnapshotRow {
  slots: string;
  included_refs: string;
  observed_at: number;
}
interface Job {
  id: number;
  type: "create" | "cancel" | "reconcile" | "sync";
  booking_id: string | null;
  state: string;
  run_at: number;
  locked_at: number | null;
  attempts: number;
}
type Next = { type: Job["type"]; bookingId?: string; delay?: number };
const reserveStatuses =
  "'queued','submitting','accepted','pending_approval','confirmed','uncertain','manual_review','cancel_requested','cancelling','cancel_uncertain'";
export class BookingService {
  private syncInFlight?: Promise<void>;
  private availabilityInFlight = new Map<string, Promise<void>>();
  constructor(
    readonly db: DB,
    readonly adapter: OfficialAdapter,
    readonly horizon = 14,
    readonly staleMs = 180000,
    readonly publicBookingUserId?: string,
  ) {}
  get followsUpstream() {
    return this.adapter.mode === "official" && this.adapter.rulesSource === "upstream";
  }
  get bookingHorizon() {
    return this.followsUpstream ? null : this.horizon;
  }
  async space(id: string): Promise<SpaceRow> {
    const s = await this.db.get<SpaceRow>("SELECT * FROM spaces WHERE id=?", id);
    if (!s) throw new AppError(404, "NOT_FOUND", "空间不存在");
    return s;
  }
  publicSpace(s: SpaceRow, admin = false): Space {
    const grant = this.adapter.publication?.(s.id);
    if (!admin && s.provider === "official" && !grant)
      throw new AppError(404, "NOT_FOUND", "空间不存在");
    const publicValues =
      !admin && s.provider === "official" ? grant : undefined;
    return {
      id: s.id,
      module: s.module,
      name: publicValues?.name ?? s.name,
      location: publicValues?.location ?? s.location,
      description: publicValues?.description ?? s.description,
      capacity: publicValues?.syncFields?.includes("capacity")
        ? s.capacity
        : (publicValues?.capacity ?? s.capacity),
      amenities: publicValues?.syncFields?.includes("amenities")
        ? JSON.parse(s.amenities)
        : (publicValues?.amenities ?? JSON.parse(s.amenities)),
      policy: JSON.parse(s.policy),
      published: !!s.published,
      bookable: !!s.bookable,
      upstreamEnabled: !!s.upstream_enabled,
      permission: s.permission,
      ...(admin
        ? {
            sourceMetadata: JSON.parse(s.source_metadata),
            publicationAllowed: s.provider !== "official" || !!grant,
          }
        : {}),
    };
  }
  canPublish(s: SpaceRow) {
    return (
      s.provider === this.adapter.mode &&
      (s.provider !== "official" ||
        (!!this.adapter.publication?.(s.id) && s.permission === "allowed"))
    );
  }
  async spaces(admin = false): Promise<Space[]> {
    return (await this.db
      .all<SpaceRow>(
        `SELECT * FROM spaces WHERE provider=? ${admin ? "" : "AND published=1"} ORDER BY module DESC,name`,
        this.adapter.mode,
      ))
      .filter((s) => admin || this.canPublish(s))
      .map((s) => this.publicSpace(s, admin));
  }
  checkDate(date: string) {
    if (
      !validDate(date) ||
      date < today() ||
      (!this.followsUpstream && date > addDays(today(), this.horizon))
    )
      throw new AppError(
        400,
        "DATE_RANGE",
        this.followsUpstream ? "请选择有效且未过去的预约日期" : `请选择未来 ${this.horizon} 天内的日期`,
      );
  }
  /** Date queries outside the warm cache use the same live upstream in every environment. */
  private async refreshAvailability(spaceId: string, date: string) {
    this.checkDate(date);
    if (!this.followsUpstream || await this.db.setting("sync_enabled") !== "true") return;
    const key = `${spaceId}:${date}`;
    const pending = this.availabilityInFlight.get(key);
    if (pending) return pending;
    const operation = (async () => {
      const snapshot = await this.bounded(signal => this.adapter.availability(spaceId, date, { signal }));
      await this.db.run(
        "INSERT INTO snapshots VALUES(?,?,?,?,?) ON CONFLICT(space_id,date) DO UPDATE SET slots=excluded.slots,included_refs=excluded.included_refs,observed_at=excluded.observed_at WHERE excluded.observed_at>=snapshots.observed_at",
        spaceId, date, JSON.stringify(snapshot.slots), JSON.stringify(snapshot.includedRefs), snapshot.observedAt ?? Date.now(),
      );
    })().finally(() => this.availabilityInFlight.delete(key));
    this.availabilityInFlight.set(key, operation);
    return operation;
  }
  async availability(spaceId: string, date: string, admin = false, refresh = true): Promise<Availability> {
    this.checkDate(date);
    const space = await this.space(spaceId);
    if (!admin && (!space.published || !this.canPublish(space)))
      throw new AppError(404, "NOT_FOUND", "空间不存在");
    let row = await this.db.get<SnapshotRow>(
      "SELECT * FROM snapshots WHERE space_id=? AND date=?",
      spaceId,
      date,
    );
    if (refresh && this.followsUpstream && (!row || Date.now() - row.observed_at > this.staleMs)) {
      await this.refreshAvailability(spaceId, date);
      row = await this.db.get<SnapshotRow>("SELECT * FROM snapshots WHERE space_id=? AND date=?", spaceId, date);
    }
    const stale = !row || Date.now() - row.observed_at > this.staleMs;
    const refs = new Set<string>(row ? JSON.parse(row.included_refs) : []);
    const local = (await this.db
      .all<BookingRow>(
        `SELECT * FROM bookings WHERE space_id=? AND date=? AND status IN (${reserveStatuses})`,
        spaceId,
        date,
      ))
      .filter((b) => !b.official_ref || !refs.has(b.official_ref));
    const policy = JSON.parse(space.policy) as Policy;
    const fallback: Slot[] =
      space.provider === "official"
        ? []
        : Array.from({ length: 24 }, (_, i) =>
            policy.kind === "meeting"
              ? {
                  kind: "meeting",
                  start: 480 + i * 30,
                  end: 510 + i * 30,
                  state: "unknown",
                }
              : {
                  kind: "activity",
                  start: 480 + i * 30,
                  end: 510 + i * 30,
                  state: "unknown",
                  capacity: policy.capacity,
                  remaining: 0,
                },
          );
    const slots = (row ? (JSON.parse(row.slots) as Slot[]) : fallback).map(
      (slot): Slot => {
        if (stale || !space.upstream_enabled)
          return { ...slot, state: "unknown" };
        if (
          (space.provider !== "official" || slot.state === "available") &&
          (space.permission !== "allowed" ||
            (!space.bookable && space.provider !== "official") ||
            slotInstant(date, slot.start) <= Date.now())
        )
          return { ...slot, state: "unopened" };
        const held = local.filter((b) =>
          overlaps(slot.start, slot.end, b.start, b.end),
        );
        if (slot.kind === "meeting")
          return held.length ? { ...slot, state: "occupied" } : slot;
        const remaining = Math.max(
          0,
          slot.remaining - held.reduce((n, b) => n + b.quantity, 0),
        );
        return {
          ...slot,
          remaining,
          state:
            slot.state === "available" && remaining === 0
              ? "occupied"
              : slot.state,
        };
      },
    );
    return {
      spaceId,
      date,
      observedAt: row?.observed_at ?? null,
      stale,
      slots,
    };
  }
  async booking(id: string): Promise<BookingRow> {
    const b = await this.db.get<BookingRow>("SELECT * FROM bookings WHERE id=?", id);
    if (!b) throw new AppError(404, "NOT_FOUND", "预约不存在");
    return b;
  }
  async owned(id: string, userId: string) {
    const b = await this.booking(id);
    if (b.user_id !== userId)
      throw new AppError(404, "NOT_FOUND", "预约不存在");
    return b;
  }
  async project(
    b: BookingRow,
    events = false,
    admin = false,
    access = false,
  ): Promise<Booking> {
    const s = await this.space(b.space_id);
    const entry =
      access &&
      !admin &&
      b.provider === this.adapter.mode &&
      b.status === "confirmed" &&
      !b.cancel_requested &&
      slotInstant(b.date, b.end) > Date.now()
        ? await this.db.get<{ door_code: string; verified_at: number }>(
            "SELECT door_code,verified_at FROM booking_access WHERE booking_id=?",
            b.id,
          )
        : undefined;
    return {
      id: b.id,
      spaceId: b.space_id,
      spaceName:
        s.provider === "official"
          ? (this.adapter.publication?.(s.id)?.name ?? "已撤回公开的空间")
          : s.name,
      module: s.module,
      date: b.date,
      start: b.start,
      end: b.end,
      quantity: b.quantity,
      purpose: b.purpose,
      status: b.status,
      message: b.message,
      createdAt: b.created_at,
      updatedAt: b.updated_at,
      ...(b.applicant_name
        ? { applicantName: b.applicant_name, studentId: b.student_id! }
        : {}),
      ...(entry &&
      Date.now() - entry.verified_at <=
        Math.max(180000, (this.adapter.reconcileIntervalMs ?? 10000) * 2)
        ? { doorCode: entry.door_code }
        : {}),
      ...(events
        ? {
            events: await this.db.all(
              "SELECT id,status,message,at FROM booking_events WHERE booking_id=? ORDER BY id",
              b.id,
            ),
          }
        : {}),
      ...(admin
        ? {
            userName:
              b.applicant_name ??
              (await this.db.get<{ name: string }>(
                "SELECT name FROM users WHERE id=?",
                b.user_id,
              ))?.name,
          }
        : {}),
    };
  }
  async list(userId?: string) {
    const rows = await this.db
      .all<BookingRow>(
        `SELECT * FROM bookings ${userId ? "WHERE user_id=?" : ""} ORDER BY created_at DESC`,
        ...(userId ? [userId] : []),
      );
    return Promise.all(rows.map((b) => this.project(b, false, !userId)));
  }
  async enqueue(type: Job["type"], bookingId?: string, delay = 0) {
    await this.db.run(
      "INSERT OR IGNORE INTO jobs(type,booking_id,run_at) VALUES(?,?,?)",
      type,
      bookingId ?? null,
      Date.now() + delay,
    );
  }
  async setStatus(id: string, status: BookingStatus, message: string) {
    await this.db.tx(async () => {
      const b = await this.booking(id);
      if (status !== "confirmed")
        await this.db.run("DELETE FROM booking_access WHERE booking_id=?", id);
      if (b.status === status && b.message === message) return;
      await this.db.run(
        "UPDATE bookings SET status=?,message=?,updated_at=? WHERE id=?",
        status,
        message,
        Date.now(),
        id,
      );
      await this.db.run(
        "INSERT INTO booking_events(booking_id,status,message,at) VALUES(?,?,?,?)",
        id,
        status,
        message,
        Date.now(),
      );
      if (status === "failed") await this.db.alert("BOOKING_FAILED", id);
    });
  }
  async create(
    userId: string,
    input: {
      spaceId: string;
      date: string;
      start: number;
      end: number;
      quantity: number;
      purpose: string;
    },
    key: string,
    applicant?: BookingApplicant,
  ): Promise<Booking> {
    const fingerprint = createHash("sha256")
      .update(JSON.stringify(applicant ? { ...input, ...applicant } : input))
      .digest("hex");
    // Refresh remote data before taking the capacity/ownership transaction lock.
    if (this.followsUpstream && !await this.db.get("SELECT id FROM bookings WHERE user_id=? AND idempotency_key=?", userId, key)) {
      await this.availability(input.spaceId, input.date);
    }
    return this.db.tx(async () => {
      const account = applicant
        ? await new Accounts(this.db).user(userId)
        : undefined;
      if (applicant && (!account || account.bookingPermission === "blocked"))
        throw new AppError(
          403,
          "BOOKING_FORBIDDEN",
          "当前账号没有预约权限，请联系管理员",
        );
      const previous = await this.db.get<BookingRow>(
        "SELECT * FROM bookings WHERE user_id=? AND idempotency_key=?",
        userId,
        key,
      );
      if (previous) {
        if (previous.fingerprint !== fingerprint)
          throw new AppError(
            409,
            "IDEMPOTENCY_MISMATCH",
            "该申请标识已用于另一项预约，请重新提交",
          );
        return this.project(previous, true);
      }
      if (this.adapter.mode === "official-disabled")
        throw new AppError(503, "ADAPTER_DISABLED", "真实预约接入尚未开放");
      if (
        applicant &&
        userId.startsWith("guest-") &&
        this.adapter.mode === "official" &&
        !this.publicBookingUserId
      )
        throw new AppError(
          503,
          "PUBLIC_BOOKING_DISABLED",
          "免登录预约尚未配置完成，请联系管理员",
        );
      const quota = (await this.db.get<{ active: number; daily: number }>(
        `SELECT SUM(CASE WHEN status NOT IN ('failed','cancelled') AND date>=? THEN 1 ELSE 0 END) AS active, SUM(CASE WHEN created_at>? THEN 1 ELSE 0 END) AS daily FROM bookings WHERE ${applicant ? "student_id" : "user_id"}=?`,
        today(),
        Date.now() - 86400000,
        applicant?.studentId ?? userId,
      ))!;
      if (quota.active >= 10 || quota.daily >= 30)
        throw new AppError(
          429,
          "BOOKING_QUOTA",
          "已达到预约申请限额，请联系管理员",
        );
      const s = await this.space(input.spaceId),
        policy = JSON.parse(s.policy) as Policy;
      if (
        !s.published ||
        !this.canPublish(s) ||
        !s.bookable ||
        !s.upstream_enabled ||
        s.permission !== "allowed"
      )
        throw new AppError(409, "NOT_BOOKABLE", "该空间暂不接受预约");
      this.checkDate(input.date);
      const step = policy.stepMinutes;
      if (
        step <= 0 ||
        (!this.followsUpstream && (input.start % step || input.end % step)) ||
        input.end <= input.start ||
        slotInstant(input.date, input.start) <= Date.now()
      )
        throw new AppError(
          400,
          "TIME_RANGE",
          `请选择有效、连续且未开始的时段（按 ${step} 分钟选择）`,
        );
      if (policy.kind === "meeting" && input.quantity !== 1)
        throw new AppError(400, "QUANTITY", "会议室按整间预约");
      if (policy.kind === "activity" && input.quantity > policy.capacity)
        throw new AppError(400, "QUANTITY", "预约人数超过空间容量");
      const availability = await this.availability(s.id, input.date, false, false);
      if (availability.stale)
        throw new AppError(409, "STALE", "空间状态已过期，请等待同步后重试");
      const selected = availability.slots.filter((x) =>
        overlaps(input.start, input.end, x.start, x.end),
      );
      if (
        !coversRange(availability.slots, input.start, input.end) ||
        selected.some(
          (x) =>
            x.state !== "available" ||
            (x.kind === "activity" && x.remaining < input.quantity),
        )
      )
        throw new AppError(409, "CONFLICT", "所选时段已不可预约，请重新选择");
      const submissionUserId = applicant
        ? (this.publicBookingUserId ?? userId)
        : userId;
      this.adapter.checkCreate?.({
        requestId: "preflight",
        module: s.module,
        ...input,
        externalUserId: submissionUserId,
      });
      const approved =
        !applicant ||
        account?.role === "admin" ||
        account?.bookingPermission === "allowed";
      const status = approved ? "queued" : "pending_review";
      const message = approved
        ? "申请已收到，等待提交预约系统"
        : "申请已收到，等待管理员审核；审核前不占用时段";
      const id = randomUUID(),
        now = Date.now();
      await this.db.run(
        "INSERT INTO bookings(id,user_id,space_id,date,start,end,quantity,purpose,status,message,idempotency_key,fingerprint,created_at,updated_at,provider,applicant_name,student_id,submission_user_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        id,
        userId,
        s.id,
        input.date,
        input.start,
        input.end,
        input.quantity,
        input.purpose,
        status,
        message,
        key,
        fingerprint,
        now,
        now,
        this.adapter.mode,
        applicant?.applicantName ?? null,
        applicant?.studentId ?? null,
        submissionUserId,
      );
      await this.db.run(
        "INSERT INTO booking_events(booking_id,status,message,at) VALUES(?,?,?,?)",
        id,
        status,
        message,
        now,
      );
      if (approved) await this.enqueue("create", id);
      await this.db.audit(userId, "booking.create", id);
      return this.project(await this.booking(id), true);
    });
  }
  async review(id: string, actor: string, decision: "approve" | "reject") {
    if (this.followsUpstream && decision === "approve") {
      const booking = await this.booking(id);
      await this.availability(booking.space_id, booking.date);
    }
    return this.db.tx(async () => {
      const b = await this.booking(id);
      if (b.status !== "pending_review")
        throw new AppError(409, "REVIEW_STATE", "该申请已处理，请刷新状态");
      if (decision === "reject") {
        await this.setStatus(id, "failed", "管理员已驳回申请，未提交预约系统");
      } else {
        const s = await this.space(b.space_id);
        if (b.applicant_name) {
          const account = await new Accounts(this.db).user(b.user_id);
          if (!account || account.bookingPermission === "blocked")
            throw new AppError(
              403,
              "BOOKING_FORBIDDEN",
              "该申请账号已停用或被禁止预约，仅可驳回或取消",
            );
        }
        this.checkDate(b.date);
        if (
          !s.bookable ||
          !s.published ||
          !this.canPublish(s) ||
          !s.upstream_enabled ||
          s.permission !== "allowed" ||
          slotInstant(b.date, b.start) <= Date.now()
        )
          throw new AppError(
            409,
            "NOT_BOOKABLE",
            "空间或时间已不可预约，请驳回申请",
          );
        const a = await this.availability(s.id, b.date, false, false);
        if (
          a.stale ||
          !coversRange(a.slots, b.start, b.end) ||
          a.slots
            .filter((x) => overlaps(b.start, b.end, x.start, x.end))
            .some(
              (x) =>
                x.state !== "available" ||
                (x.kind === "activity" && x.remaining < b.quantity),
            )
        )
          throw new AppError(
            409,
            "CONFLICT",
            "时段状态已变化，请等待同步或驳回申请",
          );
        this.adapter.checkCreate?.({
          requestId: b.id,
          spaceId: b.space_id,
          module: s.module,
          date: b.date,
          start: b.start,
          end: b.end,
          quantity: b.quantity,
          purpose: b.purpose,
          externalUserId: b.submission_user_id ?? b.user_id,
        });
        await this.setStatus(id, "queued", "管理员审核通过，等待提交预约系统");
        await this.enqueue("create", id);
      }
      await this.db.audit(actor, "booking.review", id, { decision });
      return this.project(await this.booking(id), true, true);
    });
  }
  cancel(id: string, userId: string) {
    return this.db.tx(async () => {
      const b = await this.owned(id, userId);
      if (b.provider !== this.adapter.mode)
        throw new AppError(
          409,
          "PROVIDER_MISMATCH",
          "请切换到该预约原有的接入模式后操作",
        );
      if (terminal(b.status) || b.cancel_requested)
        return this.project(b, true);
      await this.db.run("UPDATE bookings SET cancel_requested=1 WHERE id=?", id);
      if (b.status === "queued" || b.status === "pending_review") {
        await this.db.run(
          "UPDATE jobs SET state='done',finished_at=? WHERE booking_id=? AND type='create' AND state='pending'",
          Date.now(),
          id,
        );
        await this.setStatus(id, "cancelled", "申请已撤回，未提交预约系统");
      } else {
        await this.setStatus(
          id,
          "cancel_requested",
          "已收到取消申请，正在核对预约结果",
        );
        await this.enqueue(b.official_ref ? "cancel" : "reconcile", id);
      }
      await this.db.audit(userId, "booking.cancel_requested", id);
      return this.project(await this.booking(id), true);
    });
  }
  sync(): Promise<void> {
    if (this.syncInFlight) return this.syncInFlight;
    this.syncInFlight = this.performSync().finally(() => {
      this.syncInFlight = undefined;
    });
    return this.syncInFlight;
  }
  private async performSync() {
    if (await this.db.setting("sync_enabled") !== "true")
      throw new AppError(409, "SYNC_PAUSED", "同步已暂停");
    this.adapter.beginSync?.();
    const id = randomUUID();
    const startedAt = Date.now(),
      firstDate = today();
    await this.db.set("last_sync_scheduled", String(startedAt));
    await this.db.run(
      "INSERT INTO sync_runs(id,status,started_at,provider) VALUES(?,?,?,?)",
      id,
      "running",
      startedAt,
      this.adapter.mode,
    );
    try {
      const catalog = await this.bounded((signal) =>
        this.adapter.listSpaces({ signal }),
      );
      const snapshots: Array<{
        spaceId: string;
        date: string;
        slots: Slot[];
        includedRefs: string[];
        observedAt?: number;
      }> = [];
      const publishIds = new Set(
        (await this.db
          .all<{ id: string }>(
            "SELECT id FROM spaces WHERE published=1 AND provider=?",
            this.adapter.mode,
          ))
          .map((x) => x.id),
      );
      const published = catalog.filter(
        (space) =>
          (this.followsUpstream || publishIds.has(space.id)) &&
          (this.adapter.mode !== "official" ||
            this.adapter.publication?.(space.id)),
      );
      // Date-first iteration reuses the official paginated HTML/JSON batch for all spaces.
      // This is prefetching only. Other upstream dates are loaded on demand.
      const warmDays = this.followsUpstream ? Math.min(this.horizon, 1) : this.horizon;
      for (let i = 0; i <= warmDays; i++) {
        for (const space of published) {
          const date = addDays(firstDate, i);
          const data = await this.bounded((signal) =>
            this.adapter.availability(space.id, date, { signal }),
          );
          snapshots.push({
            spaceId: space.id,
            date,
            ...data,
            observedAt: data.observedAt ?? Date.now(),
          });
        }
      }
      await this.db.tx(async () => {
        if (this.adapter.catalogComplete !== false)
          await this.db.run(
            "UPDATE spaces SET upstream_enabled=0 WHERE provider=?",
            this.adapter.mode,
          );
        for (const s of catalog) {
          const published = this.followsUpstream && s.permission === "allowed" && !!this.adapter.publication?.(s.id);
          const bookable = published && s.enabled && s.module === "meeting" && s.policy.rulesVerified === true && s.metadata?.reservationCost === 0;
          await this.db.run(
            "INSERT INTO spaces(id,module,official_id,name,location,description,capacity,amenities,policy,upstream_enabled,provider,permission,source_metadata,published,bookable) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET official_id=excluded.official_id,upstream_enabled=excluded.upstream_enabled,policy=excluded.policy,permission=excluded.permission,source_metadata=excluded.source_metadata,capacity=CASE WHEN excluded.provider='official' THEN excluded.capacity ELSE spaces.capacity END,amenities=CASE WHEN excluded.provider='official' THEN excluded.amenities ELSE spaces.amenities END,published=CASE WHEN ?=1 THEN excluded.published ELSE spaces.published END,bookable=CASE WHEN ?=1 THEN excluded.bookable ELSE spaces.bookable END",
            s.id,
            s.module,
            s.officialId,
            s.name,
            s.location,
            s.description,
            s.capacity,
            JSON.stringify(s.amenities),
            JSON.stringify(s.policy),
            Number(s.enabled),
            this.adapter.mode,
            s.permission ?? "allowed",
            JSON.stringify(s.metadata ?? {}),
            Number(published),
            Number(bookable),
            Number(this.followsUpstream),
            Number(this.followsUpstream),
          );
        }
        for (const s of snapshots)
          await this.db.run(
            "INSERT INTO snapshots VALUES(?,?,?,?,?) ON CONFLICT(space_id,date) DO UPDATE SET slots=excluded.slots,included_refs=excluded.included_refs,observed_at=excluded.observed_at WHERE excluded.observed_at>=snapshots.observed_at",
            s.spaceId,
            s.date,
            JSON.stringify(s.slots),
            JSON.stringify(s.includedRefs),
            s.observedAt ?? Date.now(),
          );
        await this.db.run(
          "UPDATE sync_runs SET status=?,finished_at=?,snapshot_count=? WHERE id=?",
          "success",
          Date.now(),
          snapshots.length,
          id,
        );
        await this.db.run("DELETE FROM snapshots WHERE date<?", today());
      });
    } catch (e) {
      const code = this.errorCode(e);
      await this.db.run(
        "UPDATE sync_runs SET status=?,finished_at=?,error_code=? WHERE id=?",
        "failed",
        Date.now(),
        code,
        id,
      );
      await this.db.audit("system", "sync.failed", id, { code });
      await this.db.alert(code === "AUTH_EXPIRED" ? "AUTH_EXPIRED" : "SYNC_FAILED");
      if (code === "AUTH_EXPIRED" || code === "FORBIDDEN")
        await this.db.set("paused", "true");
      throw e;
    }
  }
  private errorCode(e: unknown): string {
    return e instanceof AdapterError ? e.code : "INTERNAL_ADAPTER_ERROR";
  }
  private async bounded<T>(
    operation: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        operation(controller.signal),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new AdapterError("TIMEOUT"));
          }, this.adapter.operationTimeoutMs ?? 5000);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  async recoverExpired() {
    await this.db.tx(async () => {
      for (const j of await this.db.all<Job>(
        "SELECT * FROM jobs WHERE state='running' AND locked_at<?",
        Date.now() - 60000,
      )) {
        await this.db.run(
          "UPDATE jobs SET state='failed',error_code='WORKER_INTERRUPTED',finished_at=? WHERE id=?",
          Date.now(),
          j.id,
        );
        if (j.booking_id) {
          const b = await this.booking(j.booking_id);
          if (!terminal(b.status)) {
            await this.setStatus(
              b.id,
              j.type === "cancel" ? "cancel_uncertain" : "uncertain",
              "执行中断，正在核对；不会自动重复提交",
            );
            await this.enqueue("reconcile", b.id);
          }
        }
        await this.db.audit("system", "job.recovered", String(j.id), {
          type: j.type,
        });
      }
    });
  }
  async schedule() {
    await this.db.tx(async () => {
      const now = Date.now();
      for (const b of await this.db.all<BookingRow>(
        "SELECT * FROM bookings WHERE status='pending_review'",
      ))
        if (slotInstant(b.date, b.start) <= now)
          await this.setStatus(b.id, "failed", "审核前预约开始时间已过，申请已结束");
      if (
        await this.db.setting("sync_enabled") === "true" &&
        now - Number(await this.db.setting("last_sync_scheduled", "0")) >
          (this.adapter.syncIntervalMs ?? 60000)
      ) {
        await this.enqueue("sync");
        await this.db.set("last_sync_scheduled", String(now));
      }
      if (
        now - Number(await this.db.setting("last_reconcile_scheduled", "0")) >
        (this.adapter.reconcileIntervalMs ?? 10000)
      ) {
        for (const b of await this.db.all<{ id: string }>(
          "SELECT id FROM bookings WHERE date>=? AND status IN ('accepted','pending_approval','confirmed','uncertain','cancel_uncertain','cancel_requested') AND provider=?",
          today(),
          this.adapter.mode,
        ))
          await this.enqueue("reconcile", b.id);
        await this.db.set("last_reconcile_scheduled", String(now));
      }
    });
  }
  async runOne(): Promise<boolean> {
    await this.recoverExpired();
    const job = await this.db.tx(async () => {
      if (await this.db.get("SELECT id FROM jobs WHERE state='running'"))
        return undefined;
      const paused =
        await this.db.setting("paused") === "true" ||
        await this.db.setting("booking_enabled") !== "true";
      const j = await this.db.get<Job>(
        `SELECT * FROM jobs WHERE state='pending' AND run_at<=? AND (booking_id IS NULL OR booking_id IN (SELECT id FROM bookings WHERE provider=?)) ${await this.db.setting("sync_enabled") !== "true" ? "AND type<>'sync'" : ""} ${paused ? "AND type NOT IN ('create','cancel')" : ""} ORDER BY id LIMIT 1`,
        Date.now(),
        this.adapter.mode,
      );
      if (j)
        await this.db.run(
          "UPDATE jobs SET state='running',locked_at=?,attempts=attempts+1 WHERE id=?",
          Date.now(),
          j.id,
        );
      return j;
    });
    if (!job) return false;
    let next: Next | undefined,
      errorCode: string | null = null;
    const heartbeat = setInterval(
      () => void this.db.run(
          "UPDATE jobs SET locked_at=? WHERE id=? AND state='running'",
          Date.now(),
          job.id,
        ).catch(() => { /* Main execution records worker errors; heartbeat is best effort. */ }),
      5000,
    );
    try {
      next = await this.execute(job);
    } catch (e) {
      errorCode = this.errorCode(e);
      await this.db.tx(async () => {
        if (errorCode === "AUTH_EXPIRED" || errorCode === "FORBIDDEN") {
          await this.db.set("paused", "true");
          await this.db.audit("system", "automation.paused", "system", {
            code: errorCode,
          });
        }
        if (job.booking_id) {
          const b = await this.booking(job.booking_id);
          if (!terminal(b.status)) {
            if (
              job.type === "create" &&
              ["CONFLICT", "RULE_REJECTED"].includes(errorCode!)
            )
              await this.setStatus(
                b.id,
                "failed",
                errorCode === "CONFLICT"
                  ? "预约系统拒绝：时段冲突"
                  : "预约规则校验未通过，未发送最终保存请求",
              );
            else {
              await this.setStatus(
                b.id,
                job.type === "cancel"
                  ? "cancel_uncertain"
                  : job.type === "reconcile"
                    ? "manual_review"
                    : "uncertain",
                errorCode === "AUTH_EXPIRED"
                  ? "执行身份失效，自动操作已暂停"
                  : "结果尚不明确，正在核对；不会自动重复提交",
              );
              if (job.type !== "reconcile")
                next = { type: "reconcile", bookingId: b.id };
            }
          }
        }
        await this.db.audit("system", "job.failed", String(job.id), {
          code: errorCode,
          type: job.type,
        });
        await this.db.alert(
          errorCode === "AUTH_EXPIRED" ? "AUTH_EXPIRED" : "JOB_FAILED",
          job.booking_id ?? "system",
        );
      });
    } finally {
      clearInterval(heartbeat);
    }
    await this.db.tx(async () => {
      await this.db.run(
        "UPDATE jobs SET state=?,error_code=?,finished_at=? WHERE id=?",
        errorCode ? "failed" : "done",
        errorCode,
        Date.now(),
        job.id,
      );
      if (next) await this.enqueue(next.type, next.bookingId, next.delay);
    });
    return true;
  }
  private async execute(job: Job): Promise<Next | undefined> {
    if (job.type === "sync") {
      await this.sync();
      return;
    }
    const b = await this.booking(job.booking_id!);
    if (terminal(b.status) || b.status === "pending_review") return;
    if (b.provider !== this.adapter.mode) {
      await this.setStatus(
        b.id,
        "manual_review",
        "当前接入模式与预约来源不同，未执行官方操作",
      );
      return;
    }
    if (job.type === "create") {
      // Reserving a queue entry and changing its booking to submitting must agree with
      // queued cancellation. No official network request is made under this lock.
      const command = await this.db.tx(async () => {
        const b = await this.booking(job.booking_id!);
        if (b.status !== "queued") return; // Never resubmit an in-flight/uncertain attempt.
        if (
          b.applicant_name ||
          await this.db.setting("account_login_enabled") === "true"
        ) {
          const account = await new Accounts(this.db).user(b.user_id);
          if (!account || account.bookingPermission === "blocked") {
            await this.setStatus(b.id, "failed", "账号已停用或被禁止预约，申请未提交");
            return;
          }
          // Explicit approval applies to this booking; later permission changes
          // to 'review' return other queued requests to the review queue.
          if (
            account.role !== "admin" &&
            account.bookingPermission === "review" &&
            !await this.db.get(
              "SELECT id FROM audit WHERE action='booking.review' AND entity_id=? AND detail::jsonb->>'decision'='approve'",
              b.id,
            )
          ) {
            await this.setStatus(b.id, "pending_review", "预约权限已调整，等待管理员审核");
            return;
          }
        }
        const s = await this.space(b.space_id);
        if (
          !s.published ||
          !this.canPublish(s) ||
          !s.bookable ||
          !s.upstream_enabled ||
          s.permission !== "allowed"
        ) {
          await this.setStatus(b.id, "failed", "空间已暂停预约，申请未提交");
          return;
        }
        if (slotInstant(b.date, b.start) <= Date.now()) {
          await this.setStatus(b.id, "failed", "预约开始时间已过，申请未提交");
          return;
        }
        await this.setStatus(b.id, "submitting", "正在提交预约系统");
        return {
          requestId: b.id,
          spaceId: b.space_id,
          module: s.module,
          date: b.date,
          start: b.start,
          end: b.end,
          quantity: b.quantity,
          externalUserId: b.submission_user_id ?? b.user_id,
          purpose: b.purpose,
        };
      });
      if (!command) return;
      const result = await this.bounded((signal) => this.adapter.create(command, { signal }));
      if (!result.ref) throw new AdapterError("INVALID_RESPONSE");
      await this.db.tx(async () => {
        await this.db.run(
          "UPDATE bookings SET official_ref=? WHERE id=?",
          result.ref,
          b.id,
        );
        await this.setStatus(b.id, "accepted", "预约系统已受理，正在核对最终状态");
      });
      return { type: "reconcile", bookingId: b.id, delay: 300 };
    }
    if (job.type === "cancel") {
      if (!b.official_ref) return { type: "reconcile", bookingId: b.id };
      await this.setStatus(b.id, "cancelling", "正在向预约系统申请取消");
      await this.bounded((signal) =>
        this.adapter.cancel(b.official_ref!, { signal }),
      );
      return { type: "reconcile", bookingId: b.id };
    }
    const record = b.official_ref
      ? await this.bounded((signal) =>
          this.adapter.get(b.official_ref!, { signal }),
        )
      : this.adapter.findByRequest
        ? await this.bounded((signal) =>
            this.adapter.findByRequest!(b.id, { signal }),
          )
        : null;
    if (!record) {
      await this.setStatus(
        b.id,
        "manual_review",
        "未取得可唯一核对的记录，需要管理员处理；不会自动重试",
      );
      return;
    }
    const space = await this.space(b.space_id);
    if (
      (record.requestId !== undefined
        ? record.requestId !== b.id
        : this.adapter.mode !== "official" ||
          record.identityVerified !== true ||
          record.ref !== b.official_ref ||
          !await this.db.get(
            "SELECT request_id FROM official_bindings WHERE request_id=? AND official_ref=?",
            b.id,
            record.ref,
          )) ||
      record.module !== space.module ||
      record.spaceId !== b.space_id ||
      record.date !== b.date ||
      record.start !== b.start ||
      record.end !== b.end ||
      record.quantity !== b.quantity
    ) {
      await this.setStatus(
        b.id,
        "manual_review",
        "预约详情与本次申请不一致，需要管理员核对",
      );
      return;
    }
    await this.db.run(
      "UPDATE bookings SET official_ref=? WHERE id=?",
      record.ref,
      b.id,
    );
    if (record.status === "unknown") {
      await this.setStatus(
        b.id,
        "manual_review",
        "预约系统返回未识别状态，需要管理员核对",
      );
      return;
    }
    if (record.status === "cancelled") {
      await this.setStatus(b.id, "cancelled", "预约系统已确认取消");
      return;
    }
    if (record.status === "failed") {
      await this.setStatus(b.id, "failed", "预约系统未通过本次申请");
      return;
    }
    if ((await this.booking(b.id)).cancel_requested) {
      if (
        b.status === "cancel_uncertain" ||
        b.status === "cancelling" ||
        await this.db.get(
          "SELECT id FROM jobs WHERE booking_id=? AND type='cancel' AND attempts>0",
          b.id,
        )
      ) {
        await this.setStatus(
          b.id,
          "manual_review",
          "尚未确认取消完成，需要管理员核对；不会重复发送取消",
        );
        return;
      }
      await this.setStatus(b.id, "cancel_requested", "已核对到预约，等待提交取消");
      return { type: "cancel", bookingId: b.id };
    }
    await this.setStatus(
      b.id,
      record.status,
      record.status === "confirmed"
        ? "已核对预约系统，预约已确认"
        : "预约系统已受理，等待审批",
    );
    if (
      record.status === "confirmed" &&
      record.doorCode &&
      /^[A-Za-z0-9*#-]{1,64}$/.test(record.doorCode) &&
      !/^-+$/.test(record.doorCode)
    )
      await this.db.run(
        "INSERT INTO booking_access VALUES(?,?,?) ON CONFLICT(booking_id) DO UPDATE SET door_code=excluded.door_code,verified_at=excluded.verified_at",
        b.id,
        record.doorCode,
        Date.now(),
      );
    else await this.db.run("DELETE FROM booking_access WHERE booking_id=?", b.id);
  }
}
