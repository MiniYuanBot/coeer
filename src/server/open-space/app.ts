import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { z } from "zod";
import { DB } from "./db.js";
import { AppError, BookingService } from "./service.js";
import { MockAdapter, scenarios } from "./adapters/mock.js";
import { DisabledOfficialAdapter } from "./adapters/official.js";
import { AdapterError, type OfficialAdapter } from "./adapters/adapter.js";
import { LiveOfficialAdapter } from "./adapters/official/live.js";
import {
  OfficialHTTP,
  type CredentialProvider,
} from "./adapters/official/http.js";
import { PostgresBindings } from "./adapters/official/bindings.js";
import type { OfficialConfig } from "./adapters/official/config.js";
import {
  checkPassword,
  digest,
  hashPassword,
  newSession,
  session,
} from "./auth.js";
import type { User } from "@shared/open-space/domain.js";
import { auditActions, jobTypes } from "@shared/open-space/history.js";
import { Accounts } from "./accounts.js";
import { operationalStatus, monitor } from "./operations.js";
import { pruneHistory } from "./retention.js";
import type { Environment } from "./runtime.js";
import { communityCsrf, verifyCommunityIdentity } from "./coeer-identity.js";

export interface AppOptions {
  /** Server-only signing key; enables COEER authentication without a second login. */
  communityIdentitySecret?: string;
  /** The COEER integration renders its own UI. */
  serveClient?: boolean;
  /** Trusted embedding host may isolate rate limits by its authenticated account. */
  rateLimitKey?: (request: Request) => string | undefined;
  databaseUrl?: string;
  databaseSchema?: string;
  demo?: boolean;
  production?: boolean;
  environment?: Environment;
  registrationEnabled?: boolean;
  origin?: string;
  trustProxy?: boolean;
  adapter?: OfficialAdapter;
  adapterMode?: "mock" | "official-disabled" | "official";
  official?: {
    config: OfficialConfig;
    credentials: CredentialProvider;
    fetcher?: typeof fetch;
    /** Optional host integration; preserves the adapter's database write guard. */
    wrapAdapter?: (adapter: LiveOfficialAdapter) => OfficialAdapter;
  };
  syncEnabled?: boolean;
  bookingEnabled?: boolean;
  adminEmail?: string;
  adminStudentId?: string;
  adminPassword?: string;
  horizon?: number;
  publicBookingUserId?: string;
  staleMs?: number;
  /** Serve the persisted cache while the worker performs its startup sync. */
  deferInitialSync?: boolean;
}
type AuthResponse = Response<unknown, { user?: User; csrf?: string }>;
const studentIdSchema = z.string().regex(/^[0-9]{10}$/);
const password = z.string().min(12).max(128);
const createSchema = z.strictObject({
  spaceId: z.string().min(1).max(100),
  date: z.string().max(10),
  start: z.number().int().min(0).max(1439),
  end: z.number().int().min(1).max(1440),
  quantity: z.number().int().min(1).max(100),
  purpose: z.string().trim().min(2).max(200),
  applicantName: z.string().trim().min(1).max(40).optional(),
  studentId: studentIdSchema.optional(),
});
function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success)
    throw new AppError(
      400,
      "VALIDATION",
      (
        {
          studentId: "学号须为 10 位数字，请检查后重试",
          applicantName: "请填写姓名（最多 40 字）",
          purpose: "请填写 2 至 200 字的预约用途",
          password: "请检查密码长度（注册密码至少 12 位）",
        } as Record<string, string>
      )[String(result.error.issues[0]?.path[0])] ??
        "填写内容无效，请检查后重试",
    );
  return result.data;
}
export async function createApp(options: AppOptions = {}) {
  let connectorChecking = false;
  const db = await DB.open(options.databaseUrl, options.databaseSchema);
  // Only this Web worker owns synchronization; rows left running by a prior process
  // have no live request. Keep their last known activity for history expiration.
  await db.run(
    "UPDATE sync_runs SET status='failed',error_code='WORKER_INTERRUPTED',finished_at=started_at WHERE status='running'",
  );
  let adapter: OfficialAdapter =
    options.adapter ??
    (options.adapterMode === "official" && options.official
      ? new LiveOfficialAdapter(
          options.official.config,
          new OfficialHTTP(
            options.official.config,
            options.official.credentials,
            options.official.fetcher,
          ),
          new PostgresBindings(db),
          async () => {
            if (
              await db.setting("paused") === "true" ||
              await db.setting("booking_enabled") !== "true"
            )
              throw new AdapterError("AUTHORIZATION_REQUIRED");
          },
        )
      : options.adapterMode === "official-disabled"
        ? new DisabledOfficialAdapter()
        : new MockAdapter(db));
  if (options.official?.wrapAdapter && adapter instanceof LiveOfficialAdapter)
    adapter = options.official.wrapAdapter(adapter);
  if (options.adapterMode === "official" && adapter.mode !== "official") {
    await db.close();
    throw new Error("Official configuration required; refusing mock fallback");
  }
  if (options.syncEnabled !== undefined)
    await db.set("sync_enabled", String(options.syncEnabled));
  if (options.bookingEnabled !== undefined)
    await db.set("booking_enabled", String(options.bookingEnabled));
  const service = new BookingService(
    db,
    adapter,
    options.horizon ?? adapter.defaultHorizon ?? 14,
    options.staleMs ??
      (adapter.mode === "official"
        ? Math.max(180000, (adapter.syncIntervalMs ?? 300000) * 2)
        : 180000),
    options.publicBookingUserId,
  );
  const accounts = new Accounts(db);
  const demo = (options.demo ?? false) && adapter.mode === "mock",
    production = options.production ?? false;
  const adminStudentId =
    options.adminStudentId ??
    (demo || options.adminEmail ? "9999999999" : undefined);
  const adminPassword = demo ? "demo-admin-2026" : options.adminPassword;
  if (
    adminStudentId &&
    adminPassword &&
    await db.setting("account_login_enabled") !== "true" &&
    !await db.get("SELECT id FROM users WHERE role='admin'")
  ) {
    const studentId = parse(studentIdSchema, adminStudentId),
      pass = parse(password, adminPassword),
      id = randomUUID();
    await db.run(
      "INSERT INTO users VALUES(?,?,?,?,?)",
      id,
      `${studentId}@admins.openspace.invalid`,
      demo ? "演示管理员" : "管理员",
      await hashPassword(pass),
      "admin",
    );
    await db.run(
      "INSERT INTO user_accounts VALUES(?,?,?,?,?)",
      id,
      studentId,
      "allowed",
      1,
      Date.now(),
    );
  }
  if (
    demo &&
    !await db.get(
      "SELECT student_id FROM booking_allowlist WHERE student_id='0000000001'",
    )
  )
    await accounts.save("0000000001", "测试访客");
  if (
    production &&
    !demo &&
    !options.communityIdentitySecret &&
    !await db.get("SELECT id FROM users WHERE role=?", "admin")
  ) {
    await db.close();
    throw new Error(
      "Configure ADMIN_STUDENT_ID and a private admin password for first deployment",
    );
  }
  if (!options.deferInitialSync || demo) {
    try {
      await service.sync();
    } catch {
      /* Failed sync is persisted; the service stays available in degraded mode. */
    }
  }
  if (
    demo &&
    adapter.mode === "mock" &&
    await db.setting("demo_initialized") !== "true"
  ) {
    await db.tx(async () => {
      await db.run(
        "UPDATE spaces SET published=1,bookable=1 WHERE id IN ('mock-meeting-harbor','mock-meeting-grove','mock-activity-studio')",
      );
      await db.set("demo_initialized", "true");
      await db.audit("system", "demo.publish", "demo", { synthetic: true });
    });
    await service.sync();
  }
  const app = express();
  app.disable("x-powered-by");
  if (options.trustProxy) app.set("trust proxy", 1);
  app.use(helmet());
  app.use(express.json({ limit: "16kb" }));
  app.use(cookieParser());
  const allowed = new Set([
    options.origin ?? "http://localhost:5173",
    ...(!production ? ["http://localhost:5173", "http://127.0.0.1:5173"] : []),
  ]);
  app.use("/api", (req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      if (req.headers.origin && !allowed.has(req.headers.origin))
        return next(new AppError(403, "ORIGIN", "请求来源无效"));
      if (!req.is("application/json"))
        return next(new AppError(415, "CONTENT_TYPE", "请使用 JSON 请求"));
    }
    next();
  });
  app.use("/api", async (req: Request, res: AuthResponse, next: NextFunction) => {
    if (options.communityIdentitySecret) {
      if (["/health", "/ready"].includes(req.path)) return next();
      const identity = verifyCommunityIdentity(req.header("x-coeer-identity"), options.communityIdentitySecret);
      if (!identity) return next(new AppError(401, "COEER_UNAUTHORIZED", "请先登录 COEER"));
      const current = await accounts.communityUser(identity);
      if (current) {
        res.locals.user = current;
        res.locals.csrf = communityCsrf(identity, options.communityIdentitySecret);
      }
      return next();
    }
    const current = await session(db, req.cookies?.openspace_session);
    if (current) {
      res.locals.user = current.user;
      res.locals.csrf = current.csrf;
    }
    next();
  });
  const auth = (req: Request, res: AuthResponse, next: NextFunction) =>
    res.locals.user
      ? next()
      : next(new AppError(401, "UNAUTHORIZED", "请先登录"));
  const admin = (req: Request, res: AuthResponse, next: NextFunction) =>
    res.locals.user?.role === "admin"
      ? next()
      : next(new AppError(403, "FORBIDDEN", "需要管理员权限"));
  const bookingAuth = auth;
  const bookingOwner = (res: AuthResponse) => res.locals.user!.id;
  const csrf = (req: Request, res: AuthResponse, next: NextFunction) =>
    req.header("X-CSRF-Token") === res.locals.csrf && !!res.locals.csrf
      ? next()
      : next(new AppError(403, "CSRF", "会话验证失效，请刷新后重试"));
  const limit =
    (label: string, max: number, window: number) =>
    async (req: Request, _res: Response, next: NextFunction) => {
      const now = Date.now(),
        key = digest(
          `${label}:${options.rateLimitKey?.(req) ?? (["register", "login", "visitor_session", "booking", "cancel"].includes(label) ? req.ip : (_res.locals.user?.id ?? req.ip))}`,
        );
      const entry = await db.tx(async () => {
        await db.run("DELETE FROM rate_limits WHERE until<=?", now);
        await db.run(
          "INSERT INTO rate_limits VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=rate_limits.count+1",
          key,
          now + window,
        );
        return (await db.get<{ count: number; until: number }>(
          "SELECT count,until FROM rate_limits WHERE key=?",
          key,
        ))!;
      });
      if (entry.count > max) {
        _res.setHeader(
          "Retry-After",
          String(Math.ceil((entry.until - now) / 1000)),
        );
        return next(
          new AppError(429, "RATE_LIMIT", "请求过于频繁，请稍后重试"),
        );
      }
      next();
    };
  const apiLimit = limit("api", 300, 60000);
  app.use("/api", (req, res, next) =>
    ["/health", "/ready"].includes(req.path)
      ? next()
      : apiLimit(req, res, next),
  );
  const cookie = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: production,
    path: "/",
    maxAge: 7 * 86400000,
  };
  app.get("/api/config", async (_req, res) =>
    res.json({
      adapter: adapter.mode,
      environment: options.environment ?? "mock",
      registrationEnabled: false,
      bookingRequiresLogin: true,
      demo,
      paused:
        await db.setting("paused") === "true" ||
        await db.setting("booking_enabled") !== "true",
      syncEnabled: await db.setting("sync_enabled") === "true",
      writesEnabled:
        adapter.mode === "mock" ||
        (adapter.mode === "official" &&
          adapter.diagnostics?.().writeConfigured === true),
      timezone: "Asia/Shanghai",
      horizon: service.bookingHorizon,
      rulesSource: adapter.rulesSource,
    }),
  );
  app.get("/api/health", async (_req, res) => {
    await db.get("SELECT 1");
    res.json({
      status: "ok",
      adapter: adapter.mode,
      paused: await db.setting("paused") === "true",
    });
  });
  app.get("/api/ready", async (_req, res) => {
    const status = await operationalStatus(db, adapter);
    res
      .status(status.ready ? 200 : 503)
      .json({ status: status.ready ? "ready" : "degraded" });
  });
  app.get("/api/auth/me", (_req, res: AuthResponse) =>
    res.json({ user: res.locals.user ?? null, csrf: res.locals.csrf ?? null }),
  );
  app.use("/api/auth", (_req, _res, next) => options.communityIdentitySecret
    ? next(new AppError(410, "COMMUNITY_AUTH", "请在 COEER 个人资料中管理账号，空间预约共用社区身份"))
    : next());
  app.post("/api/auth/register", limit("register", 10, 3600000), () => {
    throw new AppError(
      403,
      "REGISTRATION_CLOSED",
      "仅限白名单用户登录，请联系管理员开通",
    );
  });
  const dummyHash = await hashPassword(randomUUID());
  app.post(
    "/api/auth/login",
    limit("login", 30, 60000),
    async (req, res: AuthResponse) => {
      const input = parse(
        z.strictObject({
          studentId: studentIdSchema,
          password: z.string().min(1).max(128),
        }),
        req.body,
      );
      const row = await db.get<{ id: string; password_hash: string }>(
        "SELECT u.id,u.password_hash FROM users u JOIN user_accounts a ON a.user_id=u.id WHERE a.student_id=?",
        input.studentId,
      );
      const valid = await checkPassword(
        input.password,
        row?.password_hash ?? dummyHash,
      );
      const current = row && await accounts.user(row.id);
      if (!row || !valid || !current)
        throw new AppError(
          401,
          "LOGIN_FAILED",
          "学号或密码不正确，或账号尚未获准登录",
        );
      const result = await db.tx(async () => {
        // A permission removal or password change during scrypt must not issue a fresh session.
        if (
          !await accounts.user(row.id) ||
          (await db.get<{ password_hash: string }>(
            "SELECT password_hash FROM users WHERE id=?",
            row.id,
          ))?.password_hash !== row.password_hash
        )
          throw new AppError(401, "LOGIN_FAILED", "账号状态已变化，请重试");
        const old = req.cookies?.openspace_session;
        if (typeof old === "string")
          await db.run("DELETE FROM sessions WHERE digest=?", digest(old));
        const next = await newSession(db, row.id);
        await db.audit(row.id, "auth.login", row.id);
        return next;
      });
      res.cookie("openspace_session", result.token, cookie);
      res.clearCookie("openspace_visitor", { ...cookie, maxAge: undefined });
      res.json({ user: current, csrf: result.csrf });
    },
  );
  app.post(
    "/api/auth/password",
    auth,
    csrf,
    limit("password_change", 10, 60000),
    async (req, res: AuthResponse) => {
      const input = parse(
        z.strictObject({
          currentPassword: z.string().min(1).max(128),
          newPassword: password,
        }),
        req.body,
      );
      const userId = res.locals.user!.id;
      const row = (await db.get<{ password_hash: string }>(
        "SELECT password_hash FROM users WHERE id=?",
        userId,
      ))!;
      if (!(await checkPassword(input.currentPassword, row.password_hash)))
        throw new AppError(400, "PASSWORD_INCORRECT", "当前密码不正确");
      if (input.currentPassword === input.newPassword)
        throw new AppError(
          400,
          "PASSWORD_UNCHANGED",
          "新密码不能与当前密码相同",
        );
      const hash = await hashPassword(input.newPassword);
      const next = await db.tx(async () => {
        if (
          !await accounts.user(userId) ||
          (await db.get<{ password_hash: string }>(
            "SELECT password_hash FROM users WHERE id=?",
            userId,
          ))?.password_hash !== row.password_hash
        )
          throw new AppError(
            409,
            "ACCOUNT_CHANGED",
            "账号状态已变化，请重新登录",
          );
        await db.run("UPDATE users SET password_hash=? WHERE id=?", hash, userId);
        await db.run(
          "UPDATE user_accounts SET password_changed_at=? WHERE user_id=?",
          Date.now(),
          userId,
        );
        await db.run("DELETE FROM sessions WHERE user_id=?", userId);
        await db.audit(userId, "auth.password_changed", userId);
        return newSession(db, userId);
      });
      res.cookie("openspace_session", next.token, cookie);
      res.json({ user: await accounts.user(userId), csrf: next.csrf });
    },
  );
  app.post("/api/auth/logout", auth, csrf, async (req, res: AuthResponse) => {
    await db.run(
      "DELETE FROM sessions WHERE digest=?",
      digest(req.cookies.openspace_session),
    );
    res.clearCookie("openspace_session", { ...cookie, maxAge: undefined });
    res.json({ ok: true });
  });
  app.get("/api/spaces", async (_req, res) => res.json(await service.spaces()));
  app.get("/api/spaces/:id", async (req, res) => {
    const s = await service.space(String(req.params.id));
    if (!s.published || !service.canPublish(s))
      throw new AppError(404, "NOT_FOUND", "空间不存在");
    res.json(service.publicSpace(s));
  });
  app.get("/api/spaces/:id/availability", async (req, res) =>
    res.json(
      await service.availability(String(req.params.id), String(req.query.date ?? "")),
    ),
  );
  app.get("/api/bookings", bookingAuth, async (_req, res: AuthResponse) =>
    res.json(await service.list(bookingOwner(res))),
  );
  app.get("/api/bookings/:id", bookingAuth, async (req, res: AuthResponse) =>
    res.json(
      await service.project(
        await service.owned(String(req.params.id), bookingOwner(res)),
        true,
        false,
        true,
      ),
    ),
  );
  app.post(
    "/api/bookings",
    bookingAuth,
    csrf,
    limit("booking", 60, 60000),
    async (req, res: AuthResponse) => {
      const { applicantName, studentId, ...input } = parse(
          createSchema,
          req.body,
        ),
        key = req.header("Idempotency-Key");
      if (!key || !/^[-A-Za-z0-9]{16,80}$/.test(key))
        throw new AppError(400, "IDEMPOTENCY_KEY", "缺少有效的申请标识");
      const user = res.locals.user!;
      if (!user.studentId)
        throw new AppError(403, "STUDENT_ID_REQUIRED", "此管理员账号未关联学生学号，请使用学生账号提交预约");
      if (
        (studentId && studentId !== user.studentId) ||
        (applicantName && applicantName !== user.name)
      )
        throw new AppError(
          403,
          "IDENTITY_MISMATCH",
          "预约身份必须与当前登录账号一致",
        );
      res.status(201).json(
        await service.create(user.id, input, key, {
          applicantName: user.name,
          studentId: user.studentId!,
        }),
      );
    },
  );
  app.post(
    "/api/bookings/:id/cancel",
    bookingAuth,
    csrf,
    limit("cancel", 30, 60000),
    async (req, res: AuthResponse) => {
      parse(z.strictObject({}), req.body);
      res.json(await service.cancel(String(req.params.id), bookingOwner(res)));
    },
  );
  app.use("/api/admin", auth, admin);
  // Page the retained history; active work is never removed by history cleanup.
  for (const kind of ["jobs", "sync-runs", "audit"] as const) {
    app.get(`/api/admin/history/${kind}`, async (req, res) => {
      const { page, size, state, q } = parse(
        z.object({
          page: z.coerce.number().int().min(1).max(1000000).default(1),
          size: z.coerce.number().int().min(1).max(50).default(10),
          state: z.string().max(80).default(""),
          q: z.string().trim().max(80).default(""),
        }),
        req.query,
      );
      const table = kind === "sync-runs" ? "sync_runs" : kind;
      const column =
        kind === "jobs" ? "state" : kind === "audit" ? "action" : "status";
      const conditions: string[] = [];
      const args: (string | number)[] = [];
      if (state) {
        conditions.push(`t.${column}=?`);
        args.push(state);
      }
      if (q) {
        const fields =
          kind === "audit"
            ? ["t.action", "t.entity_id", "u.name"]
            : kind === "jobs"
              ? ["t.type", "CAST(t.id AS TEXT)", "t.booking_id", "t.error_code"]
              : ["t.error_code", "t.id"];
        const clauses = fields.map((f) => `${f} LIKE ?`);
        args.push(...fields.map(() => `%${q}%`));
        const labels =
          kind === "audit" ? auditActions : kind === "jobs" ? jobTypes : {};
        const matchingCodes = Object.entries(labels)
          .filter(([, label]) => label.includes(q))
          .map(([code]) => code);
        if (matchingCodes.length) {
          clauses.push(
            `t.${kind === "audit" ? "action" : "type"} IN (${matchingCodes.map(() => "?").join(",")})`,
          );
          args.push(...matchingCodes);
        }
        conditions.push(`(${clauses.join(" OR ")})`);
      }
      const from = `${table} t${kind === "audit" ? " LEFT JOIN users u ON u.id=t.actor" : ""}`;
      const where = conditions.length
        ? ` WHERE ${conditions.join(" AND ")}`
        : "";
      const total = (await db.get<{ total: number }>(
        `SELECT COUNT(*) total FROM ${from}${where}`,
        ...args,
      ))!.total;
      const current = Math.min(page, Math.max(1, Math.ceil(total / size)));
      const order =
        kind === "sync-runs" ? "t.started_at DESC,t.id DESC" : "t.id DESC";
      const rows = await db.all(
        `SELECT t.*${kind === "audit" ? ",u.name actor_name" : ""} FROM ${from}${where} ORDER BY ${order} LIMIT ? OFFSET ?`,
        ...args,
        size,
        (current - 1) * size,
      );
      res.json({ items: rows, total, page: current, size });
    });
  }
  app.get("/api/admin/overview", async (_req, res) =>
    res.json({
      spaces: await service.spaces(true),
      bookings: await service.list(),
      allowlist: await accounts.list(),
      jobs: await db.all(
        "SELECT id,type,booking_id,state,run_at,attempts,error_code FROM jobs ORDER BY id DESC LIMIT 100",
      ),
      syncRuns: await db.all(
        "SELECT * FROM sync_runs ORDER BY started_at DESC LIMIT 30",
      ),
      audit: await db.all("SELECT * FROM audit ORDER BY id DESC LIMIT 100"),
      paused: await db.setting("paused") === "true",
      adapter: adapter.mode,
      scenarios:
        adapter instanceof MockAdapter
          ? await db.all("SELECT * FROM mock_scenarios")
          : [],
      mockSyncFailure: await db.setting("mock_sync_failure") === "true",
      syncEnabled: await db.setting("sync_enabled") === "true",
      bookingEnabled: await db.setting("booking_enabled") === "true",
      adapterDiagnostics: adapter.diagnostics?.() ?? { mode: adapter.mode },
      environment: options.environment ?? "mock",
      operations: await operationalStatus(db, adapter),
      alerts: await db.all("SELECT * FROM alerts ORDER BY id DESC LIMIT 50"),
    }),
  );
  app.put(
    "/api/admin/allowlist/:studentId",
    csrf,
    async (req, res: AuthResponse) => {
      const studentId = parse(studentIdSchema, String(req.params.studentId));
      const { bookingPermission } = parse(
        z.strictObject({
          bookingPermission: z
            .enum(["allowed", "review", "blocked"])
            .optional(),
        }),
        req.body,
      );
      try {
        await accounts.save(studentId, undefined, bookingPermission);
      } catch (e) {
        if ((e as Error).message === "ADMIN_STUDENT_ID")
          throw new AppError(409, "ADMIN_STUDENT_ID", "该学号已用于管理员账号");
        throw e;
      }
      await db.audit(res.locals.user!.id, "allowlist.save", digest(studentId), {
        bookingPermission,
      });
      res.json({ ok: true });
    },
  );
  app.delete(
    "/api/admin/allowlist/:studentId",
    csrf,
    async (req, res: AuthResponse) => {
      const studentId = parse(studentIdSchema, String(req.params.studentId));
      parse(z.strictObject({}), req.body);
      await accounts.remove(studentId);
      await db.audit(res.locals.user!.id, "allowlist.remove", digest(studentId));
      res.json({ ok: true });
    },
  );
  app.post(
    "/api/admin/allowlist/:studentId/reset-password",
    csrf,
    async (req, res: AuthResponse) => {
      if (options.communityIdentitySecret)
        throw new AppError(410, "COMMUNITY_AUTH", "请在 COEER 个人资料中修改账号密码");
      const studentId = parse(studentIdSchema, String(req.params.studentId));
      parse(z.strictObject({}), req.body);
      if (!(await accounts.resetPassword(studentId)))
        throw new AppError(404, "NOT_FOUND", "白名单用户不存在");
      await db.audit(
        res.locals.user!.id,
        "account.password_reset",
        digest(studentId),
      );
      res.json({ ok: true });
    },
  );
  app.post("/api/admin/bookings/:id/cancel", csrf, async (req, res: AuthResponse) => {
    parse(z.strictObject({}), req.body);
    const b = await service.booking(String(req.params.id));
    const cancelled = await service.cancel(b.id, b.user_id);
    await db.audit(res.locals.user!.id, "admin.booking_cancel", b.id);
    res.json(cancelled);
  });
  app.post("/api/admin/bookings/:id/review", csrf, async (req, res: AuthResponse) => {
    const { decision } = parse(
      z.strictObject({ decision: z.enum(["approve", "reject"]) }),
      req.body,
    );
    res.json(
      await service.review(String(req.params.id), res.locals.user!.id, decision),
    );
  });
  app.post("/api/admin/alerts/:id/ack", csrf, async (req, res: AuthResponse) => {
    parse(z.strictObject({}), req.body);
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1)
      throw new AppError(400, "VALIDATION", "告警编号无效");
    await db.tx(async () => {
      await db.run(
        "UPDATE alerts SET ack_at=?,ack_by=? WHERE id=? AND ack_at IS NULL",
        Date.now(),
        res.locals.user!.id,
        id,
      );
      await db.audit(res.locals.user!.id, "alert.acknowledged", String(id));
    });
    res.json({ ok: true });
  });
  app.post(
    "/api/admin/connector/check",
    csrf,
    limit("connector_check", 2, 60000),
    async (req, res: AuthResponse) => {
      parse(z.strictObject({}), req.body);
      if (!adapter.checkConnection)
        throw new AppError(409, "UNSUPPORTED", "当前未启用官方连接器");
      // Serialize a recovery probe with worker operations. Recovery never enables writes.
      if (
        connectorChecking ||
        await db.get("SELECT id FROM jobs WHERE state='running'")
      )
        throw new AppError(409, "CONNECTOR_BUSY", "任务正在运行，请稍后检查");
      connectorChecking = true;
      await db.set("paused", "true");
      await db.audit(res.locals.user!.id, "connector.check", "system");
      try {
        const result = await adapter.checkConnection({
          signal: AbortSignal.timeout(adapter.operationTimeoutMs ?? 120000),
        });
        for (const b of await db.all<{ id: string }>(
          "SELECT id FROM bookings WHERE provider='official' AND official_ref IS NOT NULL AND status IN ('uncertain','cancel_uncertain','manual_review')",
        ))
          await service.enqueue("reconcile", b.id);
        res.json(result);
      } catch (e) {
        await db.alert("CONNECTOR_CHECK_FAILED");
        throw e;
      } finally {
        connectorChecking = false;
      }
    },
  );
  app.patch("/api/admin/spaces/:id", csrf, async (req, res: AuthResponse) => {
    if (service.followsUpstream)
      throw new AppError(409, "UPSTREAM_CATALOG", "空间展示、权限和预约规则由官方系统同步，请在官方系统调整");
    const input = parse(
        z.strictObject({
          published: z.boolean().optional(),
          bookable: z.boolean().optional(),
          name: z.string().trim().min(2).max(80).optional(),
          description: z.string().trim().min(2).max(500).optional(),
        }),
        req.body,
      ),
      id = String(req.params.id);
    const s = await service.space(id);
    if (input.published && !service.canPublish(s))
      throw new AppError(
        403,
        "PUBLICATION_REQUIRED",
        "该空间没有有效的公开审批配置",
      );
    if (
      s.provider === "official" &&
      (input.name !== undefined || input.description !== undefined)
    )
      throw new AppError(
        409,
        "PUBLICATION_MANIFEST",
        "官方空间公开资料由获准的配置文件管理",
      );
    if (
      s.provider === "official" &&
      input.bookable &&
      (s.permission !== "allowed" ||
        JSON.parse(s.policy).rulesVerified !== true)
    )
      throw new AppError(
        409,
        "RULES_UNVERIFIED",
        "当前账号权限或预约规则尚未核实",
      );
    await db.tx(async () => {
      for (const [key, value] of Object.entries(input))
        await db.run(
          `UPDATE spaces SET ${key}=? WHERE id=?`,
          typeof value === "boolean" ? Number(value) : value,
          id,
        );
      await db.audit(res.locals.user!.id, "space.update", id, {
        fields: Object.keys(input),
      });
      await service.enqueue("sync");
    });
    res.json(service.publicSpace(await service.space(id), true));
  });
  app.patch("/api/admin/settings", csrf, async (req, res: AuthResponse) => {
    const input = parse(
        z.strictObject({
          paused: z.boolean().optional(),
          syncEnabled: z.boolean().optional(),
          bookingEnabled: z.boolean().optional(),
        }),
        req.body,
      ),
      paused = input.paused;
    if (paused === false && adapter.mode === "official") {
      const state = adapter.diagnostics?.().connector as {
        authentication?: string;
      };
      if (
        state.authentication !== "healthy" &&
        state.authentication !== "externally_managed"
      )
        throw new AppError(
          409,
          "CONNECTOR_UNHEALTHY",
          "请先完成合法认证和连接检查",
        );
    }
    await db.tx(async () => {
      if (paused !== undefined) await db.set("paused", String(paused));
      if (input.syncEnabled !== undefined)
        await db.set("sync_enabled", String(input.syncEnabled));
      if (input.bookingEnabled !== undefined)
        await db.set("booking_enabled", String(input.bookingEnabled));
      await db.audit(
        res.locals.user!.id,
        paused === undefined
          ? "automation.settings"
          : paused
            ? "automation.pause"
            : "automation.resume",
        "system",
        { fields: Object.keys(input) },
      );
    });
    res.json({ paused });
  });
  app.post("/api/admin/sync", csrf, async (_req, res: AuthResponse) => {
    if (await db.setting("sync_enabled") !== "true")
      throw new AppError(409, "SYNC_PAUSED", "同步已暂停");
    await service.enqueue("sync");
    await db.audit(res.locals.user!.id, "sync.request", "system");
    res.status(202).json({ ok: true });
  });
  app.post(
    "/api/admin/bookings/:id/reconcile",
    csrf,
    async (req, res: AuthResponse) => {
      const id = String(req.params.id);
      await service.booking(id);
      await service.enqueue("reconcile", id);
      await db.audit(res.locals.user!.id, "booking.reconcile", id);
      res.status(202).json({ ok: true });
    },
  );
  app.patch("/api/admin/mock/scenario/:id", csrf, async (req, res: AuthResponse) => {
    if (!(adapter instanceof MockAdapter))
      throw new AppError(409, "MOCK_ONLY", "仅模拟模式可用");
    const id = String(req.params.id);
    await service.space(id);
    const { scenario } = parse(
      z.strictObject({ scenario: z.enum(scenarios) }),
      req.body,
    );
    await db.run(
      "INSERT INTO mock_scenarios VALUES(?,?) ON CONFLICT(space_id) DO UPDATE SET scenario=excluded.scenario",
      id,
      scenario,
    );
    await db.audit(res.locals.user!.id, "mock.scenario", id, { scenario });
    res.json({ ok: true });
  });
  app.patch("/api/admin/mock/sync", csrf, async (req, res: AuthResponse) => {
    if (!(adapter instanceof MockAdapter))
      throw new AppError(409, "MOCK_ONLY", "仅模拟模式可用");
    const { failure } = parse(
      z.strictObject({ failure: z.boolean() }),
      req.body,
    );
    await db.set("mock_sync_failure", String(failure));
    await db.audit(res.locals.user!.id, "mock.sync", "system", { failure });
    await service.enqueue("sync");
    res.json({ ok: true });
  });
  app.post(
    "/api/admin/bookings/:id/official-link",
    csrf,
    async (req, res: AuthResponse) => {
      if (!adapter.attachReference)
        throw new AppError(409, "OFFICIAL_ONLY", "仅真实接入模式可用");
      const { officialRef, note } = parse(
          z.strictObject({
            officialRef: z.string().regex(/^[-A-Za-z0-9_.:]{1,128}$/),
            note: z.string().trim().min(8).max(200),
          }),
          req.body,
        ),
        b = await service.booking(String(req.params.id)),
        s = await service.space(b.space_id);
      if (
        b.provider !== "official" ||
        !["manual_review", "uncertain"].includes(b.status)
      )
        throw new AppError(
          409,
          "LINK_STATE",
          "仅可核对本模式中结果不明确的申请",
        );
      await adapter.attachReference(
        {
          requestId: b.id,
          spaceId: b.space_id,
          module: s.module,
          date: b.date,
          start: b.start,
          end: b.end,
          quantity: b.quantity,
          externalUserId: b.submission_user_id ?? b.user_id,
          purpose: b.purpose,
        },
        officialRef,
        { signal: AbortSignal.timeout(adapter.operationTimeoutMs ?? 120000) },
      );
      await service.enqueue("reconcile", b.id);
      // A free-text reason may accidentally contain official personal data; audit only its presence.
      await db.audit(res.locals.user!.id, "official.link_verified", b.id, {
        evidenceProvided: note.length >= 8,
      });
      res.status(202).json({ ok: true });
    },
  );
  app.post(
    "/api/admin/mock/bookings/:id/decision",
    csrf,
    async (req, res: AuthResponse) => {
      if (!(adapter instanceof MockAdapter))
        throw new AppError(409, "MOCK_ONLY", "仅模拟模式可用");
      const { decision } = parse(
          z.strictObject({ decision: z.enum(["approve", "reject", "cancel"]) }),
          req.body,
        ),
        b = await service.booking(String(req.params.id));
      if (!b.official_ref || !await adapter.decide(b.official_ref, decision))
        throw new AppError(409, "DECISION", "当前模拟记录无法执行该操作");
      await service.enqueue("reconcile", b.id);
      await db.audit(res.locals.user!.id, "mock.decision", b.id, { decision });
      res.json({ ok: true });
    },
  );
  app.post(
    "/api/admin/mock/bookings/:id/resolve",
    csrf,
    async (req, res: AuthResponse) => {
      if (!(adapter instanceof MockAdapter))
        throw new AppError(409, "MOCK_ONLY", "仅模拟模式可用");
      const { note } = parse(
          z.strictObject({ note: z.string().trim().min(8).max(200) }),
          req.body,
        ),
        b = await service.booking(String(req.params.id));
      if (
        !["manual_review", "uncertain"].includes(b.status) ||
        (await adapter.findByRequest(b.id))
      )
        throw new AppError(
          409,
          "RESOLUTION",
          "无法证明模拟记录未创建，请先核对",
        );
      await db.tx(async () => {
        await service.setStatus(
          b.id,
          "failed",
          "管理员已核对模拟系统，本次申请未创建",
        );
        await db.audit(res.locals.user!.id, "mock.resolve_not_created", b.id, {
          note,
        });
      });
      res.json({ ok: true });
    },
  );
  app.use("/api", (_req, _res, next) =>
    next(new AppError(404, "NOT_FOUND", "接口不存在")),
  );
  const client = join(process.cwd(), "dist/client");
  if (options.serveClient !== false && existsSync(join(client, "index.html"))) {
    app.use(express.static(client));
    app.get("/{*path}", (_req, res) =>
      res.sendFile(join(client, "index.html")),
    );
  }
  app.use(
    (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
      if (error instanceof AppError)
        return res
          .status(error.status)
          .json({ error: { code: error.code, message: error.message } });
      if (error instanceof AdapterError)
        return res
          .status(
            error.code === "AUTHORIZATION_REQUIRED" ||
              error.code === "FORBIDDEN"
              ? 403
              : 409,
          )
          .json({
            error: {
              code: error.code,
              message:
                error.code === "AUTHORIZATION_REQUIRED"
                  ? "该操作缺少有效的账号、空间、日期或申请人授权"
                  : "官方结果暂无法确认，请由管理员核对",
            },
          });
      if (error instanceof SyntaxError)
        return res
          .status(400)
          .json({ error: { code: "JSON", message: "请求格式无效" } });
      const status = (error as { status?: number })?.status;
      if (status === 413)
        return res
          .status(413)
          .json({ error: { code: "PAYLOAD_SIZE", message: "请求内容过大" } });
      // Never log request headers, raw adapter errors, body or user data.
      res.status(500).json({
        error: { code: "INTERNAL", message: "操作暂未完成，请稍后重试" },
      });
    },
  );
  function startWorker(interval = 800) {
    const cleanupHistory = async () => {
      try {
        await pruneHistory(db);
      } catch {
        await db.audit("system", "worker.error", "system", {
          code: "HISTORY_CLEANUP_FAILED",
        }).catch(() => undefined);
      }
    };
    let historyTask = cleanupHistory();
    // Separate from upstream work so failures, pauses and slow syncs cannot stop retention.
    const historyTimer = setInterval(() => {
      historyTask = historyTask.then(cleanupHistory);
    }, 60000);
    historyTimer.unref();
    let busy = false;
    let lastMonitor = 0;
    let initialSync = options.deferInitialSync && !demo;
    const timer = setInterval(() => {
      if (busy || connectorChecking) return;
      busy = true;
      void (async () => {
        try {
          if (initialSync) {
            initialSync = false;
            if (await db.setting("sync_enabled") === "true") await service.sync();
          } else {
            await service.schedule();
            await service.runOne();
          }
          if (Date.now() - lastMonitor >= 60000) {
            await monitor(db, adapter);
            lastMonitor = Date.now();
          }
          await db.run("DELETE FROM sessions WHERE expires_at<?", Date.now());
        } catch {
          await db.audit("system", "worker.error", "system", {
            code: "WORKER_ERROR",
          }).catch(() => undefined);
        } finally {
          busy = false;
        }
      })();
    }, interval);
    timer.unref();
    return async () => {
      clearInterval(historyTimer);
      clearInterval(timer);
      await historyTask;
      while (busy) await new Promise((resolve) => setTimeout(resolve, 20));
    };
  }
  return { app, db, adapter, service, startWorker };
}
