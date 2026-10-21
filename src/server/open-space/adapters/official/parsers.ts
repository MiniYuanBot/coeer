import { parseHTML } from "linkedom";
import { createHash } from "node:crypto";
import {
  minutes,
  validDate,
  type Module,
  type Slot,
} from "@shared/open-space/domain.js";
import {
  AdapterError,
  type OfficialRecord,
  type OfficialState,
  type SourceSpace,
} from "../adapter.js";
import { extractListFacts, type ListFacts } from "./extract.js";
export const spaceKey = (module: Module, id: string) =>
  `official:${module}:${createHash("sha256").update(id).digest("hex").slice(0, 24)}`;
export interface ParsedCard {
  source: SourceSpace;
  slots: Slot[];
}
export interface ParsedPage {
  facts: ListFacts;
  cards: ParsedCard[];
  unresolved: number;
}
const time = (s: string | null) =>
  s && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(s) ? minutes(s) : null;
export function parseList(
  html: string,
  module: Module,
  date: string,
  baseURL: string,
): ParsedPage {
  const document = parseHTML(html).document;
  const facts = extractListFacts(document as unknown as Document);
  return decodeListFacts(facts, module, date, baseURL);
}
export function decodeListFacts(
  facts: ListFacts,
  module: Module,
  date: string,
  baseURL: string,
): ParsedPage {
  if (facts.login) throw new AdapterError("AUTH_EXPIRED");
  const expected =
    module === "meeting" ? "meeting/reList.do" : "classroombooking/reList.do";
  if (
    !validDate(date) ||
    facts.date !== date ||
    facts.formMethod !== "post" ||
    facts.total === null ||
    facts.pages === null ||
    facts.currentPage === null ||
    facts.pageSize === null
  )
    throw new AdapterError("INVALID_RESPONSE");
  let base: URL, action: URL;
  try {
    base = new URL(facts.base ?? "", baseURL);
    action = new URL(facts.formAction ?? "", base);
  } catch {
    throw new AdapterError("INVALID_RESPONSE");
  }
  if (
    base.href !== new URL(baseURL).href ||
    action.href !== new URL(expected, baseURL).href ||
    facts.total < facts.cards.length ||
    facts.pages < 1 ||
    facts.pages > 100 ||
    facts.pageSize < 1 ||
    facts.pageSize > 50
  )
    throw new AdapterError("INVALID_RESPONSE");
  const cards: ParsedCard[] = [];
  let unresolved = 0;
  for (const card of facts.cards) {
    if (!card.name || card.name.length > 200)
      throw new AdapterError("INVALID_RESPONSE");
    if (card.cells.length === 0) {
      unresolved++;
      continue;
    }
    const officialId = card.cells[0].id;
    if (
      !officialId ||
      !/^[-A-Za-z0-9_.:]{1,128}$/.test(officialId) ||
      card.cells.some((c) => !c.valid || c.id !== officialId || c.date !== date)
    )
      throw new AdapterError("INVALID_RESPONSE");
    let previous = -1;
    const slots: Slot[] = card.cells.map((c) => {
      const start = time(c.start),
        end = time(c.end);
      if (start === null || end === null || start >= end || start < previous)
        throw new AdapterError("INVALID_RESPONSE");
      previous = end;
      if (module === "meeting")
        return {
          kind: "meeting",
          start,
          end,
          state:
            c.color === "green"
              ? "available"
              : c.color === "red"
                ? "occupied"
                : c.color === "red1"
                  ? "pending_approval"
                  : "unknown",
        };
      const officialState =
        c.color === "green"
          ? "unbooked"
          : c.color === "yellow"
            ? "bookable"
            : c.color === "red"
              ? "unbookable"
              : "unknown";
      // The observed numeric capacity semantics have NOT been verified.
      return {
        kind: "activity",
        start,
        end,
        state: officialState === "unbookable" ? "occupied" : "unknown",
        remaining: 0,
        capacity: 0,
        capacityVerified: false,
        officialState,
      };
    });
    const stepSet = new Set(slots.map((s) => s.end - s.start)),
      step = stepSet.size === 1 ? [...stepSet][0] : 0;
    const permission =
      card.visible === "1"
        ? "allowed"
        : card.visible === "0"
          ? "denied"
          : "unknown";
    // Observed meeting progress labels describe the current meeting, not a room shutdown.
    const startingSoon = module === "meeting" && card.state === "即将开始";
    const endingSoon = module === "meeting" && card.state === "即将结束";
    const enabled =
      card.state === "空闲中" ||
      card.state === "正在进行" ||
      startingSoon ||
      endingSoon;
    const metadata = {
      permission,
      displayState:
        card.state === "空闲中"
          ? "idle"
          : card.state === "正在进行"
            ? "in_progress"
            : startingSoon
              ? "starting_soon"
              : endingSoon
                ? "ending_soon"
                : card.state === "停用中"
                  ? "disabled"
                  : "unknown",
      firstSlot: card.cells[0].start,
      lastSlot: card.cells.at(-1)?.end ?? null,
      stepMinutes: step || null,
      dateWindowVerified: false,
      activityCapacityVerified: false,
    };
    cards.push({
      source: {
        id: spaceKey(module, officialId),
        officialId,
        module,
        name: card.name,
        location: card.floor,
        description: "官方空间；公开资料须单独审批配置。",
        // Room seating is descriptive; it does not establish activity inventory rules.
        capacity: card.capacity,
        amenities: card.amenities,
        policy:
          module === "meeting"
            ? {
                kind: "meeting",
                approval: true,
                stepMinutes: step,
                maxMinutes: 0,
                rulesVerified: false,
              }
            : {
                kind: "activity",
                capacity: 0,
                stepMinutes: step,
                maxMinutes: 0,
                rulesVerified: false,
              },
        enabled,
        permission,
        metadata,
      },
      slots,
    });
  }
  return { facts, cards, unresolved };
}
export function parseJSON(body: string): Record<string, unknown> {
  try {
    const j: unknown = JSON.parse(body);
    if (j && typeof j === "object" && !Array.isArray(j))
      return j as Record<string, unknown>;
  } catch {
    /* Never include body in errors. */
  }
  throw new AdapterError("INVALID_RESPONSE");
}
/** Only fields observed in the read-only meeting configuration response are retained. */
export function parseMeetingConfiguration(body: string, officialId: string) {
  const j = parseJSON(body),
    open = time(typeof j.OPEN_TIME === "string" ? j.OPEN_TIME : null),
    close = time(typeof j.CLOSE_TIME === "string" ? j.CLOSE_TIME : null);
  if (
    j.ROOMMEETING_ID !== officialId ||
    open === null ||
    close === null ||
    open >= close ||
    typeof j.SCALE_VALUE !== "number" ||
    !Number.isInteger(j.SCALE_VALUE) ||
    j.SCALE_VALUE <= 0 ||
    !Array.isArray(j.data) ||
    j.data.length === 0 ||
    j.data.length > 288
  )
    throw new AdapterError("INVALID_RESPONSE");
  let previous = open;
  const slots = j.data.map((value): Slot => {
    const item = object(value),
      start = time(typeof item.staTime === "string" ? item.staTime : null),
      end = time(typeof item.endTime === "string" ? item.endTime : null);
    if (
      start === null ||
      end === null ||
      start !== previous ||
      end - start !== j.SCALE_VALUE ||
      end > close ||
      typeof item.className !== "string"
    )
      throw new AdapterError("INVALID_RESPONSE");
    previous = end;
    const colors = item.className
      .split(/\s+/)
      .filter((c) => ["green", "red", "red1", "yellow", "gray"].includes(c));
    const color = colors.length === 1 ? colors[0] : "unknown";
    return {
      kind: "meeting",
      start,
      end,
      state:
        color === "green"
          ? "available"
          : color === "red"
            ? "occupied"
            : color === "red1"
              ? "pending_approval"
              : "unknown",
    };
  });
  if (previous !== close) throw new AdapterError("INVALID_RESPONSE");
  const metadata: Record<string, string | number | boolean | null> = {
    openTime: String(j.OPEN_TIME),
    closeTime: String(j.CLOSE_TIME),
    stepMinutes: j.SCALE_VALUE,
    configurationCodesVerified: false,
    reservationCost:
      typeof j.PCRF_COST === "number" &&
      Number.isFinite(j.PCRF_COST) &&
      j.PCRF_COST >= 0
        ? j.PCRF_COST
        : null,
  };
  for (const key of [
    "STATUS",
    "BOOKABLE",
    "IDLE_STATUS",
    "AUDIT_FLAG",
    "TIME_LIMIT",
  ])
    metadata[`configuration_${key}`] =
      typeof j[key] === "string" && /^[A-Za-z0-9_-]{1,30}$/.test(j[key])
        ? j[key]
        : null;
  for (const key of ["DIS_START_TIME", "DIS_END_TIME"])
    metadata[`configuration_${key}`] =
      typeof j[key] === "string" && time(j[key]) !== null ? j[key] : null;
  return { slots, metadata }; // Codes are evidence, not inferred approval/date-window rules.
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new AdapterError("INVALID_RESPONSE");
  return value as Record<string, unknown>;
}
export function text(value: unknown): string {
  if (typeof value !== "string" || !value || value.length > 256)
    throw new AdapterError("INVALID_RESPONSE");
  return value;
}
export function parseMeetingRecord(
  body: string,
  ref: string,
  operatorId: string,
  statusMap: Record<string, OfficialState> = {},
): OfficialRecord {
  const pd = object(parseJSON(body).pd),
    id = text(pd.MEETING_APPLY_ID),
    room = text(pd.ROOMMEETING_ID),
    date = text(pd.START_DATE),
    endDate = text(pd.END_DATE);
  const start = time(typeof pd.START_TIME === "string" ? pd.START_TIME : null),
    end = time(typeof pd.END_TIME === "string" ? pd.END_TIME : null);
  if (
    id !== ref ||
    !validDate(date) ||
    date !== endDate ||
    start === null ||
    end === null ||
    start >= end
  )
    throw new AdapterError("INVALID_RESPONSE");
  if (pd.MEETING_PERSON !== operatorId) throw new AdapterError("FORBIDDEN");
  // Only two values observed in official records. Further mappings require a reviewed contract.
  const status =
    typeof pd.STATUS === "string"
      ? ((
          { ...statusMap, "1": "confirmed", "3": "cancelled" } as Record<
            string,
            OfficialState
          >
        )[pd.STATUS] ?? "unknown")
      : "unknown";
  return {
    ref: id,
    spaceId: spaceKey("meeting", room),
    module: "meeting",
    date,
    start,
    end,
    quantity: 1,
    status,
    identityVerified: true,
    ...(status === "confirmed" &&
    typeof pd.OPEN_CODE === "string" &&
    /^[A-Za-z0-9*#-]{1,64}$/.test(pd.OPEN_CODE.trim()) &&
    !/^-+$/.test(pd.OPEN_CODE.trim())
      ? { doorCode: pd.OPEN_CODE.trim() }
      : {}),
  };
}
