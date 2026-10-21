import type { Module, Policy, Slot } from "@shared/open-space/domain.js";
export interface SourceSpace {
  /** Adapter-owned identity, namespaced by module. Never infer a UUID shape. */
  id: string;
  officialId: string;
  module: Module;
  name: string;
  location: string;
  description: string;
  capacity: number;
  amenities: string[];
  policy: Policy;
  enabled: boolean;
  permission?: "allowed" | "denied" | "unknown";
  metadata?: Record<string, string | number | boolean | null>;
}
export interface Snapshot {
  slots: Slot[];
  includedRefs: string[];
  observedAt?: number;
}
export interface CreateCommand {
  requestId: string;
  spaceId: string;
  module: Module;
  date: string;
  start: number;
  end: number;
  quantity: number;
  externalUserId?: string;
  purpose?: string;
}
export type OfficialState =
  "pending_approval" | "confirmed" | "failed" | "cancelled" | "unknown";
export interface OfficialRecord extends Omit<CreateCommand, "requestId"> {
  requestId?: string;
  ref: string;
  status: OfficialState;
  identityVerified?: boolean;
  /** Private, owner-only access information from an independently verified record. */
  doorCode?: string;
}
export type AdapterErrorCode =
  | "CONFLICT"
  | "TIMEOUT"
  | "NETWORK"
  | "AUTH_EXPIRED"
  | "UNSUPPORTED"
  | "INVALID_RESPONSE"
  | "FORBIDDEN"
  | "RULE_REJECTED"
  | "RATE_LIMITED"
  | "MAINTENANCE"
  | "CONFIGURATION"
  | "AUTHORIZATION_REQUIRED";
export class AdapterError extends Error {
  constructor(
    readonly code: AdapterErrorCode,
    readonly ref?: string,
  ) {
    super(code);
  }
}
export interface OperationOptions {
  signal?: AbortSignal;
  /** Internal transport guard, evaluated after throttling immediately before dispatch. */
  beforeSend?: () => void;
}
export interface PublicationGrant {
  module: Module;
  officialId: string;
  approvalRef: string;
  expiresAt: string;
  name: string;
  location: string;
  description: string;
  capacity: number;
  amenities: string[];
  /** Only these explicitly approved non-personal fields may follow upstream updates. */
  syncFields?: ("capacity" | "amenities")[];
}
export interface OfficialAdapter {
  readonly mode: "mock" | "official-disabled" | "official";
  readonly operationTimeoutMs?: number;
  readonly syncIntervalMs?: number;
  readonly reconcileIntervalMs?: number;
  readonly defaultHorizon?: number;
  listSpaces(options?: OperationOptions): Promise<SourceSpace[]>;
  availability(
    spaceId: string,
    date: string,
    options?: OperationOptions,
  ): Promise<Snapshot>;
  create(
    command: CreateCommand,
    options?: OperationOptions,
  ): Promise<{ ref: string }>;
  cancel(ref: string, options?: OperationOptions): Promise<void>;
  get(ref: string, options?: OperationOptions): Promise<OfficialRecord | null>;
  checkCreate?(command: CreateCommand): void;
  publication?(spaceId: string): PublicationGrant | undefined;
  diagnostics?(): Record<string, unknown>;
  beginSync?(): void;
  checkConnection?(
    options?: OperationOptions,
  ): Promise<Record<string, unknown>>;
  attachReference?(
    command: CreateCommand,
    ref: string,
    options?: OperationOptions,
  ): Promise<void>;
  readonly catalogComplete?: boolean;
  // Optional capability. Real support must be authorized and verified; no fuzzy matching.
  findByRequest?(
    requestId: string,
    options?: OperationOptions,
  ): Promise<OfficialRecord | null>;
}
