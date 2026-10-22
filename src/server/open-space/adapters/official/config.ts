import { readFileSync, realpathSync, statSync } from "node:fs";
import { isPrivateRuntimePath } from '../../private-path'
import { z } from "zod";
import { AdapterError } from "../adapter.js";
import { validDate } from "@shared/open-space/domain.js";
const date = z.string().refine(validDate);
const instant = z.string().datetime({ offset: true });
const identifier = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[-A-Za-z0-9_.:]+$/);
const binding = z.discriminatedUnion("from", [
  z.strictObject({ from: z.literal("constant"), value: z.string().max(500) }),
  z.strictObject({
    from: z.literal("draft"),
    field: z.enum([
      "MEETING_APPLY_ID",
      "ROOMMEETING_ID",
      "MEETING_PERSON",
      "NAME",
      "deptName",
      "TEL",
      "username",
      "name",
      "PCRF_TIME",
      "PCRF_COST",
      "roomName",
      "PLACE",
      "FLOOR",
      "MEETING_DATE",
      "startDate",
      "endDate",
      "START_TIME",
      "END_TIME",
      "SCALE_VALUE",
    ]),
  }),
  z.strictObject({
    from: z.literal("command"),
    field: z.enum(["date", "start", "end", "purpose"]),
  }),
  z.strictObject({ from: z.literal("account"), field: z.literal("contact") }),
  z.strictObject({
    from: z.literal("initialization"),
    field: z.enum(["meetingPlace", "defaultMeetingLabel"]),
  }),
]);
const rule = z.strictObject({
  officialId: identifier,
  stepMinutes: z.number().int().min(5).max(120),
  maxMinutes: z.number().int().min(5).max(1440),
  approval: z.boolean(),
  firstDate: date,
  lastDate: date,
});
const scope = z
  .strictObject({
    module: z.literal("meeting"),
    officialId: identifier,
    dates: z.array(date).min(1).max(31).optional(),
    rollingDaysAhead: z.number().int().min(0).max(7).optional(),
    start: z.number().int().min(0).max(1439),
    end: z.number().int().min(1).max(1440),
    operations: z.array(z.enum(["initialize", "create", "cancel"])).min(1),
  })
  .refine(
    (s) => (s.dates !== undefined) !== (s.rollingDaysAhead !== undefined),
  );
const authorization = z.strictObject({
  approvalRef: z.string().min(3).max(100),
  validFrom: instant,
  validUntil: instant,
  accountAlias: z.string().min(1).max(60),
  profileUserId: identifier,
  bookingPersonId: identifier,
  externalUserIds: z.array(z.string().min(1).max(100)).default([]),
  scopes: z.array(scope).default([]),
});
const contract = z.strictObject({
  version: z.literal(1),
  evidenceRef: z.string().min(3).max(100),
  initializedIdIsStable: z.literal(true),
  initializationDoesNotConfirm: z.literal(true),
  receiptMode: z.enum(["json", "independent_query"]).default("json"),
  verifyFields: z.record(z.string().regex(/^[A-Za-z_0-9]{1,60}$/), binding),
  createFields: z.record(z.string().regex(/^[A-Za-z_0-9]{1,60}$/), binding),
  verifySuccessCodes: z.array(z.string().min(1).max(30)).min(1),
  verifyRejectCodes: z.array(z.string().min(1).max(30)).default([]),
  ack: z
    .strictObject({
      successPath: z.array(z.string().regex(/^[A-Za-z_0-9]+$/)).min(1),
      successValue: z.union([z.string(), z.boolean(), z.number()]),
      refPath: z.array(z.string().regex(/^[A-Za-z_0-9]+$/)).min(1),
    })
    .optional(),
  statusMap: z
    .record(
      z.string().max(30),
      z.enum([
        "confirmed",
        "pending_approval",
        "failed",
        "cancelled",
        "unknown",
      ]),
    )
    .default({}),
  rules: z.array(rule).default([]),
});
export const publication = z.strictObject({
  module: z.enum(["meeting", "activity"]),
  officialId: identifier,
  approvalRef: z.string().min(3).max(100),
  expiresAt: instant,
  name: z.string().min(2).max(80),
  location: z.string().max(100),
  description: z.string().max(500),
  capacity: z.number().int().min(0).max(10000),
  amenities: z.array(z.string().max(40)).max(30),
  syncFields: z.array(z.enum(["capacity", "amenities"])).max(2).refine(
    (fields) => new Set(fields).size === fields.length,
  ).optional(),
});
export const officialConfigSchema = z
  .strictObject({
    baseURL: z.string().url(),
    allowHTTP: z.boolean().default(false),
    /** Upstream mode delegates booking limits to the official account and verify API. */
    rulesSource: z.enum(["upstream", "contract"]).default("contract"),
    account: z.strictObject({
      alias: z.string().min(1).max(60),
      profileUserId: identifier.optional(),
      bookingPersonId: identifier.optional(),
      contact: z.string().trim().min(1).max(200).optional(),
    }),
    modules: z
      .array(z.enum(["meeting", "activity"]))
      .min(1)
      .default(["meeting", "activity"]),
    minIntervalMs: z.number().int().min(0).max(60000).default(1000),
    requestTimeoutMs: z.number().int().min(100).max(30000).default(10000),
    operationTimeoutMs: z.number().int().min(1000).max(300000).default(120000),
    cacheMs: z.number().int().min(0).max(300000).default(30000),
    maxPages: z.number().int().min(1).max(100).default(20),
    syncIntervalMs: z.number().int().min(60000).max(3600000).default(300000),
    reconcileIntervalMs: z
      .number()
      .int()
      .min(10000)
      .max(3600000)
      .default(60000),
    horizon: z.number().int().min(0).max(30).default(7),
    publications: z.array(publication).default([]),
    writes: z
      .strictObject({
        enabled: z.boolean().default(false),
        authorization: authorization.optional(),
        contract: contract.optional(),
      })
      .default({ enabled: false }),
  })
  .superRefine((value, ctx) => {
    const bad = (message: string) => ctx.addIssue({ code: "custom", message });
    let u: URL;
    try {
      u = new URL(value.baseURL);
    } catch {
      bad("Invalid official base URL");
      return;
    }
    if (
      u.username ||
      u.password ||
      u.search ||
      u.hash ||
      !u.pathname.endsWith("/meeting/") ||
      !["https:", "http:"].includes(u.protocol) ||
      (u.protocol === "http:" && !value.allowHTTP)
    )
      bad("Unsafe official base URL");
    if (
      new Set(value.modules).size !== value.modules.length ||
      new Set(value.publications.map((p) => `${p.module}:${p.officialId}`))
        .size !== value.publications.length
    )
      bad("Duplicate module or publication");
    if (
      value.writes.enabled &&
      (!value.writes.contract ||
        (value.rulesSource === "contract" && !value.writes.authorization) ||
        (value.rulesSource === "upstream" && (!value.account.profileUserId || !value.account.bookingPersonId)))
    )
      bad("Pinned account and form contract required");
    const a = value.writes.authorization;
    if (
      a &&
      (a.accountAlias !== value.account.alias ||
        a.profileUserId !== value.account.profileUserId ||
        a.bookingPersonId !== value.account.bookingPersonId ||
        Date.parse(a.validUntil) <= Date.parse(a.validFrom) ||
        a.scopes.some((s) => s.start >= s.end))
    )
      bad("Authorization account or range mismatch");
    const c = value.writes.contract;
    if (value.rulesSource === "contract" && value.writes.enabled &&
        (!a?.externalUserIds.length || !a.scopes.length || !c?.rules.length))
      bad("Static booking scopes and rules required in contract mode");
    if (c) {
      if (
        value.writes.enabled &&
        (!c.createFields.REMARK ||
          ([
            ...Object.values(c.createFields),
            ...Object.values(c.verifyFields),
          ].some((b) => b.from === "account") &&
            !value.account.contact))
      )
        bad("Required operator contact is missing");
      if (
        c.verifySuccessCodes.some((v) => c.verifyRejectCodes.includes(v)) ||
        (c.statusMap["1"] && c.statusMap["1"] !== "confirmed") ||
        (c.statusMap["3"] && c.statusMap["3"] !== "cancelled")
      )
        bad("Contradictory status contract");
      for (const r of c.rules)
        if (r.firstDate > r.lastDate || r.maxMinutes % r.stepMinutes)
          bad("Invalid rule range");
    }
  });
export type OfficialConfig = z.infer<typeof officialConfigSchema>;
export type FieldBinding = z.infer<typeof binding>;
export function parseOfficialConfig(value: unknown): OfficialConfig {
  const r = officialConfigSchema.safeParse(value);
  if (!r.success) throw new AdapterError("CONFIGURATION");
  return r.data;
}
/** Private files stay outside the project or in .coeer-local; errors never expose paths. */
export function readPrivateJSON(path: string, maxBytes = 262144): unknown {
  try {
    const real = realpathSync(path), stat = statSync(real);
    if (
      !isPrivateRuntimePath(real) ||
      !stat.isFile() ||
      stat.size > maxBytes
    )
      throw 0;
    if (process.platform !== "win32" && (stat.mode & 0o077) !== 0) throw 0;
    return JSON.parse(readFileSync(real, "utf8"));
  } catch {
    throw new AdapterError("CONFIGURATION");
  }
}
export const publicationAllowlistSchema = z.strictObject({
  version: z.literal(1),
  publications: z.array(publication).max(500),
});
/** Separate public-field approval from authentication, so re-login cannot erase it. */
export function loadOfficialConfig(
  path: string,
  publicationPath?: string,
  writesPath?: string,
) {
  let config = parseOfficialConfig(readPrivateJSON(path));
  if (publicationPath) {
    const allowlist = publicationAllowlistSchema.safeParse(
      readPrivateJSON(publicationPath),
    );
    if (!allowlist.success || config.publications.length)
      throw new AdapterError("CONFIGURATION");
    config = parseOfficialConfig({
      ...config,
      publications: allowlist.data.publications,
    });
  }
  if (writesPath) {
    const approved = z
      .strictObject({
        version: z.literal(1),
        contact: z.string().trim().min(1).max(200),
        authorization: authorization.optional(),
        contract,
      })
      .safeParse(readPrivateJSON(writesPath));
    if (
      !approved.success ||
      config.writes.enabled ||
      config.writes.authorization ||
      config.writes.contract
    )
      throw new AdapterError("CONFIGURATION");
    config = parseOfficialConfig({
      ...config,
      account: { ...config.account, contact: approved.data.contact },
      writes: {
        enabled: true,
        authorization: approved.data.authorization,
        contract: approved.data.contract,
      },
    });
  }
  return config;
}
