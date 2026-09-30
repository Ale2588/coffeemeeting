import { useMemo, useState } from "react";
import { Button } from "../components/Button";
import { Notice } from "../components/Card";
import { LoadingState } from "../components/LoadingState";
import { StatusTag } from "../components/StatusTag";
import { useToast } from "../components/Toast";
import { ApiError, type MemberStatus } from "../lib/api";
import { FORMAT_LABEL } from "../lib/labels";
import { zoneNames } from "./catalogLabels";
import { fetchMembers, setMemberStatus, type FounderMember } from "./founderApi";
import { useFounder } from "./FounderLayout";
import { genderAge, STATUS_LABEL, STATUS_ORDER, STATUS_TONE } from "./labels";
import { useAsync } from "./useAsync";

type Filter = MemberStatus | "all";
type Pending = { member: FounderMember; to: MemberStatus };

export function MembersPage() {
  const { catalog, refreshCounts } = useFounder();
  const toast = useToast();
  const { data, error, loading, reload } = useAsync(fetchMembers);
  const [filter, setFilter] = useState<Filter>("all");
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0])) as Record<MemberStatus, number>;
    data?.forEach((m) => c[m.status]++);
    return c;
  }, [data]);
  const rows = data?.filter((m) => filter === "all" || m.status === filter) ?? [];

  async function apply(member: FounderMember, to: MemberStatus, isUndo = false) {
    setBusy(true);
    setActionError(null);
    try {
      const previous = await setMemberStatus(member.id, to);
      setPending(null);
      await reload();
      refreshCounts();
      if (isUndo) {
        toast(`Stato di ${member.firstName} ripristinato: ${STATUS_LABEL[to]}.`);
      } else {
        toast(`${member.firstName}: ${STATUS_LABEL[to]}.`, {
          label: "Annulla",
          onClick: () => void apply(member, previous, true),
        });
      }
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "Qualcosa non ha funzionato. Riprova.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <title>Iscritti · Pannello · CoffeeMeeting</title>
      <div>
        <h2>Iscritti</h2>
        <p className="admin__intro">Colazioni fatte e media voti arrivano con i tavoli (fase 4) e il riscontro (fase 6).</p>
      </div>

      <div className="filters" role="group" aria-label="Filtra per stato">
        <button type="button" className="filter" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
          Tutti <span className="filter__n">{data?.length ?? "…"}</span>
        </button>
        {STATUS_ORDER.map((s) => (
          <button key={s} type="button" className="filter" aria-pressed={filter === s} onClick={() => setFilter(s)}>
            {STATUS_LABEL[s]} <span className="filter__n">{data ? counts[s] : "…"}</span>
          </button>
        ))}
      </div>

      {pending && (
        <div className="confirm-bar" role="alertdialog" aria-labelledby="confirm-title">
          <p id="confirm-title">
            Cambiare lo stato di <b>{pending.member.firstName}</b> da {STATUS_LABEL[pending.member.status]} a{" "}
            <b>{STATUS_LABEL[pending.to]}</b>?
          </p>
          {pending.to === "expelled" && (
            <p>L'espulsione chiude l'account: decidila solo dopo aver verificato le segnalazioni.</p>
          )}
          {pending.to === "suspended" && <p>Chi è sospeso non riceve inviti finché non cambi di nuovo lo stato.</p>}
          <p className="muted">Per ora non parte nessuna email: arriveranno con la fase 7.</p>
          <div className="button-row">
            <Button
              size="small"
              variant={pending.to === "expelled" || pending.to === "suspended" ? "danger" : "primary"}
              loading={busy}
              onClick={() => apply(pending.member, pending.to)}
            >
              Conferma
            </Button>
            <Button size="small" variant="secondary" disabled={busy} onClick={() => setPending(null)}>
              Annulla
            </Button>
          </div>
        </div>
      )}

      {(error || actionError) && <Notice tone="error">{error ?? actionError}</Notice>}
      {loading && <LoadingState />}
      {data && (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Nome</th>
                <th scope="col">Lavoro</th>
                <th scope="col">Zone</th>
                <th scope="col">Formato</th>
                <th scope="col">Genere · età</th>
                <th scope="col">Colazioni</th>
                <th scope="col">Stato</th>
                <th scope="col">Cambia stato</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="empty">
                    Nessun iscritto in questo stato.
                  </td>
                </tr>
              )}
              {rows.map((m) => {
                const ga = genderAge(m.gender, m.birthYear);
                const isFounder = m.role === "founder";
                return (
                  <tr key={m.id}>
                    <td>
                      {m.firstName}
                      {isFounder && <span className="muted"> · fondatore</span>}
                      <br />
                      <span className="muted">{m.email}</span>
                    </td>
                    <td>{m.job}</td>
                    <td>{zoneNames(catalog, m.zoneIds)}</td>
                    <td>{FORMAT_LABEL[m.format]}</td>
                    <td className="mono">
                      <span aria-label={ga.long}>{ga.short}</span>
                    </td>
                    <td className="mono" title="Disponibile dalla fase 4">
                      —
                    </td>
                    <td>
                      <StatusTag tone={STATUS_TONE[m.status]}>{STATUS_LABEL[m.status]}</StatusTag>
                    </td>
                    <td>
                      {isFounder ? (
                        <span className="muted">—</span>
                      ) : (
                        <select
                          className="status-select"
                          aria-label={`Cambia lo stato di ${m.firstName}`}
                          value=""
                          disabled={busy}
                          onChange={(e) => {
                            const to = e.target.value as MemberStatus;
                            if (to) setPending({ member: m, to });
                          }}
                        >
                          <option value="">Cambia…</option>
                          {STATUS_ORDER.filter((s) => s !== m.status).map((s) => (
                            <option key={s} value={s}>
                              {STATUS_LABEL[s]}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
