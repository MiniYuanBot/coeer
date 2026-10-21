import { randomUUID } from "node:crypto";
import { DB } from "./db.js";
import { hashPassword } from "./auth.js";
import type { BookingPermission, User } from "@shared/open-space/domain.js";
import { studentIdFromEmail, type CommunityIdentity } from "./coeer-identity.js";

export const defaultStudentPassword = (studentId: string) =>
  `${studentId}@114514`;
export interface AccountRow {
  user_id: string;
  student_id: string;
  booking_permission: BookingPermission;
  enabled: number;
  password_changed_at: number | null;
}
export class Accounts {
  constructor(readonly db: DB) {}
  /** Mirror trusted community identity while retaining historical student booking ownership. */
  async communityUser(identity: CommunityIdentity): Promise<User | null> {
    const studentId = studentIdFromEmail(identity.email);
    const role = identity.role === "admin" ? "admin" : "user";
    if (role !== "admin" && !studentId) return null;
    return this.db.tx(async () => {
      const existing = (studentId && role !== "admin"
        ? await this.db.get<{ user_id: string }>("SELECT user_id FROM user_accounts WHERE student_id=?", studentId)
        : undefined) ?? await this.db.get<{ user_id: string }>("SELECT id AS user_id FROM users WHERE email=?", identity.email);
      const id = existing?.user_id ?? `coeer:${identity.id}`;
      await this.db.run(
        "INSERT INTO users VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email,name=excluded.name,role=excluded.role",
        id, identity.email, identity.name, `community:${randomUUID()}`, role,
      );
      if (studentId && role !== "admin") {
        await this.db.run(
          "INSERT INTO user_accounts VALUES(?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET enabled=1",
          id, studentId, "allowed", 1, Date.now(),
        );
      }
      const account = await this.user(id);
      return account ?? { id, email: identity.email, name: identity.name, role, studentId, bookingPermission: "blocked" };
    });
  }
  async user(id: string): Promise<User | undefined> {
    const row = await this.db.get<User>(
      `SELECT u.id,u.email,u.name,u.role,a.student_id AS studentId,a.booking_permission AS bookingPermission,
      (a.password_changed_at IS NULL AND u.role='user') AS passwordIsDefault
      FROM users u LEFT JOIN user_accounts a ON a.user_id=u.id
      WHERE u.id=? AND (u.role='admin' OR (a.enabled=1 AND EXISTS(SELECT 1 FROM booking_allowlist w WHERE w.student_id=a.student_id)))`,
      id,
    );
    return row
      ? { ...row, studentId: row.studentId ?? studentIdFromEmail(row.email), bookingPermission: row.role === "admin" ? "allowed" : row.bookingPermission, passwordIsDefault: false }
      : undefined;
  }
  list() {
    return this.db
      .all(`SELECT w.student_id AS studentId,COALESCE(NULLIF(u.name,''),NULLIF(w.name,''),'尚未注册') AS name,w.updated_at AS updatedAt,
      COALESCE(a.booking_permission,'allowed') AS bookingPermission,
      (a.password_changed_at IS NULL) AS passwordIsDefault
      FROM booking_allowlist w LEFT JOIN user_accounts a ON a.student_id=w.student_id LEFT JOIN users u ON u.id=a.user_id ORDER BY w.updated_at DESC`);
  }
  async save(studentId: string, name = "", permission?: BookingPermission) {
    const existing = await this.db.get<{ id: string; role: string }>(
      "SELECT u.id,u.role FROM users u JOIN user_accounts a ON a.user_id=u.id WHERE a.student_id=?",
      studentId,
    );
    if (existing?.role === "admin") throw new Error("ADMIN_STUDENT_ID");
    const passwordHash = existing
      ? undefined
      : await hashPassword(defaultStudentPassword(studentId));
    await this.db.tx(async () => {
      // Re-read after async hashing: another admin may have created this account meanwhile.
      const current = await this.db.get<{ user_id: string; role: string }>(
        "SELECT a.user_id,u.role FROM user_accounts a JOIN users u ON u.id=a.user_id WHERE a.student_id=?",
        studentId,
      );
      if (current?.role === "admin") throw new Error("ADMIN_STUDENT_ID");
      if (!current) {
        const id = randomUUID();
        await this.db.run(
          "INSERT INTO users VALUES(?,?,?,?,?)",
          id,
          `${studentId}@students.openspace.invalid`,
          name,
          passwordHash!,
          "user",
        );
        await this.db.run(
          "INSERT INTO user_accounts VALUES(?,?,?,?,?)",
          id,
          studentId,
          permission ?? "allowed",
          1,
          null,
        );
      } else {
        await this.db.run(
          "UPDATE user_accounts SET enabled=1,booking_permission=COALESCE(?,booking_permission) WHERE user_id=?",
          permission ?? null,
          current.user_id,
        );
      }
      await this.db.run(
        "INSERT INTO booking_allowlist VALUES(?,?,?) ON CONFLICT(student_id) DO UPDATE SET name=excluded.name,updated_at=excluded.updated_at",
        studentId,
        name,
        Date.now(),
      );
    });
  }
  async remove(studentId: string) {
    await this.db.tx(async () => {
      await this.db.run(
        "DELETE FROM sessions WHERE user_id IN (SELECT user_id FROM user_accounts WHERE student_id=? AND user_id IN (SELECT id FROM users WHERE role='user'))",
        studentId,
      );
      await this.db.run(
        "UPDATE user_accounts SET enabled=0 WHERE student_id=? AND user_id IN (SELECT id FROM users WHERE role='user')",
        studentId,
      );
      await this.db.run(
        "DELETE FROM booking_allowlist WHERE student_id=?",
        studentId,
      );
    });
  }
  async resetPassword(studentId: string) {
    const hash = await hashPassword(defaultStudentPassword(studentId));
    return this.db.tx(async () => {
      const row = await this.db.get<{ user_id: string }>(
        "SELECT a.user_id FROM user_accounts a JOIN users u ON u.id=a.user_id JOIN booking_allowlist w ON w.student_id=a.student_id WHERE a.student_id=? AND u.role='user' AND a.enabled=1",
        studentId,
      );
      if (!row) return false;
      await this.db.run(
        "UPDATE users SET password_hash=? WHERE id=?",
        hash,
        row.user_id,
      );
      await this.db.run(
        "UPDATE user_accounts SET password_changed_at=NULL WHERE user_id=?",
        row.user_id,
      );
      await this.db.run("DELETE FROM sessions WHERE user_id=?", row.user_id);
      return true;
    });
  }
}
export type AccountState = {
  users: {
    id: string;
    email: string;
    name: string;
    password_hash: string;
    role: string;
  }[];
  accounts: AccountRow[];
  allowlist: { student_id: string; name: string; updated_at: number }[];
  loginEnabled: string;
};
export async function exportAccountState(db: DB): Promise<AccountState> {
  return {
    users: await db.all("SELECT * FROM users"),
    accounts: await db.all("SELECT * FROM user_accounts"),
    allowlist: await db.all("SELECT * FROM booking_allowlist"),
    loginEnabled: await db.setting("account_login_enabled", "false"),
  };
}
/** Restore authentication only; never roll back booking, binding, event or job tables. */
export async function restoreAccountState(db: DB, state: AccountState) {
  await db.tx(async () => {
    await db.run("DELETE FROM sessions");
    await db.run("DELETE FROM user_accounts");
    await db.run("DELETE FROM booking_allowlist");
    for (const w of state.allowlist)
      await db.run(
        "INSERT INTO booking_allowlist VALUES(?,?,?)",
        w.student_id,
        w.name,
        w.updated_at,
      );
    await db.set("account_login_enabled", state.loginEnabled);
    const ids = new Set(state.users.map((u) => u.id));
    for (const row of await db.all<{ id: string }>("SELECT id FROM users")) {
      if (ids.has(row.id)) continue;
      if (!await db.get("SELECT id FROM bookings WHERE user_id=?", row.id))
        await db.run("DELETE FROM users WHERE id=?", row.id);
      else
        await db.run(
          "UPDATE users SET password_hash=?,role='user' WHERE id=?",
          `disabled:${randomUUID()}`,
          row.id,
        );
    }
    for (const u of state.users)
      await db.run(
        "INSERT INTO users VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email,name=excluded.name,password_hash=excluded.password_hash,role=excluded.role",
        u.id,
        u.email,
        u.name,
        u.password_hash,
        u.role,
      );
    for (const a of state.accounts)
      await db.run(
        "INSERT INTO user_accounts VALUES(?,?,?,?,?)",
        a.user_id,
        a.student_id,
        a.booking_permission,
        a.enabled,
        a.password_changed_at,
      );
  });
}
/** Explicit deployment operation; provision the administrator and retire earlier login identities. */
export async function activateAccounts(
  db: DB,
  admin: { studentId: string; passwordHash: string },
) {
  const accounts = new Accounts(db);
  for (const entry of await db.all<{ student_id: string; name: string }>(
    "SELECT student_id,name FROM booking_allowlist WHERE student_id<>?",
    admin.studentId,
  ))
    await accounts.save(entry.student_id, entry.name);
  const disabledHash = await hashPassword(randomUUID());
  return db.tx(async () => {
    await db.run("DELETE FROM sessions");
    await db.run("DELETE FROM booking_allowlist WHERE student_id=?", admin.studentId);
    const current = await db.get<AccountRow>(
      "SELECT * FROM user_accounts WHERE student_id=?",
      admin.studentId,
    );
    const adminId = current?.user_id ?? randomUUID();
    if (!current) {
      await db.run(
        "INSERT INTO users VALUES(?,?,?,?,?)",
        adminId,
        `${admin.studentId}@admins.openspace.invalid`,
        "管理员",
        admin.passwordHash,
        "admin",
      );
      await db.run(
        "INSERT INTO user_accounts VALUES(?,?,?,?,?)",
        adminId,
        admin.studentId,
        "allowed",
        1,
        Date.now(),
      );
    } else {
      await db.run(
        "UPDATE users SET password_hash=?,role='admin',name='管理员' WHERE id=?",
        admin.passwordHash,
        adminId,
      );
      await db.run(
        "UPDATE user_accounts SET enabled=1,booking_permission='allowed',password_changed_at=? WHERE user_id=?",
        Date.now(),
        adminId,
      );
    }
    let deleted = 0,
      archived = 0;
    for (const u of await db.all<{ id: string }>(
      "SELECT id FROM users WHERE id<>?",
      adminId,
    )) {
      const a = await accounts.user(u.id);
      if (a?.role === "user") continue;
      await db.run("DELETE FROM user_accounts WHERE user_id=?", u.id);
      if (!await db.get("SELECT id FROM bookings WHERE user_id=?", u.id)) {
        await db.run("DELETE FROM users WHERE id=?", u.id);
        deleted++;
      } else {
        await db.run(
          "UPDATE users SET password_hash=?,role='user' WHERE id=?",
          disabledHash,
          u.id,
        );
        archived++;
      }
    }
    await db.set("account_login_enabled", "true");
    await db.audit("system", "accounts.activated", "system", { deleted, archived });
    return {
      deleted,
      archived,
      activeUsers: (await db.get<{ n: number }>(
        "SELECT COUNT(*) AS n FROM user_accounts WHERE enabled=1",
      ))!.n,
    };
  });
}
