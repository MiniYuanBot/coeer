import { DB } from "../../db.js";
import type { CreateCommand } from "../adapter.js";
export interface OfficialBinding extends CreateCommand {
  ref: string;
  accountAlias: string;
}
export interface BindingStore {
  get(ref: string): OfficialBinding | undefined;
  byRequest(id: string): OfficialBinding | undefined;
  put(value: OfficialBinding): void;
}
export class SQLiteBindings implements BindingStore {
  constructor(private db: DB) {}
  get(ref: string) {
    return this.read("official_ref", ref);
  }
  byRequest(id: string) {
    return this.read("request_id", id);
  }
  private read(
    key: "official_ref" | "request_id",
    value: string,
  ): OfficialBinding | undefined {
    const row = this.db.get<{ payload: string }>(
      `SELECT payload FROM official_bindings WHERE ${key}=?`,
      value,
    );
    return row ? JSON.parse(row.payload) : undefined;
  }
  put(value: OfficialBinding) {
    this.db.tx(() => {
      const old = this.byRequest(value.requestId);
      if (old && old.ref !== value.ref)
        throw new Error("OFFICIAL_BINDING_CONFLICT");
      this.db.run(
        "INSERT INTO official_bindings(request_id,official_ref,account_alias,payload) VALUES(?,?,?,?) ON CONFLICT(request_id) DO UPDATE SET payload=excluded.payload",
        value.requestId,
        value.ref,
        value.accountAlias,
        JSON.stringify(value),
      );
      this.db.run(
        "UPDATE bookings SET official_ref=? WHERE id=? AND provider='official'",
        value.ref,
        value.requestId,
      );
    });
  }
}
