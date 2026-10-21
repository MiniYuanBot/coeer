import { randomUUID } from "node:crypto";
import { DB } from "./db.js";
import { hashPassword } from "./auth.js";
import type { BookingPermission, User } from "@shared/open-space/domain.js";

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
  user(id: string): User | undefined {
    const row = this.db.get<User>(
      `SELECT u.id,u.email,u.name,u.role,a.student_id AS studentId,a.booking_permission AS bookingPermission,
      (a.password_changed_at IS NULL AND u.role='user') AS passwordIsDefault
      FROM users u JOIN user_accounts a ON a.user_id=u.id
      WHERE u.id=? AND a.enabled=1 AND (u.role='admin' OR EXISTS(SELECT 1 FROM booking_allowlist w WHERE w.student_id=a.student_id))`,
      id,
    );
    return row
      ? { ...row, passwordIsDefault: !!row.passwordIsDefault }
      : undefined;
  }
  list() {
    return this.db
      .all(`SELECT w.student_id AS studentId,w.name,w.updated_at AS updatedAt,
      COALESCE(a.booking_permission,'allowed') AS bookingPermission,
      (a.password_changed_at IS NULL) AS passwordIsDefault
      FROM booking_allowlist w LEFT JOIN user_accounts a ON a.student_id=w.student_id ORDER BY w.updated_at DESC`);
  }
  async save(studentId: string, name: string, permission?: BookingPermission) {
    const existing = this.db.get<{ id: string; role: string }>(
      "SELECT u.id,u.role FROM users u JOIN user_accounts a ON a.user_id=u.id WHERE a.student_id=?",
      studentId,
    );
    if (existing?.role === "admin") throw new Error("ADMIN_STUDENT_ID");
    const passwordHash = existing
      ? undefined
      : await hashPassword(defaultStudentPassword(studentId));
    this.db.tx(() => {
      // Re-read after async hashing: another admin may have created this account meanwhile.
      const current = this.db.get<{ user_id: string; role: string }>(
        "SELECT a.user_id,u.role FROM user_accounts a JOIN users u ON u.id=a.user_id WHERE a.student_id=?",
        studentId,
      );
      if (current?.role === "admin") throw new Error("ADMIN_STUDENT_ID");
      if (!current) {
        const id = randomUUID();
        this.db.run(
          "INSERT INTO users VALUES(?,?,?,?,?)",
          id,
          `${studentId}@students.openspace.invalid`,
          name,
          passwordHash!,
          "user",
        );
        this.db.run(
          "INSERT INTO user_accounts VALUES(?,?,?,?,?)",
          id,
          studentId,
          permission ?? "allowed",
          1,
          null,
        );
      } else {
        this.db.run(
          "UPDATE users SET name=? WHERE id=?",
          name,
          current.user_id,
        );
        this.db.run(
          "UPDATE user_accounts SET enabled=1,booking_permission=COALESCE(?,booking_permission) WHERE user_id=?",
          permission ?? null,
          current.user_id,
        );
      }
      this.db.run(
        "INSERT INTO booking_allowlist VALUES(?,?,?) ON CONFLICT(student_id) DO UPDATE SET name=excluded.name,updated_at=excluded.updated_at",
        studentId,
        name,
        Date.now(),
      );
    });
  }
  remove(studentId: string) {
    this.db.tx(() => {
      this.db.run(
        "DELETE FROM sessions WHERE user_id IN (SELECT user_id FROM user_accounts WHERE student_id=? AND user_id IN (SELECT id FROM users WHERE role='user'))",
        studentId,
      );
      this.db.run(
        "UPDATE user_accounts SET enabled=0 WHERE student_id=? AND user_id IN (SELECT id FROM users WHERE role='user')",
        studentId,
      );
      this.db.run(
        "DELETE FROM booking_allowlist WHERE student_id=?",
        studentId,
      );
    });
  }
  async resetPassword(studentId: string) {
    const hash = await hashPassword(defaultStudentPassword(studentId));
    return this.db.tx(() => {
      const row = this.db.get<{ user_id: string }>(
        "SELECT a.user_id FROM user_accounts a JOIN users u ON u.id=a.user_id JOIN booking_allowlist w ON w.student_id=a.student_id WHERE a.student_id=? AND u.role='user' AND a.enabled=1",
        studentId,
      );
      if (!row) return false;
      this.db.run(
        "UPDATE users SET password_hash=? WHERE id=?",
        hash,
        row.user_id,
      );
      this.db.run(
        "UPDATE user_accounts SET password_changed_at=NULL WHERE user_id=?",
        row.user_id,
      );
      this.db.run("DELETE FROM sessions WHERE user_id=?", row.user_id);
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
export function exportAccountState(db: DB): AccountState {
  return {
    users: db.all("SELECT * FROM users"),
    accounts: db.all("SELECT * FROM user_accounts"),
    allowlist: db.all("SELECT * FROM booking_allowlist"),
    loginEnabled: db.setting("account_login_enabled", "false"),
  };
}
/** Restore authentication only; never roll back booking, binding, event or job tables. */
export function restoreAccountState(db: DB, state: AccountState) {
  db.tx(() => {
    db.run("DELETE FROM sessions");
    db.run("DELETE FROM user_accounts");
    db.run("DELETE FROM booking_allowlist");
    for (const w of state.allowlist)
      db.run(
        "INSERT INTO booking_allowlist VALUES(?,?,?)",
        w.student_id,
        w.name,
        w.updated_at,
      );
    db.set("account_login_enabled", state.loginEnabled);
    const ids = new Set(state.users.map((u) => u.id));
    for (const row of db.all<{ id: string }>("SELECT id FROM users")) {
      if (ids.has(row.id)) continue;
      if (!db.get("SELECT id FROM bookings WHERE user_id=?", row.id))
        db.run("DELETE FROM users WHERE id=?", row.id);
      else
        db.run(
          "UPDATE users SET password_hash=?,role='user' WHERE id=?",
          `disabled:${randomUUID()}`,
          row.id,
        );
    }
    for (const u of state.users)
      db.run(
        "INSERT INTO users VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email,name=excluded.name,password_hash=excluded.password_hash,role=excluded.role",
        u.id,
        u.email,
        u.name,
        u.password_hash,
        u.role,
      );
    for (const a of state.accounts)
      db.run(
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
  for (const entry of db.all<{ student_id: string; name: string }>(
    "SELECT student_id,name FROM booking_allowlist WHERE student_id<>?",
    admin.studentId,
  ))
    await accounts.save(entry.student_id, entry.name);
  const disabledHash = await hashPassword(randomUUID());
  return db.tx(() => {
    db.run("DELETE FROM sessions");
    db.run("DELETE FROM booking_allowlist WHERE student_id=?", admin.studentId);
    const current = db.get<AccountRow>(
      "SELECT * FROM user_accounts WHERE student_id=?",
      admin.studentId,
    );
    const adminId = current?.user_id ?? randomUUID();
    if (!current) {
      db.run(
        "INSERT INTO users VALUES(?,?,?,?,?)",
        adminId,
        `${admin.studentId}@admins.openspace.invalid`,
        "管理员",
        admin.passwordHash,
        "admin",
      );
      db.run(
        "INSERT INTO user_accounts VALUES(?,?,?,?,?)",
        adminId,
        admin.studentId,
        "allowed",
        1,
        Date.now(),
      );
    } else {
      db.run(
        "UPDATE users SET password_hash=?,role='admin',name='管理员' WHERE id=?",
        admin.passwordHash,
        adminId,
      );
      db.run(
        "UPDATE user_accounts SET enabled=1,booking_permission='allowed',password_changed_at=? WHERE user_id=?",
        Date.now(),
        adminId,
      );
    }
    let deleted = 0,
      archived = 0;
    for (const u of db.all<{ id: string }>(
      "SELECT id FROM users WHERE id<>?",
      adminId,
    )) {
      const a = accounts.user(u.id);
      if (a?.role === "user") continue;
      db.run("DELETE FROM user_accounts WHERE user_id=?", u.id);
      if (!db.get("SELECT id FROM bookings WHERE user_id=?", u.id)) {
        db.run("DELETE FROM users WHERE id=?", u.id);
        deleted++;
      } else {
        db.run(
          "UPDATE users SET password_hash=?,role='user' WHERE id=?",
          disabledHash,
          u.id,
        );
        archived++;
      }
    }
    db.set("account_login_enabled", "true");
    db.audit("system", "accounts.activated", "system", { deleted, archived });
    return {
      deleted,
      archived,
      activeUsers: db.get<{ n: number }>(
        "SELECT COUNT(*) AS n FROM user_accounts WHERE enabled=1",
      )!.n,
    };
  });
}
