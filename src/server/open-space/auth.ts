import {
  randomBytes,
  createHash,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import type { User } from "@shared/open-space/domain.js";
import { DB } from "./db.js";
import { ADMIN_STUDENT_ID } from './coeer-identity.js';
const scrypt = promisify(scryptCallback);
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString("hex")}`;
}
export async function checkPassword(password: string, encoded: string) {
  const [salt, hash] = encoded.split(":");
  const actual = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export const digest = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export async function newSession(db: DB, userId: string, lifetime = 7 * 86400000) {
  const token = randomBytes(32).toString("base64url"),
    csrf = randomBytes(24).toString("base64url");
  await db.run(
    "INSERT INTO sessions VALUES(?,?,?,?)",
    digest(token),
    userId,
    csrf,
    Date.now() + lifetime,
  );
  return { token, csrf };
}
export async function session(
  db: DB,
  token: unknown,
): Promise<{ user: User; csrf: string } | null> {
  if (typeof token !== "string" || token.length > 100) return null;
  const row = await db.get<User & { csrf: string }>(
    `SELECT u.id,u.email,u.name,u.role,a.student_id AS studentId,a.booking_permission AS bookingPermission,
    (a.password_changed_at IS NULL AND u.role='user') AS passwordIsDefault,s.csrf
    FROM sessions s JOIN users u ON u.id=s.user_id JOIN user_accounts a ON a.user_id=u.id
    WHERE s.digest=? AND s.expires_at>? AND a.enabled=1 AND (u.role='admin' OR EXISTS(SELECT 1 FROM booking_allowlist w WHERE w.student_id=a.student_id))`,
    digest(token),
    Date.now(),
  );
  if (row?.role !== 'admin' && row?.studentId === ADMIN_STUDENT_ID) return null;
  return row
    ? {
        user: {
          id: row.id,
          email: row.email,
          name: row.name,
          role: row.role,
          studentId: row.role === 'admin' ? ADMIN_STUDENT_ID : row.studentId,
          bookingPermission: row.role === 'admin' ? 'allowed' : row.bookingPermission,
          passwordIsDefault: !!row.passwordIsDefault,
        },
        csrf: row.csrf,
      }
    : null;
}
