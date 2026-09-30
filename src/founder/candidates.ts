import type { FounderMember, Meetup, SubscriptionState } from "./founderApi";

export type Candidate = {
  member: FounderMember;
  /** Motivi per cui non è un abbinamento naturale; vuoto se lo è. */
  reasons: string[];
  busy: boolean;
};

const ACTIVE = new Set(["active", "warned"]);

/**
 * Chi può sedere a un tavolo: attivi o avvisati, con zona, orario e formato compatibili,
 * non in pausa quel giorno e non già in un altro tavolo nello stesso giorno e orario.
 */
export function candidatesFor(
  members: FounderMember[],
  meetups: Meetup[],
  subscriptions: Map<string, SubscriptionState>,
  t: { id: number | null; zoneId: number; slotId: number; date: string; format: "group" | "one_to_one" },
): Candidate[] {
  const busyIds = new Set(
    meetups
      .filter((m) => m.id !== t.id && m.status !== "cancelled" && m.date === t.date && m.slotId === t.slotId)
      .flatMap((m) => m.invitations.filter((i) => ["draft", "pending", "confirmed"].includes(i.status)))
      .map((i) => i.profileId),
  );
  return members
    .filter((m) => ACTIVE.has(m.status))
    .map((m) => {
      const reasons: string[] = [];
      if (!m.zoneIds.includes(t.zoneId)) reasons.push("altra zona");
      if (!m.slotIds.includes(t.slotId)) reasons.push("altro orario");
      if (m.format !== "both" && m.format !== t.format) reasons.push(m.format === "group" ? "solo gruppo" : "solo uno a uno");
      if (m.invitesResumeOn && t.date && m.invitesResumeOn > t.date) reasons.push("in pausa");
      // Dalla seconda colazione serve l'abbonamento (il database lo verifica comunque).
      if (subscriptions.get(m.id)?.needsSubscription) reasons.push("senza abbonamento");
      return { member: m, reasons, busy: busyIds.has(m.id) };
    });
}
