import { formatDateTime } from "./dates";
import type { MyInvitation } from "./invitations";

const TITLE = "Colazione CoffeeMeeting";

/** 20261006T054500Z */
function utcStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeIcs(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function location(inv: MyInvitation): string {
  return [inv.venueName, inv.venueAddress, "Milano"].filter(Boolean).join(", ");
}

function details(inv: MyInvitation): string {
  const who = inv.format === "one_to_one" ? "Colazione uno a uno." : `Tavolo di ${inv.participants} persone.`;
  return `${who} Disdetta gratuita fino a ${formatDateTime(inv.freeCancellationUntil)}.`;
}

/** Contenuto del file .ics (Apple Calendar, Outlook, Google). Orari in UTC. */
export function buildIcs(inv: MyInvitation): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CoffeeMeeting//Inviti//IT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:invito-${inv.id}@coffeemeeting`,
    `DTSTAMP:${utcStamp(new Date())}`,
    `DTSTART:${utcStamp(inv.startsAt)}`,
    `DTEND:${utcStamp(inv.endsAt)}`,
    `SUMMARY:${escapeIcs(TITLE)}`,
    `LOCATION:${escapeIcs(location(inv))}`,
    `DESCRIPTION:${escapeIcs(details(inv))}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

export function downloadIcs(inv: MyInvitation): void {
  const blob = new Blob([buildIcs(inv)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "colazione-coffeemeeting.ics";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function googleCalendarUrl(inv: MyInvitation): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: TITLE,
    dates: `${utcStamp(inv.startsAt)}/${utcStamp(inv.endsAt)}`,
    details: details(inv),
    location: location(inv),
    ctz: "Europe/Rome",
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

export function mapsUrl(inv: MyInvitation): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location(inv))}`;
}
