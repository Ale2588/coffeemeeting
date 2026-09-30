import { Notice } from "../components/Card";
import { LoadingState } from "../components/LoadingState";
import { slotLabel } from "../lib/format";
import { slotShort } from "./catalogLabels";
import { fetchAvailability } from "./founderApi";
import { useFounder } from "./FounderLayout";
import { useAsync } from "./useAsync";

// Soglie della specifica: 1–3 non basta, 4–5 un tavolo, 6+ un tavolo e margine.
function level(n: number): { cls: string; text: string } {
  if (n >= 6) return { cls: "cell--3", text: "un tavolo e margine" };
  if (n >= 4) return { cls: "cell--2", text: "un tavolo" };
  if (n >= 1) return { cls: "cell--1", text: "non basta" };
  return { cls: "cell--0", text: "nessuno" };
}

export function AvailabilityPage() {
  const { catalog } = useFounder();
  const { data, error, loading } = useAsync(fetchAvailability);
  const zones = catalog.zones.filter((z) => z.active);
  const slots = catalog.slots.filter((s) => s.active);
  const count = (zoneId: number, slotId: number) =>
    data?.find((c) => c.zoneId === zoneId && c.slotId === slotId)?.members ?? 0;

  return (
    <>
      <title>Disponibilità · Pannello · CoffeeMeeting</title>
      <div>
        <h2>Disponibilità</h2>
        <p className="admin__intro">
          Iscritti attivi o avvisati, non in pausa, per zona e orario. Chi ha scelto più zone è contato in ognuna.
        </p>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {loading && <LoadingState />}
      {data && (
        <>
          <div className="table-scroll">
            <table className="data-table matrix">
              <thead>
                <tr>
                  <th scope="col">Zona</th>
                  {slots.map((s) => (
                    <th scope="col" key={s.id}>
                      {slotShort(s)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {zones.map((z) => (
                  <tr key={z.id}>
                    <th scope="row">
                      {z.name}
                    </th>
                    {slots.map((s) => {
                      const n = count(z.id, s.id);
                      const l = level(n);
                      return (
                        <td key={s.id}>
                          <span className={`cell ${l.cls}`} aria-label={`${z.name}, ${slotLabel(s)}: ${n}, ${l.text}`}>
                            {n}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="legend">
            <span>
              <span className="cell cell--1">1–3</span> non basta
            </span>
            <span>
              <span className="cell cell--2">4–5</span> un tavolo
            </span>
            <span>
              <span className="cell cell--3">6+</span> un tavolo e margine
            </span>
          </div>
        </>
      )}
    </>
  );
}
