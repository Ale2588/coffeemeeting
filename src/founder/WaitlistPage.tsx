import { useCallback, useState } from "react";
import { Button } from "../components/Button";
import { Notice } from "../components/Card";
import { LoadingState } from "../components/LoadingState";
import { useToast } from "../components/Toast";
import { ApiError, type MemberStatus } from "../lib/api";
import { FORMAT_LABEL } from "../lib/labels";
import { formatShortDate, slotNames, zoneNames } from "./catalogLabels";
import { fetchMembers, fetchPendingSignupsCount, setMemberStatus, type FounderMember } from "./founderApi";
import { useFounder } from "./FounderLayout";
import { genderAge } from "./labels";
import { useAsync } from "./useAsync";

export function WaitlistPage() {
  const { catalog, refreshCounts } = useFounder();
  const toast = useToast();
  const load = useCallback(async () => {
    const [members, pending] = await Promise.all([fetchMembers(), fetchPendingSignupsCount()]);
    return { members: members.filter((m) => m.status === "waitlisted"), pending };
  }, []);
  const { data, error, loading, reload } = useAsync(load);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function change(member: FounderMember, status: MemberStatus, done: string) {
    setBusyId(member.id);
    setActionError(null);
    try {
      await setMemberStatus(member.id, status);
      await reload();
      refreshCounts();
      toast(done, {
        label: "Annulla",
        onClick: async () => {
          try {
            await setMemberStatus(member.id, "waitlisted");
            await reload();
            refreshCounts();
            toast(`${member.firstName} è di nuovo in lista d'attesa.`);
          } catch (e) {
            setActionError(e instanceof ApiError ? e.message : "Non è stato possibile annullare.");
          }
        },
      });
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "Qualcosa non ha funzionato. Riprova.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <title>Lista d'attesa · Pannello · CoffeeMeeting</title>
      <div>
        <h2>Lista d'attesa</h2>
        <p className="admin__intro">
          Chi approvi diventa attivo e rientra nella matrice di disponibilità. Per ora non parte nessuna email.
        </p>
      </div>
      {data && data.pending > 0 && (
        <Notice>
          {data.pending === 1
            ? "1 persona ha compilato il modulo ma non ha ancora confermato l'email: comparirà qui dopo la conferma."
            : `${data.pending} persone hanno compilato il modulo ma non hanno ancora confermato l'email: compariranno qui dopo la conferma.`}
        </Notice>
      )}
      {(error || actionError) && <Notice tone="error">{error ?? actionError}</Notice>}
      {loading && <LoadingState />}
      {data && (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Nome</th>
                <th scope="col">Iscritto il</th>
                <th scope="col">Lavoro</th>
                <th scope="col">Zone</th>
                <th scope="col">Orari</th>
                <th scope="col">Formato</th>
                <th scope="col">Genere · età</th>
                <th scope="col">
                  <span className="visually-hidden">Azioni</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.members.length === 0 && (
                <tr>
                  <td colSpan={8} className="empty">
                    Nessuno in lista d'attesa.
                  </td>
                </tr>
              )}
              {data.members.map((m) => {
                const ga = genderAge(m.gender, m.birthYear);
                return (
                  <tr key={m.id}>
                    <td>
                      {m.firstName}
                      <br />
                      <span className="muted">{m.email}</span>
                    </td>
                    <td>{formatShortDate(m.createdAt)}</td>
                    <td>{m.job}</td>
                    <td>{zoneNames(catalog, m.zoneIds)}</td>
                    <td>{slotNames(catalog, m.slotIds)}</td>
                    <td>{FORMAT_LABEL[m.format]}</td>
                    <td className="mono">
                      <span aria-label={ga.long}>{ga.short}</span>
                    </td>
                    <td className="actions">
                      <Button
                        size="small"
                        disabled={busyId !== null}
                        loading={busyId === m.id}
                        onClick={() => change(m, "active", `Hai approvato ${m.firstName}.`)}
                      >
                        Approva
                      </Button>
                      <Button
                        size="small"
                        variant="secondary"
                        disabled={busyId !== null}
                        onClick={() => change(m, "rejected", `Hai rifiutato ${m.firstName}.`)}
                      >
                        Rifiuta
                      </Button>
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
