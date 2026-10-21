export type Module = "meeting" | "activity";
export type BookingStatus =
  | "pending_review"
  | "queued"
  | "submitting"
  | "accepted"
  | "pending_approval"
  | "confirmed"
  | "failed"
  | "uncertain"
  | "manual_review"
  | "cancel_requested"
  | "cancelling"
  | "cancel_uncertain"
  | "cancelled";
export const statusLabels: Record<BookingStatus, string> = {
  pending_review: "待管理员审核",
  queued: "申请已提交",
  submitting: "正在提交",
  accepted: "预约系统已受理",
  pending_approval: "待审批",
  confirmed: "已确认",
  failed: "未成功",
  uncertain: "结果待核对",
  manual_review: "需人工核对",
  cancel_requested: "取消申请已提交",
  cancelling: "正在取消",
  cancel_uncertain: "取消结果待核对",
  cancelled: "已取消",
};
export type SlotState =
  "available" | "occupied" | "pending_approval" | "unopened" | "unknown";
export const slotLabels: Record<SlotState, string> = {
  available: "可预约",
  occupied: "已占用",
  pending_approval: "待审核",
  unopened: "未开放",
  unknown: "未知状态",
};
export type MeetingPolicy = {
  kind: "meeting";
  approval: boolean;
  stepMinutes: number;
  maxMinutes: number;
  rulesVerified?: boolean;
};
// Capacity semantics here are synthetic Mock rules, never inferred official rules.
export type ActivityPolicy = {
  kind: "activity";
  capacity: number;
  stepMinutes: number;
  maxMinutes: number;
  rulesVerified?: boolean;
};
export type Policy = MeetingPolicy | ActivityPolicy;
export interface Space {
  id: string;
  name: string;
  module: Module;
  location: string;
  description: string;
  capacity: number;
  amenities: string[];
  policy: Policy;
  published: boolean;
  bookable: boolean;
  upstreamEnabled: boolean;
  permission?: "allowed" | "denied" | "unknown";
  sourceMetadata?: Record<string, string | number | boolean | null>;
  publicationAllowed?: boolean;
}
export type Slot = { start: number; end: number } & (
  | { kind: "meeting"; state: SlotState }
  | {
      kind: "activity";
      state: SlotState;
      remaining: number;
      capacity: number;
      capacityVerified?: boolean;
      officialState?: "unbooked" | "bookable" | "unbookable" | "unknown";
    }
);
export interface Availability {
  spaceId: string;
  date: string;
  observedAt: number | null;
  stale: boolean;
  slots: Slot[];
}
export interface User {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin";
  studentId?: string;
  bookingPermission?: BookingPermission;
  passwordIsDefault?: boolean;
}
export type BookingPermission = "allowed" | "review" | "blocked";
export interface BookingEvent {
  id: number;
  status: BookingStatus;
  message: string;
  at: number;
}
export interface Booking {
  id: string;
  spaceId: string;
  spaceName: string;
  module: Module;
  date: string;
  start: number;
  end: number;
  quantity: number;
  purpose: string;
  status: BookingStatus;
  message: string;
  createdAt: number;
  updatedAt: number;
  events?: BookingEvent[];
  userName?: string;
  applicantName?: string;
  studentId?: string;
  /** Included only in the session owner's verified booking detail. */
  doorCode?: string;
}
export interface BookingApplicant {
  applicantName: string;
  studentId: string;
}
/** Validate complete coverage, including gaps and irregular upstream slot sizes. */
export function coversRange(
  slots: Slot[],
  start: number,
  end: number,
): boolean {
  const selected = slots.filter((s) => overlaps(start, end, s.start, s.end));
  return (
    end > start &&
    selected[0]?.start === start &&
    selected.at(-1)?.end === end &&
    selected.every(
      (s, i) => s.end > s.start && (i === 0 || selected[i - 1].end === s.start),
    )
  );
}
export const terminal = (s: BookingStatus) =>
  s === "failed" || s === "cancelled";
export function minutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}
export function timeLabel(n: number): string {
  return `${Math.floor(n / 60)
    .toString()
    .padStart(2, "0")}:${(n % 60).toString().padStart(2, "0")}`;
}
export function today(now = Date.now()): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function addDays(date: string, n: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * 86400000)
    .toISOString()
    .slice(0, 10);
}
export function validDate(date: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    !Number.isNaN(Date.parse(`${date}T00:00:00Z`)) &&
    new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date
  );
}
export function slotInstant(date: string, n: number): number {
  return Date.parse(`${date}T${timeLabel(n)}:00+08:00`);
}
export function overlaps(a: number, b: number, c: number, d: number): boolean {
  return a < d && c < b;
}
