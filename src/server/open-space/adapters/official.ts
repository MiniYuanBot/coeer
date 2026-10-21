import {
  AdapterError,
  type OfficialAdapter,
  type CreateCommand,
  type SourceSpace,
  type Snapshot,
  type OfficialRecord,
} from "./adapter.js";
/** Deliberately no transport, endpoints, cookies, login or guessed payloads. */
export class DisabledOfficialAdapter implements OfficialAdapter {
  readonly mode = "official-disabled" as const;
  private blocked(): never {
    throw new AdapterError("UNSUPPORTED");
  }
  async listSpaces(): Promise<SourceSpace[]> {
    return this.blocked();
  }
  async availability(_spaceId: string, _date: string): Promise<Snapshot> {
    return this.blocked();
  }
  async create(_command: CreateCommand): Promise<{ ref: string }> {
    return this.blocked();
  }
  async cancel(_ref: string): Promise<void> {
    return this.blocked();
  }
  async get(_ref: string): Promise<OfficialRecord | null> {
    return this.blocked();
  }
}
