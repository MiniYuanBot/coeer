import { DB } from "../../db.js";
import type { CreateCommand } from "../adapter.js";
export interface OfficialBinding extends CreateCommand {
  ref: string;
  accountAlias: string;
}
export interface BindingStore {
  get(ref: string): Promise<OfficialBinding | undefined>;
  byRequest(id: string): Promise<OfficialBinding | undefined>;
  put(value: OfficialBinding): Promise<void>;
}
export class PostgresBindings implements BindingStore {
  constructor(private db: DB) {}
  get(ref: string) {
    return this.read("official_ref", ref);
  }
  byRequest(id: string) {
    return this.read("request_id", id);
  }
  private async read(
    key: "official_ref" | "request_id",
    value: string,
  ): Promise<OfficialBinding | undefined> {
    const row = await this.db.get<{ payload: string }>(
      `SELECT payload FROM official_bindings WHERE ${key}=?`,
      value,
    );
    return row ? JSON.parse(row.payload) : undefined;
  }
  async put(value: OfficialBinding) {
    await this.db.tx(async () => {
      const old = await this.byRequest(value.requestId);
      if (old && old.ref !== value.ref)
        throw new Error("OFFICIAL_BINDING_CONFLICT");
      await this.db.run(
        "INSERT INTO official_bindings(request_id,official_ref,account_alias,payload) VALUES(?,?,?,?) ON CONFLICT(request_id) DO UPDATE SET payload=excluded.payload",
        value.requestId,
        value.ref,
        value.accountAlias,
        JSON.stringify(value),
      );
      await this.db.run(
        "UPDATE bookings SET official_ref=? WHERE id=? AND provider='official'",
        value.ref,
        value.requestId,
      );
    });
  }
}
