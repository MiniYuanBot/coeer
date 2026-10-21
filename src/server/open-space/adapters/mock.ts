import { randomUUID } from "node:crypto";
import { overlaps, type Slot } from "@shared/open-space/domain.js";
import { DB } from "../db.js";
import {
  AdapterError,
  type OfficialAdapter,
  type SourceSpace,
  type CreateCommand,
  type OfficialRecord,
  type Snapshot,
} from "./adapter.js";
export const scenarios = [
  "success",
  "approval",
  "conflict",
  "timeout_after_create",
  "timeout_before_create",
  "network",
  "auth_expired",
  "cancel_timeout",
  "unknown",
] as const;
export type Scenario = (typeof scenarios)[number];
export const mockCatalog: SourceSpace[] = [
  {
    id: "mock-meeting-harbor",
    officialId: "synthetic-harbor",
    module: "meeting",
    name: "泊岸会议室",
    location: "开放中心 · 二层",
    description:
      "适合团队讨论与小型工作坊。自然采光，独立会议桌，提供投屏与白板。",
    capacity: 8,
    amenities: ["无线投屏", "白板", "自然采光"],
    policy: {
      kind: "meeting",
      approval: false,
      stepMinutes: 30,
      maxMinutes: 240,
    },
    enabled: true,
  },
  {
    id: "mock-meeting-grove",
    officialId: "synthetic-grove",
    module: "meeting",
    name: "林间研讨室",
    location: "开放中心 · 三层",
    description: "安静的研讨空间，适合跨团队交流与集中讨论。预约需管理员审批。",
    capacity: 16,
    amenities: ["投影设备", "视频会议", "白板"],
    policy: {
      kind: "meeting",
      approval: true,
      stepMinutes: 30,
      maxMinutes: 240,
    },
    enabled: true,
  },
  {
    id: "mock-activity-studio",
    officialId: "synthetic-studio",
    module: "activity",
    name: "共创活动室",
    location: "开放中心 · 一层",
    description:
      "按人数共享的创作空间。可预约连续时段，人数将从每个时段的余量中扣除。容量规则为演示模拟。",
    capacity: 10,
    amenities: ["工作桌", "电源插座", "工具台"],
    policy: {
      kind: "activity",
      capacity: 10,
      stepMinutes: 30,
      maxMinutes: 180,
    },
    enabled: true,
  },
  {
    id: "mock-meeting-hidden",
    officialId: "synthetic-hidden",
    module: "meeting",
    name: "内部测试室",
    location: "测试区域",
    description: "用于验证默认不公开的空间配置。",
    capacity: 4,
    amenities: ["白板"],
    policy: {
      kind: "meeting",
      approval: false,
      stepMinutes: 30,
      maxMinutes: 120,
    },
    enabled: true,
  },
];
type Row = {
  ref: string;
  request_id: string;
  space_id: string;
  date: string;
  start: number;
  end: number;
  quantity: number;
  status: OfficialRecord["status"];
};
export class MockAdapter implements OfficialAdapter {
  readonly mode = "mock" as const;
  constructor(private db: DB) {}
  scenario(id: string): Scenario {
    return (
      this.db.get<{ scenario: Scenario }>(
        "SELECT scenario FROM mock_scenarios WHERE space_id=?",
        id,
      )?.scenario ?? "success"
    );
  }
  async listSpaces() {
    if (this.db.setting("mock_sync_failure") === "true")
      throw new AdapterError("NETWORK");
    return mockCatalog;
  }
  async availability(spaceId: string, date: string): Promise<Snapshot> {
    const space = mockCatalog.find((s) => s.id === spaceId);
    if (!space) throw new AdapterError("UNSUPPORTED");
    const records = this.db.all<Row>(
      "SELECT * FROM mock_reservations WHERE space_id=? AND date=? AND status NOT IN ('failed','cancelled')",
      spaceId,
      date,
    );
    const slots: Slot[] = [];
    for (let start = 480; start < 1200; start += 30) {
      const used = records.filter((r) =>
        overlaps(start, start + 30, r.start, r.end),
      );
      if (space.module === "meeting") {
        let state: Slot["state"] =
          start === 540
            ? "occupied"
            : start === 720
              ? "pending_approval"
              : start >= 1080
                ? "unopened"
                : start === 1050
                  ? "unknown"
                  : "available";
        if (used.length)
          state = used.some((r) => r.status === "pending_approval")
            ? "pending_approval"
            : "occupied";
        slots.push({ kind: "meeting", start, end: start + 30, state });
      } else {
        const baseUsed = start === 660 ? 8 : start === 840 ? 10 : 0;
        const remaining = Math.max(
          0,
          space.capacity - baseUsed - used.reduce((n, r) => n + r.quantity, 0),
        );
        const state =
          start >= 1080
            ? "unopened"
            : start === 1050
              ? "unknown"
              : remaining === 0
                ? "occupied"
                : "available";
        slots.push({
          kind: "activity",
          start,
          end: start + 30,
          state,
          remaining,
          capacity: space.capacity,
        });
      }
    }
    return { slots, includedRefs: records.map((r) => r.ref) };
  }
  async create(command: CreateCommand): Promise<{ ref: string }> {
    this.db.run(
      "INSERT INTO adapter_calls(operation,request_id,at) VALUES(?,?,?)",
      "create",
      command.requestId,
      Date.now(),
    );
    const scenario = this.scenario(command.spaceId);
    if (scenario === "auth_expired") throw new AdapterError("AUTH_EXPIRED");
    if (scenario === "network") throw new AdapterError("NETWORK");
    if (scenario === "timeout_before_create") throw new AdapterError("TIMEOUT");
    if (scenario === "conflict") throw new AdapterError("CONFLICT");
    const snapshot = await this.availability(command.spaceId, command.date);
    const selected = snapshot.slots.filter((s) =>
      overlaps(command.start, command.end, s.start, s.end),
    );
    if (
      !selected.length ||
      selected.some(
        (s) =>
          s.state !== "available" ||
          (s.kind === "activity" && s.remaining < command.quantity),
      )
    )
      throw new AdapterError("CONFLICT");
    const space = mockCatalog.find((s) => s.id === command.spaceId)!;
    const ref = `MOCK-${randomUUID()}`;
    const status =
      scenario === "unknown"
        ? "unknown"
        : scenario === "approval" ||
            (space.policy.kind === "meeting" && space.policy.approval)
          ? "pending_approval"
          : "confirmed";
    this.db.run(
      "INSERT INTO mock_reservations VALUES(?,?,?,?,?,?,?,?)",
      ref,
      command.requestId,
      command.spaceId,
      command.date,
      command.start,
      command.end,
      command.quantity,
      status,
    );
    if (scenario === "timeout_after_create") throw new AdapterError("TIMEOUT");
    return { ref };
  }
  async cancel(ref: string) {
    const record = await this.get(ref);
    if (!record) throw new AdapterError("INVALID_RESPONSE");
    this.db.run(
      "INSERT INTO adapter_calls(operation,request_id,at) VALUES(?,?,?)",
      "cancel",
      record.requestId!,
      Date.now(),
    );
    if (this.scenario(record.spaceId) === "auth_expired")
      throw new AdapterError("AUTH_EXPIRED");
    this.db.run(
      "UPDATE mock_reservations SET status='cancelled' WHERE ref=?",
      ref,
    );
    if (this.scenario(record.spaceId) === "cancel_timeout")
      throw new AdapterError("TIMEOUT");
  }
  async get(ref: string): Promise<OfficialRecord | null> {
    const row = this.db.get<Row>(
      "SELECT * FROM mock_reservations WHERE ref=?",
      ref,
    );
    return row ? this.project(row) : null;
  }
  async findByRequest(id: string) {
    const row = this.db.get<Row>(
      "SELECT * FROM mock_reservations WHERE request_id=?",
      id,
    );
    return row ? this.project(row) : null;
  }
  private project(r: Row): OfficialRecord {
    return {
      ref: r.ref,
      requestId: r.request_id,
      spaceId: r.space_id,
      module: mockCatalog.find((s) => s.id === r.space_id)!.module,
      date: r.date,
      start: r.start,
      end: r.end,
      quantity: r.quantity,
      status: r.status,
    };
  }
  decide(ref: string, decision: "approve" | "reject" | "cancel") {
    const row = this.db.get<Row>(
      "SELECT * FROM mock_reservations WHERE ref=?",
      ref,
    );
    if (!row) return false;
    if (decision !== "cancel" && row.status !== "pending_approval")
      return false;
    this.db.run(
      "UPDATE mock_reservations SET status=? WHERE ref=?",
      decision === "approve"
        ? "confirmed"
        : decision === "reject"
          ? "failed"
          : "cancelled",
      ref,
    );
    return true;
  }
}
