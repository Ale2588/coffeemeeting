import { ButtonLink } from "../components/Button";
import { SiteHeader } from "../components/SiteHeader";

export function NotFoundPage() {
  return (
    <>
      <title>Pagina non trovata · CoffeeMeeting</title>
      <SiteHeader />
      <main id="contenuto" className="section stack">
        <p className="label-mono">Errore 404</p>
        <h1>Questa pagina non c'è.</h1>
        <p className="lead">Forse il link è sbagliato o non è più valido.</p>
        <ButtonLink to="/" variant="secondary" block>
          Torna alla home
        </ButtonLink>
      </main>
    </>
  );
}
