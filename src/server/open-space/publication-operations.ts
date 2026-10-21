import { BookingService, type SpaceRow } from "./service.js";
import { AdapterError } from "./adapters/adapter.js";

/** Explicit operator activation only. Admin can subsequently hide any approved room. */
export function activateReadOnlyAllowlist(service: BookingService) {
  if (service.adapter.mode !== "official" || service.adapter.diagnostics?.().writeConfigured === true)
    throw new AdapterError("AUTHORIZATION_REQUIRED");
  return service.db.tx(async () => {
    const spaces = await service.db.all<SpaceRow>("SELECT * FROM spaces WHERE provider='official'");
    let published = 0;
    for (const space of spaces) {
      const allowed = service.canPublish(space);
      await service.db.run("UPDATE spaces SET published=?,bookable=0 WHERE id=?", Number(allowed), space.id);
      if (allowed) published++;
    }
    await service.db.set("booking_enabled", "false");
    await service.db.audit("operator", "publication.allowlist_activated", "official", { published, readonly: true });
    return { published, hidden: spaces.length - published, officialWritesEnabled: false };
  });
}
