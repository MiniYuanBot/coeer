import {
  AdapterError,
  type OfficialAdapter,
  type CreateCommand,
  type SourceSpace,
  type Snapshot,
  type OperationOptions,
  type OfficialRecord,
  type PublicationGrant,
} from "../adapter.js";
import {
  today,
  addDays,
  timeLabel,
  slotInstant,
  validDate,
  type Module,
} from "@shared/open-space/domain.js";
import type { OfficialConfig, FieldBinding } from "./config.js";
import type { OfficialTransport, SessionHTTP } from "./http.js";
import type { BindingStore, OfficialBinding } from "./bindings.js";
import {
  parseList,
  parseJSON,
  parseMeetingRecord,
  parseMeetingConfiguration,
  object,
  text,
  spaceKey,
  type ParsedCard,
} from "./parsers.js";
interface CachedPage {
  cards: ParsedCard[];
  expires: number;
  unresolved: number;
  total: number;
  observedAt: number;
}
export class LiveOfficialAdapter implements OfficialAdapter {
  readonly mode = "official" as const;
  readonly operationTimeoutMs: number;
  readonly syncIntervalMs: number;
  readonly reconcileIntervalMs: number;
  readonly defaultHorizon: number;
  #cache = new Map<string, CachedPage>();
  #sources = new Map<string, SourceSpace>();
  #complete = false;
  #unresolved = 0;
  #error: string | null = null;
  constructor(
    readonly config: OfficialConfig,
    private transport: OfficialTransport,
    readonly bindings: BindingStore,
    private writeGuard?: () => void | Promise<void>,
  ) {
    this.operationTimeoutMs = config.operationTimeoutMs;
    this.syncIntervalMs = config.syncIntervalMs;
    this.reconcileIntervalMs = config.reconcileIntervalMs;
    this.defaultHorizon = config.horizon;
  }
  get catalogComplete() {
    return this.#complete;
  }
  get rulesSource() {
    return this.config.rulesSource;
  }
  beginSync() {
    this.#cache.clear();
  }
  publication(id: string): PublicationGrant | undefined {
    if (this.rulesSource === "upstream") {
      const source = this.#sources.get(id);
      if (!source || source.module !== "meeting" || source.permission !== "allowed")
        return undefined;
      return {
        module: "meeting", officialId: source.officialId, approvalRef: "official-account-access",
        expiresAt: new Date(Date.now() + this.config.syncIntervalMs).toISOString(),
        name: source.name.slice(0, 80), location: source.location.slice(0, 100),
        description: "官方会议空间，预约规则由官方系统实时校验。",
        capacity: source.capacity, amenities: source.amenities,
        syncFields: ["capacity", "amenities"],
      };
    }
    return this.config.publications.find(
      (p) =>
        spaceKey(p.module, p.officialId) === id &&
        Date.parse(p.expiresAt) > Date.now(),
    );
  }
  publicationGrants(): PublicationGrant[] {
    return this.rulesSource === "upstream"
      ? [...this.#sources.keys()].map(id => this.publication(id)).filter((grant): grant is PublicationGrant => !!grant)
      : this.config.publications;
  }
  diagnostics() {
    return {
      mode: this.mode,
      rulesSource: this.rulesSource,
      writeConfigured: this.config.writes.enabled,
      catalogComplete: this.#complete,
      identifiedSpaces: this.#sources.size,
      unresolvedSpaces: this.#unresolved,
      lastError: this.#error,
      activityCapacityVerified: false,
      requestCorrelationSupported: false,
      accountAlias: this.config.account.alias,
      connector: this.transport.diagnostics?.() ?? {
        authentication: "externally_managed",
      },
    };
  }
  async checkConnection(options?: OperationOptions) {
    this.transport.resetAuthentication?.();
    this.beginSync();
    await this.identity(await this.transport.session(), options);
    return this.diagnostics();
  }
  private async identity(
    http: SessionHTTP,
    options?: OperationOptions,
    write = false,
  ) {
    try {
      const body = await http.request(
          "profile",
          { tm: String(Date.now()) },
          {},
          options,
        ),
        json = parseJSON(body.body);
      if (!Array.isArray(json.list) || json.list.length !== 1)
        throw new AdapterError("AUTH_EXPIRED");
      const profile = object(json.list[0]),
        id = text(profile.USER_ID);
      if (
        this.config.account.profileUserId &&
        id !== this.config.account.profileUserId
      )
        throw new AdapterError("FORBIDDEN");
      if (write && this.rulesSource === "contract" && id !== this.config.writes.authorization?.profileUserId)
        throw new AdapterError("FORBIDDEN");
      this.transport.verified?.();
    } catch (e) {
      this.transport.invalidate?.(
        e instanceof AdapterError ? e.code : "INVALID_RESPONSE",
      );
      throw e;
    }
  }
  private async pages(
    module: Module,
    date: string,
    options?: OperationOptions,
    force = false,
  ): Promise<CachedPage> {
    const key = `${module}:${date}`,
      cached = this.#cache.get(key);
    if (!force && cached && cached.expires > Date.now()) return cached;
    if (!this.config.modules.includes(module))
      throw new AdapterError("FORBIDDEN");
    try {
      const http = await this.transport.session();
      await this.identity(http, options);
      const result: CachedPage = {
        cards: [],
        expires: Date.now() + this.config.cacheMs,
        unresolved: 0,
        total: 0,
        observedAt: Date.now(),
      };
      let pages = 1;
      const seen = new Set<string>();
      for (let page = 1; page <= pages; page++) {
        const response = await http.request(
          module === "meeting" ? "meetingList" : "activityList",
          { currentPage: String(page), showCount: "50" },
          {
            [module === "meeting" ? "MEETING_DATE" : "BOOKING_DATE"]: date,
            showCount: "50",
          },
          options,
        );
        const parsed = parseList(
          response.body,
          module,
          date,
          this.config.baseURL,
        );
        if (
          parsed.facts.currentPage !== page ||
          parsed.facts.pageSize !== 50 ||
          parsed.facts.pages! > this.config.maxPages ||
          (page > 1 &&
            (parsed.facts.pages !== pages ||
              parsed.facts.total !== result.total))
        )
          throw new AdapterError("INVALID_RESPONSE");
        pages = parsed.facts.pages!;
        result.total = parsed.facts.total!;
        result.unresolved += parsed.unresolved;
        for (const card of parsed.cards) {
          if (seen.has(card.source.id))
            throw new AdapterError("INVALID_RESPONSE");
          seen.add(card.source.id);
          result.cards.push(card);
        }
      }
      if (result.cards.length + result.unresolved !== result.total)
        throw new AdapterError("INVALID_RESPONSE");
      for (const card of result.cards) {
        if (
          module !== "meeting" ||
          card.source.permission !== "allowed" ||
          !card.source.enabled
        )
          continue;
        const response = await http.request(
            "meetingSlots",
            {},
            { ROOMMEETING_ID: card.source.officialId, MEETING_DATE: date },
            options,
          ),
          configuration = parseMeetingConfiguration(
            response.body,
            card.source.officialId,
          );
        if (
          configuration.slots.length !== card.slots.length ||
          configuration.slots.some(
            (s, i) =>
              s.start !== card.slots[i].start || s.end !== card.slots[i].end,
          )
        )
          throw new AdapterError("INVALID_RESPONSE");
        card.slots = card.slots.map((s, i) =>
          s.state === configuration.slots[i].state
            ? s
            : { ...s, state: "unknown" },
        );
        card.source.metadata = {
          ...card.source.metadata,
          ...configuration.metadata,
        };
        if (this.rulesSource === "upstream") {
          card.source.policy = {
            kind: "meeting", rulesSource: "upstream", approval: true, approvalKnown: false,
            stepMinutes: configuration.metadata.stepMinutes as number,
            maxMinutes: 0, rulesVerified: true,
          };
        }
      }
      result.expires = Date.now() + this.config.cacheMs;
      this.#cache.set(key, result);
      this.#error = null;
      return result;
    } catch (e) {
      this.#cache.delete(key);
      this.#error = e instanceof AdapterError ? e.code : "INVALID_RESPONSE";
      throw e;
    }
  }
  async listSpaces(options?: OperationOptions): Promise<SourceSpace[]> {
    const sources: SourceSpace[] = [];
    let unresolved = 0;
    for (const module of this.config.modules) {
      const page = await this.pages(module, today(), options);
      unresolved += page.unresolved;
      for (const card of page.cards) {
        const source = card.source,
          rule = this.config.writes.contract?.rules.find(
            (r) =>
              source.module === "meeting" && r.officialId === source.officialId,
          );
        if (
          this.rulesSource === "contract" && rule &&
          source.policy.kind === "meeting" &&
          source.policy.stepMinutes === rule.stepMinutes
        )
          source.policy = {
            kind: "meeting",
            approval: rule.approval,
            stepMinutes: rule.stepMinutes,
            maxMinutes: rule.maxMinutes,
            rulesVerified: true,
            rulesSource: "contract",
            approvalKnown: true,
          };
        sources.push(source);
      }
    }
    this.#sources = new Map(sources.map((s) => [s.id, s]));
    this.#complete = unresolved === 0;
    this.#unresolved = unresolved;
    return sources;
  }
  async availability(
    spaceId: string,
    date: string,
    options?: OperationOptions,
  ): Promise<Snapshot> {
    const source = this.#sources.get(spaceId);
    if (!source) throw new AdapterError("INVALID_RESPONSE");
    const page = await this.pages(source.module, date, options),
      card = page.cards.find((c) => c.source.id === spaceId);
    if (!card) throw new AdapterError("INVALID_RESPONSE");
    const slots = card.slots.map((s) =>
      (card.source.permission !== "allowed" || !card.source.enabled) && s.state === "available"
        ? { ...s, state: "unopened" as const }
        : s,
    );
    return { slots, includedRefs: [], observedAt: page.observedAt }; // Do not infer which official occupancies belong to local requests.
  }
  checkCreate(command: CreateCommand) {
    const source = this.#sources.get(command.spaceId);
    this.authorize(command, "create");
    this.authorize(command, "initialize");
    if (
      !source ||
      source.permission !== "allowed" ||
      !source.enabled ||
      source.policy.rulesVerified !== true
    )
      throw new AdapterError("AUTHORIZATION_REQUIRED");
    if (source.metadata?.reservationCost !== 0)
      throw new AdapterError("UNSUPPORTED");
    if (this.rulesSource === "upstream") {
      if (!validDate(command.date) || !Number.isInteger(command.start) || !Number.isInteger(command.end) ||
          command.start < 0 || command.end > 1440 || command.start >= command.end ||
          command.quantity !== 1 || !command.purpose)
        throw new AdapterError("RULE_REJECTED");
      // The fresh slot grid and the official verify endpoint enforce step, date,
      // duration and account policy. No synthetic room/date/duration limit is added.
      return;
    }
    const rule = this.config.writes.contract!.rules.find(
      (r) => r.officialId === source.officialId,
    );
    if (
      !rule ||
      command.date < rule.firstDate ||
      command.date > rule.lastDate ||
      command.start % rule.stepMinutes ||
      command.end % rule.stepMinutes ||
      command.end - command.start > rule.maxMinutes ||
      command.quantity !== 1 ||
      !command.purpose
    )
      throw new AdapterError("RULE_REJECTED");
  }
  private authorize(
    command: CreateCommand,
    operation: "create" | "initialize" | "cancel",
  ) {
    const a = this.config.writes.authorization,
      c = this.config.writes.contract,
      source = this.#sources.get(command.spaceId);
    if (
      !this.config.writes.enabled ||
      !c ||
      !this.config.account.profileUserId ||
      !this.config.account.bookingPersonId ||
      command.module !== "meeting" ||
      !source ||
      source.module !== command.module ||
      !command.externalUserId ||
      (operation !== "cancel" &&
        (!this.publication(command.spaceId) ||
          slotInstant(command.date, command.start) <= Date.now())) ||
      (this.rulesSource === "contract" && (!a || Date.now() < Date.parse(a.validFrom) ||
      Date.now() >= Date.parse(a.validUntil) || !a.externalUserIds.includes(command.externalUserId) || !a.scopes.some(
        (s) =>
          s.module === command.module &&
          s.officialId === source.officialId &&
          (s.dates ? s.dates.includes(command.date) :
            command.date >= today() && command.date <= addDays(today(), s.rollingDaysAhead!)) &&
          s.start <= command.start &&
          s.end >= command.end &&
          s.operations.includes(operation),
      )))
    )
      throw new AdapterError("AUTHORIZATION_REQUIRED");
  }
  private fields(
    template: Record<string, FieldBinding>,
    draft: Record<string, unknown>,
    command: CreateCommand,
    initialization: Record<string, unknown>,
  ) {
    const payload: Record<string, string> = {};
    for (const [key, binding] of Object.entries(template)) {
      let value: unknown =
        binding.from === "constant"
          ? binding.value
          : binding.from === "account"
            ? this.config.account.contact
            : binding.from === "initialization"
              ? initialization[binding.field]
              : binding.from === "draft"
                ? draft[binding.field]
                : binding.field === "date"
                  ? command.date
                  : binding.field === "start"
                    ? timeLabel(command.start)
                    : binding.field === "end"
                      ? timeLabel(command.end)
                      : command.purpose;
      if (typeof value !== "string" && typeof value !== "number")
        throw new AdapterError("INVALID_RESPONSE");
      payload[key] = String(value);
    }
    return payload;
  }
  private verifyFields(
    payload: Record<string, string>,
    draft: Record<string, unknown>,
    command: CreateCommand,
    creating: boolean,
  ) {
    const required = {
      ROOMMEETING_ID: String(draft.ROOMMEETING_ID),
      START_DATE: command.date,
      END_DATE: command.date,
      START_TIME: timeLabel(command.start),
      END_TIME: timeLabel(command.end),
      ...(creating
        ? {
            MEETING_APPLY_ID: String(draft.MEETING_APPLY_ID),
            MEETING_PERSON: String(draft.MEETING_PERSON),
            MEETING_TITLE: command.purpose!,
          }
        : {}),
    };
    if (Object.entries(required).some(([k, v]) => payload[k] !== v))
      throw new AdapterError("CONFIGURATION");
    for (const key of ["ACTUAL_USER", "MEETING_HOST"])
      if (key in payload && payload[key] !== draft.username)
        throw new AdapterError("FORBIDDEN");
    for (const [key, field] of Object.entries({
      PERSON_NAME: "NAME",
      LEADERSHIP1: "deptName",
      ROOM_NAME: "roomName",
      ACTUAL_USER_NAME: "name",
      MEETING_HOST_NAME: "name",
    }))
      if (
        key in payload &&
        (typeof draft[field] !== "string" || payload[key] !== draft[field])
      )
        throw new AdapterError("FORBIDDEN");
    if (("CYCLE" in payload && payload.CYCLE !== "2") || payload.CYCLE_TIME)
      throw new AdapterError("UNSUPPORTED");
    if (creating) {
      if (!payload.REMARK?.trim()) throw new AdapterError("CONFIGURATION");
      for (const key of [
        "MAIL",
        "NOTE",
        "HQTX",
        "QYWX",
        "SIGNIN_STATUS",
        "SERVICE_ITEM",
        "DEPARTMENT_IDS",
        "EXTERNALSTAFF_IDS",
        "MEETING_SIKA",
        "MEETING_KEY",
      ])
        if (payload[key]) throw new AdapterError("UNSUPPORTED");
      if ("TYPE" in payload && payload.TYPE !== "0")
        throw new AdapterError("UNSUPPORTED");
      for (const key of ["PCRF_COST", "PCRF_TIME"])
        if (key in payload && payload[key] !== String(draft[key]))
          throw new AdapterError("CONFIGURATION");
    }
  }
  async create(
    command: CreateCommand,
    options?: OperationOptions,
  ): Promise<{ ref: string }> {
    this.checkCreate(command);
    if (await this.bindings.byRequest(command.requestId))
      throw new AdapterError("AUTHORIZATION_REQUIRED");
    const source = this.#sources.get(command.spaceId)!;
    const fresh = await this.pages(source.module, command.date, options, true),
      card = fresh.cards.find((c) => c.source.id === source.id);
    const selected =
      card?.slots.filter(
        (s) => s.start < command.end && command.start < s.end,
      ) ?? [];
    if (
      !card ||
      card.source.permission !== "allowed" ||
      !card.source.enabled ||
      (this.rulesSource === "contract" && card.source.policy.stepMinutes !== source.policy.stepMinutes) ||
      !selected.length ||
      selected[0].start !== command.start ||
      selected.at(-1)!.end !== command.end ||
      selected.some((s, i) => i > 0 && selected[i - 1].end !== s.start) ||
      selected.some((s) => s.state !== "available")
    )
      throw new AdapterError("CONFLICT");
    if (card.source.metadata?.reservationCost !== 0)
      throw new AdapterError("UNSUPPORTED");
    const http = await this.transport.session();
    await this.identity(http, options, true);
    let ref: string | undefined;
    try {
      const data = `{'id':'${source.officialId}','staTime':'${timeLabel(command.start)}','endTime':'${timeLabel(selected[0].end)}','date':'${command.date}'}`;
      this.authorize(command, "initialize");
      const response = await http.request(
          "initialize",
          { data },
          {},
          {
            ...options,
            beforeSend: async () => {
              await this.writeGuard?.();
              this.authorize(command, "initialize");
            },
          },
        ),
        initialized = parseJSON(response.body),
        draft = object(initialized.pd);
      ref = text(draft.MEETING_APPLY_ID);
      if (
        !/^[-A-Za-z0-9_.:]{1,128}$/.test(ref) ||
        draft.ROOMMEETING_ID !== source.officialId ||
        draft.MEETING_PERSON !== this.config.account.bookingPersonId
      )
        throw new AdapterError("FORBIDDEN");
      if (draft.PCRF_COST !== 0 && draft.PCRF_COST !== "0")
        throw new AdapterError("UNSUPPORTED");
      await this.bindings.put({
        ...command,
        ref,
        accountAlias: this.config.account.alias,
      });
      const firstLabel = Array.isArray(initialized.labelList)
        ? initialized.labelList[0]
        : undefined;
      const context = {
        defaultMeetingLabel:
          firstLabel && typeof firstLabel === "object"
            ? (firstLabel as Record<string, unknown>).SET_CODE
            : undefined,
        meetingPlace:
          typeof draft.PLACE === "string" &&
          (typeof draft.FLOOR === "string" || typeof draft.FLOOR === "number")
            ? `${draft.PLACE} ${draft.FLOOR}`
            : undefined,
      };
      const contract = this.config.writes.contract!,
        verify = this.fields(contract.verifyFields, draft, command, context),
        payload = this.fields(contract.createFields, draft, command, context);
      this.verifyFields(verify, draft, command, false);
      this.verifyFields(payload, draft, command, true);
      const checked = parseJSON(
          (await http.request("verify", {}, verify, options)).body,
        ),
        code = String(checked.code ?? "");
      if (contract.verifyRejectCodes.includes(code))
        throw new AdapterError("RULE_REJECTED", ref);
      if (!contract.verifySuccessCodes.includes(code))
        throw new AdapterError("INVALID_RESPONSE", ref);
      this.authorize(command, "create");
      const saved = await http.request("create", {}, payload, {
        ...options,
        beforeSend: async () => {
          await this.writeGuard?.();
          this.authorize(command, "create");
        },
      });
      if (contract.receiptMode === "independent_query") {
        const binding = await this.bindings.byRequest(command.requestId);
        const record = await this.read(ref, http, options);
        if (
          !binding ||
          !this.match(record, binding) ||
          record.status === "unknown"
        )
          throw new AdapterError("INVALID_RESPONSE", ref);
        this.#cache.clear();
        return { ref }; // HTML/redirect receipt is not proof: the independent detail read is.
      }
      if (!contract.ack) throw new AdapterError("INVALID_RESPONSE", ref);
      const json = parseJSON(saved.body),
        at = (path: string[]) =>
          path.reduce<unknown>(
            (v, k) =>
              v && typeof v === "object" && !Array.isArray(v)
                ? (v as Record<string, unknown>)[k]
                : undefined,
            json,
          );
      if (
        at(contract.ack.successPath) !== contract.ack.successValue ||
        at(contract.ack.refPath) !== ref
      )
        throw new AdapterError("INVALID_RESPONSE", ref);
      this.#cache.clear();
      return { ref };
    } catch (e) {
      if (e instanceof AdapterError) throw new AdapterError(e.code, ref);
      throw new AdapterError("INVALID_RESPONSE", ref);
    }
  }
  private match(record: OfficialRecord, b: OfficialBinding) {
    return (
      record.ref === b.ref &&
      record.module === b.module &&
      record.spaceId === b.spaceId &&
      record.date === b.date &&
      record.start === b.start &&
      record.end === b.end &&
      record.quantity === b.quantity &&
      record.identityVerified === true
    );
  }
  private async read(
    ref: string,
    http: SessionHTTP,
    options?: OperationOptions,
  ): Promise<OfficialRecord> {
    if (
      !this.config.account.bookingPersonId ||
      !/^[-A-Za-z0-9_.:]{1,128}$/.test(ref)
    )
      throw new AdapterError("AUTHORIZATION_REQUIRED");
    const r = await http.request(
      "meetingDetail",
      { MEETING_APPLY_ID: ref, tm: String(Date.now()) },
      {},
      options,
    );
    return parseMeetingRecord(
      r.body,
      ref,
      this.config.account.bookingPersonId,
      this.config.writes.contract?.statusMap,
    );
  }
  async get(
    ref: string,
    options?: OperationOptions,
  ): Promise<OfficialRecord | null> {
    const b = await this.bindings.get(ref);
    if (
      !b ||
      b.module !== "meeting" ||
      b.accountAlias !== this.config.account.alias
    )
      throw new AdapterError("FORBIDDEN");
    const http = await this.transport.session();
    await this.identity(http, options);
    const record = await this.read(ref, http, options);
    if (!this.match(record, b)) throw new AdapterError("INVALID_RESPONSE");
    return record;
  }
  async cancel(ref: string, options?: OperationOptions): Promise<void> {
    const b = await this.bindings.get(ref);
    if (!b || b.accountAlias !== this.config.account.alias)
      throw new AdapterError("FORBIDDEN");
    this.authorize(b, "cancel");
    const http = await this.transport.session();
    await this.identity(http, options, true);
    const record = await this.read(ref, http, options);
    if (!this.match(record, b)) throw new AdapterError("INVALID_RESPONSE");
    if (record.status === "cancelled") return;
    if (!["confirmed", "pending_approval"].includes(record.status))
      throw new AdapterError("AUTHORIZATION_REQUIRED");
    this.authorize(b, "cancel");
    await http.request(
      "cancel",
      {},
      { MEETING_APPLY_ID: ref },
      {
        ...options,
        beforeSend: async () => {
          await this.writeGuard?.();
          this.authorize(b, "cancel");
        },
      },
    );
    this.#cache.clear();
    // A 200/redirect is only submission; the worker independently reads the final state.
  }
  async attachReference(
    command: CreateCommand,
    ref: string,
    options?: OperationOptions,
  ) {
    if (command.module !== "meeting") throw new AdapterError("UNSUPPORTED");
    const http = await this.transport.session();
    await this.identity(http, options);
    const record = await this.read(ref, http, options),
      b = { ...command, ref, accountAlias: this.config.account.alias };
    if (!this.match(record, b)) throw new AdapterError("INVALID_RESPONSE");
    await this.bindings.put(b);
  }
}
