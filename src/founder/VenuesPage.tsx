import { Link } from "react-router";
import { ButtonLink } from "../components/Button";
import { Notice } from "../components/Card";
import { LoadingState } from "../components/LoadingState";
import { StatusTag } from "../components/StatusTag";
import { slotNames } from "./catalogLabels";
import { fetchVenues } from "./founderApi";
import { useFounder } from "./FounderLayout";
import { useAsync } from "./useAsync";

export function VenuesPage() {
  const { catalog } = useFounder();
  const { data, error, loading } = useAsync(fetchVenues);
  const zoneName = (id: number) => catalog.zones.find((z) => z.id === id)?.name ?? "—";

  return (
    <>
      <title>Locali · Pannello · CoffeeMeeting</title>
      <div className="admin__toolbar">
        <div>
          <h2>Locali</h2>
          <p className="admin__intro">I tavoli si assegnano a un locale di questo elenco.</p>
        </div>
        <ButtonLink to="/pannello/locali/nuovo" size="small">
          Aggiungi locale
        </ButtonLink>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {loading && <LoadingState />}
      {data && (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Nome</th>
                <th scope="col">Indirizzo</th>
                <th scope="col">Zona</th>
                <th scope="col">Slot disponibili</th>
                <th scope="col">Note</th>
                <th scope="col">Stato</th>
                <th scope="col">
                  <span className="visually-hidden">Azioni</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty">
                    Nessun locale. Aggiungi il primo locale partner.
                  </td>
                </tr>
              )}
              {data.map((v) => (
                <tr key={v.id}>
                  <td>{v.name}</td>
                  <td>{v.address}</td>
                  <td>{zoneName(v.zoneId)}</td>
                  <td>{slotNames(catalog, v.slotIds) || <span className="muted">Nessuno</span>}</td>
                  <td className="muted">{v.notes || "—"}</td>
                  <td>
                    {v.active ? <StatusTag>Attivo</StatusTag> : <StatusTag tone="neutral">Non attivo</StatusTag>}
                  </td>
                  <td className="actions">
                    <Link to={`/pannello/locali/${v.id}`} className="text-link">
                      Modifica<span className="visually-hidden"> {v.name}</span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
