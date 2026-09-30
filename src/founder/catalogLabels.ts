import { formatSlotTime, weekdayName } from "../lib/format";
import type { FounderCatalog } from "./founderApi";

/** "Mar 7:45" */
export function slotShort(slot: { weekday: number; start_time: string }): string {
  return `${weekdayName(slot.weekday).slice(0, 3)} ${formatSlotTime(slot.start_time)}`;
}

export function zoneNames(catalog: FounderCatalog, ids: number[]): string {
  return catalog.zones
    .filter((z) => ids.includes(z.id))
    .map((z) => z.name)
    .join(", ");
}

export function slotNames(catalog: FounderCatalog, ids: number[]): string {
  return catalog.slots
    .filter((s) => ids.includes(s.id))
    .map(slotShort)
    .join(", ");
}

const shortDate = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", day: "numeric", month: "short" });

/** "29 set" */
export function formatShortDate(iso: string): string {
  return shortDate.format(new Date(iso));
}
