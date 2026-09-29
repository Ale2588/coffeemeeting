import { ButtonLink } from "../components/Button";
import { SiteHeader } from "../components/SiteHeader";
import { StatusTag } from "../components/StatusTag";

/** Pagina provvisoria per le rotte che arrivano nelle fasi successive. */
export function NotYetAvailablePage({ title }: { title: string }) {
  return (
    <>
      <title>{`${title} · CoffeeMeeting`}</title>
      <SiteHeader />
      <main id="contenuto" className="section stack">
        <StatusTag tone="neutral">Non ancora disponibile</StatusTag>
        <h1>{title}</h1>
        <p className="lead">Questa pagina non è ancora attiva. Torna presto.</p>
        <ButtonLink to="/" variant="secondary" block>
          Torna alla home
        </ButtonLink>
      </main>
    </>
  );
}
