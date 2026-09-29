# CLAUDE.md — CoffeeMeeting

Istruzioni per Claude Code. Leggile all'inizio di ogni sessione.

## Cosa stiamo costruendo
Webapp in italiano, mobile-first, che fa incontrare a colazione, prima del lavoro, persone che non si conoscono a Milano. La piattaforma decide chi incontra chi e in quale locale. Stiamo costruendo il **pilota**: una zona, pochi slot, il fondatore compone i tavoli a mano con l'aiuto dell'app.

## Documenti di riferimento (in ordine di priorità)
1. `CoffeeMeeting - specifica per Claude.md`: schermate, modello dati, testi, sistema visivo. È la fonte principale.
2. `CoffeeMeeting_feedback_per_Claude_Design.md`, se presente: correzioni alla specifica (abbonamento dopo la prima colazione, zone multiple, genere ed età all'iscrizione, media voti, schermate mancanti). Dove contraddice la specifica, **vale il feedback**.
3. `PRODUCT.md`: utenti, principi, decisioni aperte.
4. `CoffeeMeeting.dc.html` e `coffeemeeting-demo.html`: riferimenti visivi. Riproduci colori, tipografia e componenti; non copiarne il codice, che è un prototipo.

Se due documenti si contraddicono e l'ordine sopra non basta a decidere, fermati e chiedi.

## Principi non negoziabili
- Nessun filtro per genere, età o aspetto per gli iscritti. Genere ed età sono visibili solo nel pannello del fondatore.
- L'iscritto non sceglie le persone: dichiara zone, slot e formato.
- I voti del riscontro non sono mai visibili agli iscritti, né singoli né aggregati.
- Nessun contenuto inventato nelle pagine pubbliche: dove manca un dato, usa un segnaposto esplicito.
- Ogni scadenza mostra giorno e ora; ogni azione che riguarda soldi dice cosa succede (addebito, nessun addebito, rimborso).
- Fuso orario Europe/Rome per tutte le date e le scadenze.

## Stack
- Vite + React + TypeScript, React Router.
- CSS con variabili (token dalla specifica, sezione 7), niente framework UI pesanti.
- Supabase: autenticazione con link via email, Postgres, Row Level Security su tutte le tabelle, Edge Functions per email, pagamenti e scadenze.
- Stripe Checkout e webhook, in **modalità di prova** finché il fondatore non dice il contrario.
- Resend per le email transazionali.
- Deploy su Vercel.
- Chiavi e segreti solo in variabili d'ambiente. Mantieni aggiornato `.env.example`, non fare mai commit di `.env`.

## Ruoli e sicurezza dei dati
- `iscritto`: vede e modifica solo i propri dati, i propri inviti e i propri riscontri inviati. Degli altri partecipanti vede solo nome e lavoro, e solo per i tavoli confermati.
- `fondatore`: accesso completo tramite pannello. Il ruolo si assegna a mano nel database, mai dall'interfaccia.
- Voti, motivi, genere e anno di nascita: leggibili solo dal ruolo fondatore, a livello di RLS, non solo di interfaccia.

## Ordine di costruzione
Lavora una fase alla volta. A fine fase: verifica che tutto compili, scrivi in `PROGRESS.md` cosa è fatto, cosa manca e cosa va configurato a mano (account, chiavi, DNS), poi fermati e aspetta conferma.

1. **Fondamenta**: progetto Vite, token visivi, tipografia, componenti base (pulsanti, pillole, campi, card, tag di stato), layout mobile. Home pubblica statica.
2. **Iscrizione e accesso**: schema del database e migrazioni Supabase con RLS, iscrizione (zone multiple, slot, formato, genere, anno), lista d'attesa, accesso con link via email, pagina dell'iscritto.
3. **Pannello del fondatore, base**: lista d'attesa (approva/rifiuta), iscritti, locali, matrice di disponibilità.
4. **Tavoli e inviti**: composizione dei tavoli con indicatori di equilibrio, invio inviti, schermata invito, file .ics e link Google Calendar, scadenza di risposta, disdetta con regola delle 12 ore.
5. **Pagamenti**: Stripe Checkout per la colazione, webhook, stati riuscito/fallito, rimborso su disdetta entro le 12 ore. Poi abbonamento proposto dopo la prima colazione, con le tre opzioni.
6. **Riscontro e moderazione**: riscontro dopo la colazione, "vorrei rincontrare", segnalazioni, media voti nel pannello, stati avvisato/sospeso/espulso con le relative schermate.
7. **Email transazionali**: tutte quelle elencate nella specifica e nel feedback.

## Fuori dal pilota
Algoritmo automatico di composizione dei tavoli (il pannello suggerisce, il fondatore decide), app native, chat, profili visibili, pagina per i locali, più città.

## Modo di lavorare
- Codice e nomi tecnici in inglese; testi dell'interfaccia in italiano, copiati dalla specifica quando esistono.
- Commit piccoli, con messaggi chiari.
- Prima di scegliere una libreria non prevista qui, chiedi.
- Se un requisito è ambiguo, proponi un'interpretazione in una riga e chiedi, invece di indovinare.
