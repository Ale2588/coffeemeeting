# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: Vite + React + Supabase (auth con magic link, database, edge functions per le email), Stripe Checkout per abbonamento e colazioni prepagate, Resend per le email, hosting su Vercel. Scelto perché è uno stack già usato dal fondatore su un progetto precedente e copre il pilota senza backend custom.

## Users

- **Iscritti**: persone che vivono o lavorano a Milano e vogliono conoscere gente nuova in città, in un momento a basso impegno: la colazione prima del lavoro. Usano il servizio dal telefono, spesso in movimento.
- **Operatore (fondatore)**: approva gli iscritti, compone i tavoli, gestisce segnalazioni, sospensioni ed espulsioni. Lavora da desktop e da telefono.
- **Locali partner** (bar, hotel): ospitano i tavoli in slot fissi. Non usano l'app nella prima versione.

## Product Purpose

Far incontrare a colazione, in slot fissi e in locali scelti dalla piattaforma, persone che non si conoscono. È la piattaforma a decidere chi incontra chi, in base a zona, slot preferiti e altre variabili. Il successo è un abbonato che si presenta con regolarità, torna, e allarga la propria rete in città.

## Positioning

- Non è un'app di incontri romantici: l'iscritto non sceglie chi incontrare e non può filtrare per genere. È una regola del prodotto, non uno slogan.
- A decidere gli abbinamenti è la piattaforma, non l'iscritto.
- Usa lo slot della colazione (breve, economico, prima del lavoro) invece della cena o dell'aperitivo.
- Il fondatore gestisce già serate private di networking su invito (fino a circa 15 persone, con presentazioni di libri o simili), che possono diventare il livello superiore riservato.

## Operating Context

- Slot di colazione fissi e predefiniti. L'iscritto indica slot e zona preferiti e la piattaforma propone l'incontro e il luogo.
- L'invito arriva nel calendario personale (file .ics compatibile con Google, Outlook e Apple).
- Dopo ogni colazione l'iscritto dà un voto nascosto a ciascun partecipante. Nessuno vede il voto ricevuto: lo vede solo la piattaforma. Il motivo di un voto basso si raccoglie al momento del voto. Nei casi gravi il fondatore contatta chi ha dato il voto.
- Se il punteggio di un iscritto resta basso nel tempo, riceve meno inviti. L'espulsione arriva sempre dopo una verifica del fondatore.
- Formato: l'iscritto può dichiararsi disponibile a incontri uno a uno, a tavoli di gruppo o a entrambi, e riceve inviti di conseguenza.

## Capabilities and Constraints

- Modello di ricavo: abbonamento mensile più ricavo sulle colazioni, con accordi con locali specifici.
- Lingua: italiano. Città di lancio: Milano, partendo da una sola zona.
- Decisioni aperte (proposte, non ancora confermate):
  - prezzi: 12 € al mese o 99 € all'anno, colazione prepagata a 8 € con circa 5 € al locale, quota agevolata per i soci fondatori, prima colazione singola a 12 €;
  - disdetta gratuita fino a 12 ore prima;
  - approvazione all'ingresso tramite lista d'attesa;
  - dimensione dei tavoli (4-6) e incontri uno a uno sbloccati solo da un "vorrei rivederlo" reciproco dopo un incontro di gruppo;
  - soglie esatte di punteggio per ridurre gli inviti o espellere.

## Brand Commitments

Nome del servizio: **CoffeeMeeting**. Disponibilità del marchio e del dominio da verificare.
- Vincoli GDPR: la logica del punteggio va dichiarata nei termini di servizio, l'espulsione richiede una verifica umana e la possibilità di contestarla.

## Evidence on Hand

Nessuna. Non ci sono ancora iscritti, testimonianze, locali partner confermati o numeri d'uso: non vanno inventati.

## Product Principles

1. Decide la piattaforma: l'iscritto dichiara disponibilità, non sceglie le persone.
2. Nessun filtro per genere, mai.
3. La sicurezza passa da una persona: gli automatismi segnalano, le decisioni gravi le prende il fondatore.
4. Un abbonamento è una promessa di frequenza: le regole che riducono gli inviti sono dichiarate, non nascoste.
5. Chi paga si presenta: la colazione è prepagata e la disdetta ha una scadenza chiara.
