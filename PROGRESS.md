# PROGRESS — CoffeeMeeting

## Decisioni del fondatore (29 settembre 2026)
- **Slot in home**: il riquadro "In pratica" elenca gli slot che la piattaforma offre. Ognuno sceglie i propri all'iscrizione.
- **Prima colazione**: stesso prezzo delle successive, ma fuori dall'abbonamento. Per le colazioni successive serve l'abbonamento.
- **Formato**: si sceglie all'iscrizione e si può sempre modificare: dice a cosa si è disponibili.
- **Genere "Altro" / "Preferisco non dirlo"**: non pesano nell'equilibrio dei tavoli. Si raccolgono solo per le statistiche.
- **Duplicati**: `CLAUDE (1).md` è stato rimosso. La specifica, che esisteva solo come `… (1).md`, è stata rinominata `CoffeeMeeting - specifica per Claude.md`.

## Fase 1 — Fondamenta ✅
- Vite 8 + React 19 + TypeScript (strict) + React Router 7.
- Token visivi (specifica, sezione 7) in `src/styles/tokens.css`, con tema scuro. Contrasti ≥ 4.5:1 verificati.
- Componenti base in `src/components/`: pulsanti, pillole, opzioni a scheda, campi e gruppi di campi, card, avvisi, tag di stato, segnaposto, prezzo.
- Home pubblica (A1), con prezzi in segnaposto.
- Catalogo dei componenti su `/componenti`, solo in sviluppo.

## Fase 2 — Iscrizione e accesso ✅

### Fatto
- **Database** (`supabase/migrations/20260929120000_signup_and_access.sql`):
  - tabelle `zones`, `slots` (con i valori provvisori), `profiles`, `profile_zones`, `profile_slots`, `profile_private` (genere, anno di nascita), `pending_signups`;
  - RLS attiva su tutte le tabelle. Gli iscritti hanno solo lettura sulle proprie righe; ogni scrittura passa da funzioni che validano i dati. Un iscritto non può cambiarsi ruolo o stato;
  - genere e anno di nascita sono leggibili **solo dal fondatore**, a livello di RLS: nemmeno l'iscritto rilegge i propri;
  - il profilo nasce solo quando l'email è confermata dal link (trigger su `auth.users`). Fino ad allora l'iscrizione resta in `pending_signups`, senza accesso dai client;
  - funzioni: `submit_signup` (iscrizione, non rivela se l'email è già iscritta), `update_my_preferences`, `set_my_invite_pause`, `claim_pending_signup` (recupero), `is_founder`;
  - il ruolo `founder` si assegna solo in SQL.
- **Test del database**: `npm run test:db` avvia un Postgres locale temporaneo con una simulazione minima di Supabase, applica le migrazioni ed esegue `supabase/tests/phase2_test.sql`. Verifica validazioni, RLS per anonimo, iscritto e fondatore, conferma email, preferenze, pausa e recupero. Tutti i test passano.
- **Interfaccia**:
  - `/iscriviti` (A2): zone multiple (almeno una), slot, formato, email, genere e anno con la nota di riservatezza. Errori per campo, con il fuoco sul primo campo sbagliato. Controllo maggiore età. Poi "Ti abbiamo mandato un link";
  - `/accedi`: email, poi "Ti abbiamo mandato un link" con scadenza in giorno e ora (Europe/Rome), reinvio dopo 60 s e cambio email. Non rivela se un'email è iscritta;
  - `/auth/callback`: entra nell'account, oppure mostra "Questo link non vale più" e chiede un nuovo link;
  - `/account`: in base allo stato:
    - lista d'attesa (A3, senza posizione in coda);
    - pagina dell'iscritto attivo: prossimi inviti, abbonamento, preferenze, pausa con data di ripresa;
    - sospeso (S4 provvisorio);
    - espulso o rifiutato;
  - `/account/preferenze`: modifica di nome, lavoro, zone, orari e formato. Genere e anno non si modificano.
- Link "Il mio account" nella home quando la sessione è attiva.
- Flussi provati nel browser a 375px, con le risposte di Supabase simulate: iscrizione (validazioni e invio), accesso, link scaduto, reindirizzamento senza sessione, lista d'attesa, pausa e ripresa, modifica preferenze. Nessuno scroll orizzontale, nessun errore in console.
- Modelli email in italiano per il link (`supabase/templates/`).

### Manca / rimandato
- "Colazioni fatte", prossimi inviti reali e stato dell'abbonamento nella pagina dell'iscritto: arrivano con le fasi 4 e 5.
- Testi definitivi di S4 (sospensione): fase 6.
- Email "iscrizione ricevuta": fase 7. Per ora l'unica email è quella del link di Supabase.
- `submit_signup` è chiamabile senza accesso e non ha un limite di frequenza proprio. Protegge solo il limite di invio email di Supabase. Se arriva spam: captcha (Supabase supporta hCaptcha e Turnstile).
- Gli slot della home vengono ancora da `src/config/pilot.ts`, non dal database: se cambi gli slot nel database, aggiorna anche quel file.
- Non è stata provata contro un progetto Supabase vero: in questo ambiente non c'è Docker. Il database è verificato su Postgres 16, l'interfaccia con risposte simulate.

### Stato della configurazione (30 settembre 2026)
- Progetto Supabase creato (`bekiynzalqnvfvvimexb`), migrazione della fase 2 eseguita dal SQL Editor.
- URL Configuration fatta.
- Email (modelli in italiano, SMTP con Resend, dominio, limiti di invio): rimandate a fine progetto, su decisione del fondatore. Fino ad allora vale l'invio incluso di Supabase, che manda solo agli indirizzi del team del progetto: basta per le prove.
- Da fare alla messa online: variabili `VITE_SUPABASE_URL` (senza `/rest/v1/`) e `VITE_SUPABASE_ANON_KEY` su Vercel.

### Da configurare a mano
1. **Progetto Supabase** (regione UE, es. Francoforte):
   - applica la migrazione: `npx supabase link --project-ref <ref>` e poi `npx supabase db push`, oppure incolla il file SQL nell'editor SQL;
   - compila `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` in `.env.local` e nelle variabili d'ambiente di Vercel.
2. **Authentication → URL Configuration**:
   - Site URL: il dominio di produzione;
   - Redirect URLs: `https://<dominio>/auth/callback`, `http://localhost:5173/auth/callback` e l'eventuale dominio di anteprima Vercel (`https://*.vercel.app/auth/callback`).
3. **Authentication → Providers → Email**: attivo, "Confirm email" attivo, "Email OTP Expiration" = 3600 secondi. Deve coincidere con `PILOT.loginLinkValidityMinutes`.
4. **Authentication → Email Templates**: incolla `supabase/templates/confirmation.html` in "Confirm signup" e `supabase/templates/magic_link.html` in "Magic Link". Gli oggetti sono indicati in cima ai file.
5. **SMTP personalizzato (necessario)**: il servizio email incluso in Supabase manda pochissime email all'ora ed è pensato solo per le prove. Configura Resend in Authentication → SMTP Settings. Serve un dominio verificato su Resend (record DNS SPF e DKIM).
6. **Account del fondatore**: iscriviti dal sito, conferma l'email, poi nell'editor SQL:
   `update public.profiles set role = 'founder', status = 'active' where email = '<tua email>';`

### Dati ancora da fornire
- Prezzo della colazione e dell'abbonamento.
- Email di contatto per "Scrivici" (`PILOT.contactEmail`).
- Testo delle regole della comunità e informativa privacy.
- Foto reali per la home.
- Conferma di slot e zone.

### Decisioni
- Età minima 18 anni: confermata.
- Genere e anno sbagliati: per ora l'iscritto scrive al fondatore. In produzione si valuterà un agente di controllo.

## Fase 3 — Pannello del fondatore, base ✅

### Fatto
- **Database** (`supabase/migrations/20260930090000_founder_panel.sql`):
  - tabelle `venues` (locali), `venue_slots` (slot disponibili per locale), `member_status_events` (storico dei cambi di stato, con autore e data);
  - RLS attivata subito dopo ogni tabella; lettura solo per il fondatore;
  - funzioni riservate al fondatore: `founder_set_member_status` (restituisce lo stato precedente per "Annulla"; non tocca il ruolo; il fondatore non può cambiare il proprio stato), `founder_save_venue`, `founder_availability`, `founder_pending_signups_count`.
- **Test del database**: `supabase/tests/phase3_test.sql` (permessi, approvazione e annullamento, storico, matrice con pausa e sospensione, locali, visibilità di genere e anno). Le funzioni di supporto sono in `supabase/tests/helpers.sql`. `npm run test:db` passa per le fasi 2 e 3.
- **Pannello** (`/pannello`, solo ruolo fondatore; chi non lo è viene rimandato a `/account`):
  - **Disponibilità**: matrice zona × slot con iscritti attivi o avvisati e non in pausa, contati in ogni zona scelta. Soglie 1–3, 4–5, 6+ con colore e segno (● / ●●), non solo colore;
  - **Lista d'attesa**: nome, email, data d'iscrizione, lavoro, zone, orari, formato, genere · età. "Approva" / "Rifiuta" con "Annulla" per 8 secondi. Contatore nella barra laterale. Avviso con il numero di iscrizioni non ancora confermate via email;
  - **Iscritti**: filtri per stato con conteggi, tabella con genere · età e stato, menu "Cambia…" con conferma (testo specifico per sospensione ed espulsione) e "Annulla";
  - **Locali**: elenco con nome, indirizzo, zona, slot disponibili, note, stato; aggiungi e modifica.
  - Nota fissa: "Indicatori di genere ed età visibili solo qui."
- Link "Pannello" nella pagina dell'iscritto, solo per il fondatore.
- Provato nel browser (1280px e 375px) con risposte di Supabase simulate: navigazione, approva e annulla, cambio stato con conferma, aggiunta e modifica locale, blocco per chi non è fondatore. Nessun errore in console.

### Manca / rimandato
- Colonna "Colazioni" (mostra "—") e "Media voti": fasi 4 e 6.
- Scheda dell'iscritto con andamento della media e motivi: fase 6.
- Voci "Tavoli" e "Segnalazioni": fasi 4 e 6.
- Email di approvazione: fase 7. Andrà inviata con un piccolo ritardo, così "Annulla" resta possibile.

### Da configurare a mano
- Eseguire nel SQL Editor la nuova migrazione `supabase/migrations/20260930090000_founder_panel.sql` (stesso procedimento della fase 2).
- Se non l'hai già fatto: iscriviti dal sito e poi `update public.profiles set role = 'founder', status = 'active' where email = '<tua email>';`

## Fase 4 — Tavoli e inviti ✅ (in attesa di conferma)

### Decisioni del fondatore (30 settembre 2026)
- Scadenza di risposta: 20:00 di due giorni prima.
- Fino alla fase 5 si conferma senza pagare; l'interfaccia lo dice ("Fase di prova: nessun addebito").
- Degli altri partecipanti si vedono nome e lavoro solo dopo aver confermato, e solo di chi ha confermato.

### Fatto
- **Database** (`supabase/migrations/20260930120000_meetups_and_invitations.sql`):
  - `app_settings`: scadenza di risposta (giorni prima e ora) e ore di disdetta gratuita, configurabili;
  - `meetups` (tavoli: zona, slot, data, formato, locale, stato bozza/inviato/annullato, inizio e scadenza calcolati in Europe/Rome) e `invitations`;
  - l'iscritto non legge direttamente tavoli, inviti o locali: usa `my_invitations` (senza le note del locale), `my_meetup_companions` (solo nome e lavoro), `confirm_invitation`, `cancel_invitation`;
  - il fondatore: `founder_save_meetup` (bozze), `founder_send_meetup` (4–6 persone per il gruppo, 2 per l'uno a uno, locale obbligatorio), `founder_add_participant` (almeno 24 ore per rispondere a chi entra tardi), `founder_cancel_meetup`, `founder_breakfast_counts`;
  - un invito in attesa oltre la scadenza risulta scaduto subito; `expire_overdue_invitations()` lo rende persistente se programmato con pg_cron (facoltativo);
  - nessuno può stare in due tavoli nello stesso giorno e orario.
- **Test del database**: `supabase/tests/phase4_test.sql` (visibilità, validazioni, orari in Europe/Rome, conferma, compagni, scadenza, disdetta entro e oltre le 12 ore, aggiunta tardiva, sospesi, annullamento, colazioni fatte). `npm run test:db` passa per le fasi 2–4.
- **Pannello → Tavoli**:
  - bozze, inviti inviati (con "N di M confermati" e stato di ciascun invito), passati e annullati;
  - nuovo tavolo: zona, orario, data (prossime 8 date dello slot, "tardi" se la scadenza è già passata), formato, locale (prima quelli della zona e dell'orario), partecipanti suggeriti (zona, orario e formato compatibili, non in pausa, non già occupati), con "prima volta" e genere · età; opzione per mostrare anche gli altri;
  - colonna di equilibrio: barra del genere (non valutata per l'uno a uno; "Altro" e "Preferisco non dirlo" non pesano), fascia e scarto d'età, numero di persone; etichette "Equilibrato", "Genere sbilanciato" (≥75%), "Età molto distanti" (> 25 anni);
  - "Invia inviti" con conferma; "Aggiungi una persona" a un tavolo inviato; "Annulla tavolo".
- **Iscritto**:
  - pagina dell'account: prossimi inviti con stato e scadenza, colazioni fatte;
  - pagina dell'invito (`/invito/:id`): biglietto con giorno e ora, locale, indirizzo e link alla mappa, persone al tavolo, durata, prezzo (segnaposto); "Aggiungi al calendario" (.ics) e Google Calendar; scadenza di risposta; conferma; disdetta sempre visibile con la regola delle 12 ore e cosa succede ai soldi;
  - tavolo confermato: timbro "Confermato", nome e lavoro di chi ha confermato;
  - stati: invito scaduto (con rimando alla pausa), disdetto, tavolo annullato dal fondatore, colazione conclusa.
- Colonna "Colazioni" nella pagina Iscritti del pannello.
- Provato nel browser (1280px e 375px) con Supabase simulato: composizione, equilibrio, invio, invito, file .ics (7:45 Roma = 05:45 UTC), conferma, compagni, disdetta, scaduto. Nessun errore in console.

### Manca / rimandato
- Pagamento alla conferma e rimborso: fase 5.
- "Attiva promemoria" nell'invito scaduto e tutte le email (nuovo invito, promemoria, conferma, disdetta): fase 7.
- Riscontro dopo la colazione: fase 6.
- Abbonamento come condizione per ricevere inviti dopo la prima colazione: fase 5.

### Da configurare a mano
- Eseguire nel SQL Editor `supabase/migrations/20260930120000_meetups_and_invitations.sql`.
- Facoltativo: rendere persistenti gli inviti scaduti ogni 10 minuti (Database → Extensions → attiva `pg_cron`, poi nel SQL Editor):
  `select cron.schedule('scadenza-inviti', '*/10 * * * *', $$select public.expire_overdue_invitations()$$);`
