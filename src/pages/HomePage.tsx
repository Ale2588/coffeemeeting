import { Link } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import { ButtonLink } from "../components/Button";
import { Card } from "../components/Card";
import { PhotoPlaceholder } from "../components/Placeholder";
import { Price } from "../components/Price";
import { SiteFooter } from "../components/SiteFooter";
import { SiteHeader } from "../components/SiteHeader";
import { PILOT } from "../config/pilot";
import { describeSlotDays, describeSlots } from "../lib/format";
import "../styles/home.css";

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function HomePage() {
  const { min, max } = PILOT.groupSize;
  const hours = PILOT.freeCancellationHours;
  const { session } = useAuth();

  return (
    <>
      <title>CoffeeMeeting · Colazioni prima del lavoro, a Milano</title>
      <SiteHeader
        action={
          session ? (
            <Link to="/account" className="text-link">
              Il mio account
            </Link>
          ) : (
            <Link to="/accedi" className="text-link">
              Accedi
            </Link>
          )
        }
      />

      <main id="contenuto">
        <section className="section stack" aria-labelledby="hero-title">
          <h1 id="hero-title">
            Una colazione con persone che non conosci, <em>prima del lavoro.</em>
          </h1>
          <p className="lead">
            Scegli zone e orari. {capitalize(describeSlotDays())} mattina ti mandiamo un invito: un tavolo, poche
            persone di Milano, tre quarti d'ora. Poi si va in ufficio.
          </p>
          <ButtonLink to="/iscriviti" block>
            Iscriviti alla lista d'attesa
          </ButtonLink>
          <p className="hero-note">Non è un'app di incontri. Non scegli le persone, e nessuno sceglie te.</p>
          <PhotoPlaceholder className="hero-photo" />
        </section>

        <section className="section" aria-labelledby="how-title">
          <h2 id="how-title">Come funziona</h2>
          <ol className="steps">
            <li>
              <b>Ti iscrivi</b>
              <span>Zone, orari che ti vanno bene, formato. Entri in lista d'attesa.</span>
            </li>
            <li>
              <b>Ricevi un invito</b>
              <span>Giorno, ora e locale li decidiamo noi. Anche chi siede con te.</span>
            </li>
            <li>
              <b>Confermi e paghi la colazione</b>
              <span>Se non puoi più venire, disdici gratis fino a {hours} ore prima.</span>
            </li>
            <li>
              <b>Dici com'è andata</b>
              <span>In trenta secondi. Nessuno vedrà i tuoi voti.</span>
            </li>
          </ol>
        </section>

        <Card tone="dark" as="section" aria-labelledby="facts-title">
          <h3 id="facts-title">In pratica</h3>
          <dl className="facts">
            <dt>Quando</dt>
            <dd>{describeSlots()}</dd>
            <dt>Durata</dt>
            <dd>Circa {PILOT.durationMinutes} minuti</dd>
            <dt>Al tavolo</dt>
            <dd>
              {min}–{max} persone, oppure uno a uno
            </dd>
            <dt>Colazione</dt>
            <dd>
              <Price amount={PILOT.breakfastPriceEur} />, pagata quando confermi l'invito
            </dd>
            <dt>Abbonamento</dt>
            <dd>
              <Price amount={PILOT.subscriptionMonthlyEur} /> al mese, solo dopo la prima colazione e se vuoi
              continuare
            </dd>
            <dt>Disdetta</dt>
            <dd>Gratis fino a {hours} ore prima. Se hai già pagato, rimborso completo</dd>
          </dl>
        </Card>

        <section className="section" aria-labelledby="without-title">
          <h2 id="without-title">Cosa non trovi</h2>
          <ul className="without">
            <li>Profili da sfogliare o foto da giudicare</li>
            <li>Filtri per genere, età o aspetto</li>
            <li>Chat prima dell'incontro</li>
            <li>Punteggi visibili: i voti restano a noi</li>
          </ul>
        </section>

        <section className="section" aria-labelledby="faq-title">
          <h2 id="faq-title">Domande</h2>
          <div className="faq">
            <details>
              <summary>Chi decide con chi faccio colazione?</summary>
              <p>
                La piattaforma, in base a zone, orari e a com'è andata negli incontri precedenti. Tu scegli solo
                quando e dove ti è comodo.
              </p>
            </details>
            <details>
              <summary>E se qualcuno si comporta male?</summary>
              <p>
                Lo segnali nel riscontro, in forma anonima. Ogni segnalazione la legge una persona, non un algoritmo.
                La frequenza degli inviti dipende anche dal riscontro degli altri partecipanti.
              </p>
            </details>
            <details>
              <summary>Devo abbonarmi subito?</summary>
              <p>No. La prima colazione la paghi e basta. Dopo, decidi se continuare con l'abbonamento.</p>
            </details>
          </div>
        </section>

        <section className="section">
          <ButtonLink to="/iscriviti" block>
            Iscriviti alla lista d'attesa
          </ButtonLink>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
