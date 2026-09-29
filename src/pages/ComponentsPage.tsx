import { useState } from "react";
import { Button, ButtonLink } from "../components/Button";
import { Card, Notice } from "../components/Card";
import { Checkbox, SelectField, TextField } from "../components/Field";
import { OptionCard, OptionGroup } from "../components/OptionCard";
import { Pill, PillGroup } from "../components/Pill";
import { PhotoPlaceholder, Placeholder } from "../components/Placeholder";
import { SiteHeader } from "../components/SiteHeader";
import { StatusTag } from "../components/StatusTag";
import { SLOTS, WEEKDAY_LABEL, ZONES } from "../config/pilot";

const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

/** Catalogo dei componenti base. Montato solo in sviluppo (vedi router). */
export function ComponentsPage() {
  const [zones, setZones] = useState<string[]>(["Porta Venezia"]);
  const [slots, setSlots] = useState<string[]>(["mar-7:45"]);
  const [format, setFormat] = useState("gruppo");
  const [loading, setLoading] = useState(false);

  return (
    <>
      <title>Componenti · CoffeeMeeting</title>
      <SiteHeader action={<span className="label-mono">Solo sviluppo</span>} />
      <main id="contenuto">
        <section className="section stack">
          <p className="label-mono">Tipografia</p>
          <h1>
            Titolo H1 <em>in corsivo</em>
          </h1>
          <h2>Titolo H2</h2>
          <h3>Titolo H3</h3>
          <p className="lead">Testo introduttivo, Instrument Sans 17px.</p>
          <p>Corpo del testo, 16px, interlinea 1.5.</p>
          <p className="label-mono">Etichetta in monospazio</p>
        </section>

        <section className="section stack">
          <p className="label-mono">Pulsanti</p>
          <Button block>Conferma e paga</Button>
          <Button block loading={loading} onClick={() => setLoading(true)}>
            {loading ? "Pagamento in corso…" : "Prova lo stato di caricamento"}
          </Button>
          <Button variant="secondary" block>
            Aggiungi al calendario
          </Button>
          <Button variant="danger" block>
            Disdici
          </Button>
          <div className="button-row">
            <Button size="small">Approva</Button>
            <Button size="small" variant="secondary">
              Rifiuta
            </Button>
            <ButtonLink to="/" size="small" variant="secondary">
              Link
            </ButtonLink>
          </div>
          <Button block disabled>
            Disattivato
          </Button>
        </section>

        <section className="section">
          <p className="label-mono">Campi</p>
          <TextField label="Nome" autoComplete="given-name" />
          <TextField label="Email" type="email" error="Controlla l'indirizzo email." defaultValue="chiara@" />
          <TextField
            label="Che lavoro fai"
            hint="Lo vedranno le persone al tuo tavolo, dopo la conferma."
          />
          <SelectField
            label="Genere"
            placeholder="Scegli"
            options={[
              { value: "donna", label: "Donna" },
              { value: "uomo", label: "Uomo" },
            ]}
          />
          <div className="field">
            <span className="field__label" id="lbl-zone">
              Zone comode
            </span>
            <PillGroup labelId="lbl-zone">
              {ZONES.map((z) => (
                <Pill key={z} selected={zones.includes(z)} onToggle={() => setZones(toggle(zones, z))}>
                  {z}
                </Pill>
              ))}
            </PillGroup>
          </div>
          <div className="field">
            <span className="field__label" id="lbl-slot">
              Orari che ti vanno bene
            </span>
            <OptionGroup labelId="lbl-slot" grid>
              {SLOTS.map(({ day, time }) => {
                const key = `${day}-${time}`;
                return (
                  <OptionCard
                    key={key}
                    selected={slots.includes(key)}
                    onSelect={() => setSlots(toggle(slots, key))}
                    title={WEEKDAY_LABEL[day].replace(/^./, (c) => c.toUpperCase())}
                    detail={time}
                  />
                );
              })}
            </OptionGroup>
          </div>
          <div className="field">
            <span className="field__label" id="lbl-format">
              Formato
            </span>
            <OptionGroup labelId="lbl-format">
              <OptionCard selected={format === "gruppo"} onSelect={() => setFormat("gruppo")} title="Tavolo di gruppo" detail="4–6 persone" />
              <OptionCard selected={format === "uno"} onSelect={() => setFormat("uno")} title="Uno a uno" detail="2 persone" />
              <OptionCard selected={format === "entrambi"} onSelect={() => setFormat("entrambi")} title="Entrambi" detail="Decidiamo noi volta per volta" />
            </OptionGroup>
          </div>
          <div className="field">
            <Checkbox label="Vorrei rincontrare Giulia" />
          </div>
        </section>

        <section className="section stack">
          <p className="label-mono">Tag di stato</p>
          <div className="pills">
            <StatusTag>Confermato</StatusTag>
            <StatusTag tone="warning">Pagamento fallito</StatusTag>
            <StatusTag tone="neutral">In lista d'attesa</StatusTag>
          </div>
        </section>

        <section className="section stack">
          <p className="label-mono">Card e riquadri</p>
          <Card>
            <dl className="kv">
              <dt>Zone</dt>
              <dd>Porta Venezia, Isola</dd>
              <dt>Prezzo</dt>
              <dd>
                <Placeholder /> €
              </dd>
            </dl>
          </Card>
          <Card tone="dark">
            <h3>Riquadro scuro</h3>
          </Card>
          <Notice>Iscrivendoti accetti le regole della comunità.</Notice>
          <Notice tone="dark">Nessuno vedrà i tuoi voti.</Notice>
          <Notice tone="error">
            <b>Carta rifiutata.</b> Non ti abbiamo addebitato nulla.
          </Notice>
          <PhotoPlaceholder />
        </section>
      </main>
    </>
  );
}
