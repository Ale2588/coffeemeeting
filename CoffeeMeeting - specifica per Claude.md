# CoffeeMeeting — specifica di prodotto e design

Documento di passaggio per costruire la webapp. Riferimento visivo: `CoffeeMeeting v2.dc.html` (stessa cartella). Dove questo testo e il file divergono, vale questo testo.

## 1. Prodotto in una frase
Webapp in italiano, mobile-first, che fa incontrare a colazione, prima del lavoro, persone che non si conoscono a Milano. La piattaforma decide chi incontra chi e in quale locale.

## 2. Principi non negoziabili
- **Non è un'app di incontri.** Niente cuori, niente scorrimento per scegliere, niente griglie di foto profilo, niente chat prima dell'incontro, niente filtri per genere/età/aspetto.
- **Nessuna scelta delle persone.** L'iscritto sceglie solo zona, slot e formato.
- **Niente estetica da social professionale** (azzurro alla LinkedIn, biglietti da visita, "connessioni").
- **Niente contenuti inventati**: nessuna testimonianza, statistica o locale fittizio nelle pagine pubbliche. Dove manca il dato si usa un segnaposto esplicito finché non arriva quello vero.
- Genere ed età servono **solo** al fondatore per bilanciare i tavoli; non vengono mai mostrati agli iscritti.
- I voti del riscontro **non sono visibili a nessuno** tranne che alla piattaforma (in forma aggregata e nelle segnalazioni).

## 3. Meccanismo
- **Slot fissi**: sempre gli stessi giorni e orari. Valori provvisori: martedì e giovedì, 7:45 e 8:30. Durata circa 45 minuti. *(Da confermare.)*
- **Zone**: aree di Milano. Provvisorie: Porta Venezia, Isola, Navigli, Città Studi, Porta Romana, CityLife, Centrale, Lambrate. *(Da confermare.)*
- **Formati**: tavolo di gruppo (4–6 persone), uno a uno (2 persone), entrambi (decide la piattaforma).
- **Modello di ricavo**: abbonamento (mensile o annuale) + colazione prepagata a ogni incontro. Due prezzi distinti, entrambi `[DA DEFINIRE]`.
- **Abbonamento**: dopo l'approvazione dalla lista d'attesa l'iscritto attiva l'abbonamento. **Senza abbonamento attivo non si ricevono inviti.** Rinnovo automatico; se il rinnovo fallisce l'abbonamento scade.
- **Colazione prepagata**: si conferma l'invito pagando la colazione. Prezzo: `[DA DEFINIRE]`.
- **Scadenza di risposta all'invito**: esempio usato nel design, 20:00 di due giorni prima. *(Parametro configurabile.)*
- **Disdetta**: gratuita fino a **12 ore prima** dell'inizio; se già pagato, rimborso completo. Dopo le 12 ore la colazione non è rimborsabile.
- **Lista d'attesa**: ogni iscrizione entra in lista; il fondatore approva, poi l'iscritto attiva l'abbonamento. Una zona si "apre" quando ci sono abbastanza persone negli stessi slot.
- **Pausa**: l'iscritto può mettere in pausa gli inviti (1 settimana, 2 settimane, 1 mese) con data di ripresa automatica. Durante la pausa l'abbonamento resta attivo *(da confermare)*.
- **Punteggio aggregato**: la media dei voti ricevuti nel tempo influisce sulla frequenza degli inviti. Sotto una soglia configurabile (default 2,5 su 4) l'iscritto riceve meno inviti e, dopo una verifica del fondatore, può essere espulso. Mai automatico; mai visibile all'iscritto. Comunicato pubblicamente come: "La frequenza degli inviti dipende anche dal riscontro degli altri partecipanti."
- **Accesso**: senza password, con link via email valido 15 minuti e monouso *(durata configurabile)*.
- **Riscontro** dopo la colazione, compilabile in meno di 30 secondi.
- **"Vorrei rincontrare"**: segnale facoltativo; se è reciproco, la piattaforma prova a rimettere le due persone allo stesso tavolo. Non viene mai notificato all'altra persona.

## 4. Ruoli
- **Iscritto** (telefono).
- **Fondatore** (desktop prima di tutto, deve funzionare anche da telefono).

## 5. Modello dati (indicativo)
```
Utente { id, nome, email, lavoro, zona, slotPreferiti[], formato: gruppo|uno_a_uno|entrambi,
         genere: donna|uomo|non_binario|non_dichiarato, annoNascita,
         stato: in_attesa|attivo|avvisato|sospeso|espulso, pausaFinoAl?, mediaVoti (calcolata), creatoIl }
Abbonamento { id, utenteId, piano: mensile|annuale, stato: attivo|scaduto|annullato, rinnovoIl, pagamentoId }
LinkAccesso { id, utenteId, token, scadeIl, usatoIl? }
Slot { id, giorno: mar|gio, ora: "07:45"|"08:30" }
Locale { id, nome, indirizzo, zona, note, slotDisponibili[slotId] }
Tavolo { id, slotId, data, localeId, formato, partecipanti[utenteId], stato: bozza|inviato|confermato|concluso }
Invito { id, tavoloId, utenteId, stato: da_confermare|pagamento_in_corso|confermato|pagamento_fallito|scaduto|disdetto,
         scadenzaRisposta, scadenzaDisdetta (= inizio - 12h), pagamentoId? }
Pagamento { id, tipo: colazione|abbonamento, invitoId?, abbonamentoId?, importo, stato: riuscito|fallito|rimborsato, metodo, ultime4 }
Impostazioni { sogliaMediaVoti (default 2.5), durataLinkMinuti (default 15), scadenzaRispostaInvito }
Riscontro { id, tavoloId, autoreId, destinatarioId, voto: 1..4, motivi[], vorreiRincontrare: bool }
Segnalazione { id, segnalatoId, tavoloId, origine: voto_basso|messaggio, motivi[], stato: aperta|chiusa, esito? }
```
Voto a 4 livelli: 1 Faticosa, 2 Così così, 3 Piacevole, 4 Molto piacevole. Voto 1–2 = "basso": mostra i motivi e alimenta le segnalazioni. `mediaVoti` = media dei voti ricevuti; lo storico per colazione serve al grafico di andamento del fondatore.

Motivi rapidi: Non ascoltava · Invadente · Commenti fuori luogo · Voleva vendere qualcosa · Molto in ritardo.

## 6. Schermate

### 01 — Pubblico
**A1 Home pubblica** (una colonna, lunga): intestazione con logotipo + "Accedi" (→ A4); hero con titolo, spiegazione breve, CTA "Iscriviti alla lista d'attesa" e la frase "Non è un'app di incontri. Non scegli le persone, e nessuno sceglie te."; foto reale (segnaposto); "Come funziona" in 4 passi numerati; riquadro scuro "In pratica" (slot fissi, persone al tavolo, **abbonamento [DA DEFINIRE] €/mese**, **colazione [DA DEFINIRE] € prepagata**, regola delle 12 ore); "Cosa non trovi"; 4 domande frequenti (perché non scelgo; comportamenti scorretti, con la frase sulla frequenza degli inviti; quanto costa; perché la lista d'attesa); CTA finale.

**A2 Iscrizione**: nome, email, lavoro (testo libero), genere (Donna, Uomo, Non binario, Preferisco non dirlo) e anno di nascita in un riquadro con la nota "Servono solo a comporre tavoli equilibrati. Nessun iscritto li vedrà.", zona (una, a pillole), slot preferiti (più di uno, griglia 2×2), formato (3 opzioni). Nota sulle regole. Invio → entra in lista d'attesa.

**A3 Lista d'attesa** (stato): etichetta "In lista d'attesa", spiegazione (dopo l'approvazione si attiva l'abbonamento), riepilogo preferenze, "Modifica preferenze". Nessuna posizione in coda inventata.

**A4 Accesso**: inserimento email → "Mandami il link" → "Controlla la posta" (indirizzo, validità 15 minuti, monouso; "Rimanda il link", "Ho sbagliato email").

**A5 Link scaduto**: "Questo link non vale più." + "Mandami un nuovo link".

### 02 — Iscritto
**B1 Attivazione abbonamento** (dopo l'approvazione): "Iscrizione approvata"; scelta del piano Mensile / Annuale con prezzi segnaposto; ricordo che la colazione si paga a parte; data di rinnovo automatico; "Attiva e paga" → "Pagamento in corso…" → "Abbonamento attivo".

**B2 Pagina iniziale dell'iscritto**: saluto; banner "Inviti in pausa fino a…" con "Riprendi ora" se in pausa; prossimo invito (data, locale, persone, scadenza, "Apri l'invito"); colazioni fatte; stato abbonamento (piano, stato, rinnovo); preferenze con "Modifica"; "Metti in pausa gli inviti" → scelta durata → data di ripresa → conferma.

**B3 Invito** — il momento chiave. Mostra: giorno e ora in grande, locale e indirizzo con mappa, numero di partecipanti ("5 persone, tu compreso"), prezzo.
- "Aggiungi al calendario" con un tocco (file .ics / link Google).
- Pulsante principale "Conferma e paga [prezzo] €" → stato "Pagamento in corso…" → confermato o fallito.
- Scadenza di risposta visibile sopra il pulsante.
- **Disdetta sempre visibile** in basso: "Non puoi più venire? Disdetta gratuita fino a [giorno ora] (12 ore prima)" + pulsante "Disdici" (terracotta, contornato).
- Pannello di conferma disdetta: testo diverso se già pagato (rimborso) o no (nessun addebito); promemoria su cosa succede dopo la scadenza; "Sì, disdici" / "Torna all'invito".

**B4 Tavolo confermato** (dopo il pagamento riuscito): "Confermato · pagato", data e ora in grande, riepilogo (locale, indirizzo, mappa, persone, importo pagato), "Aggiunto al calendario", indicazione su come trovare il tavolo, disdetta ancora visibile ("Disdetta gratuita e rimborso fino a [giorno ora] (12 ore prima)").

**B5 Riscontro**: titolo "Com'è andata con ciascuno?"; riquadro scuro "Nessuno vedrà i tuoi voti…"; per ogni persona nome + lavoro (nessuna foto), 4 pulsanti di voto; se voto basso compaiono i motivi (facoltativi); casella "Vorrei rincontrare [nome]". Contatore "N di M". Invio → "Grazie. Buona giornata di lavoro." Link "È successo qualcosa di grave? Scrivici".

**Stati obbligatori**
- **S1 Nessuno slot nella tua zona**: account attivo ma mancano persone; suggerisce zone vicine e altri slot da aggiungere; "Salva preferenze".
- **S2 Invito scaduto**: invito barrato, "Il posto è passato a un'altra persona", nessun addebito; "Attiva promemoria", "Metti in pausa gli inviti".
- **S3 Pagamento fallito**: carta rifiutata (ultime 4 cifre), nessun addebito, fino a quando resta il posto; "Riprova", "Usa un altro metodo".
- **S4 Account sospeso**: niente inviti; mail con dettagli; chi ha segnalato resta anonimo; possibilità di rispondere; colazioni pagate rimborsate; "Scrivici".
- **S5 Abbonamento scaduto**: "Per ora non ti mandiamo inviti"; motivo (es. rinnovo fallito, ultime 4 cifre); preferenze salvate; piano e prezzo; "Rinnova", "Cambia metodo di pagamento".

### 03 — Pannello del fondatore (desktop, barra laterale + contenuto)
Navigazione: Disponibilità · Tavoli · Locali · Lista d'attesa (con contatore) · Segnalazioni (con contatore) · Iscritti. Nota fissa: "Indicatori di genere ed età visibili solo qui."

- **Disponibilità**: matrice zona × slot con numero di iscritti attivi **con abbonamento attivo** e non in pausa; colore per soglie (1–3, 4–5 "tavolo", 6+).
- **Tavoli**: schede proposta con zona/data/ora, formato, locale, partecipanti (nome, lavoro, genere · età). Colonna laterale:
  - **Assegna locale**: sceglie dall'elenco Locali, filtrato per zona e slot del tavolo; se non c'è nulla, link per aggiungerne uno.
  - **Equilibrio**: barra del genere, fascia d'età e scarto. Etichetta: "Equilibrato" / "Genere sbilanciato" (≥75% stesso genere, **solo tavoli di gruppo**) / "Età molto distanti" (scarto > 25 anni). **Nei tavoli uno a uno il controllo sul genere è disattivato** ("Non valutato nei tavoli uno a uno"); resta solo quello sull'età.
  - Azioni: "Invia inviti" (disabilitato finché non c'è un locale: "Assegna un locale"), "Modifica". Gli inviti partono solo dopo approvazione.
- **Locali**: tabella nome, indirizzo, zona, note, slot disponibili; "Aggiungi locale" e "Modifica" aprono lo stesso modulo (nome, indirizzo, zona, note, slot).
- **Lista d'attesa**: tabella nome, data iscrizione, lavoro, zona, slot, formato; "Approva" / "Rifiuta" con annulla. L'approvazione invia l'email con il link per attivare l'abbonamento.
- **Segnalazioni**: coda con segnalato, contesto (tavolo e data), da quante persone, motivi, storico; azioni Avvisa / Sospendi / Espelli / Archivia; l'esito aggiorna lo stato dell'iscritto.
- **Iscritti**: controllo della soglia della media voti (− / +, su 4) con conteggio di chi è sotto; filtri per stato con conteggi; tabella nome, lavoro, zona, colazioni fatte, **media voti** (con segnale "sotto soglia"), stato (pillola), menu per cambiarlo.
  - **Scheda dell'iscritto** (clic sul nome): dati di base, stato, media, nota su cosa comporta essere sotto soglia; grafico dell'andamento (media ricevuta per colazione, ultime 6, con linea della soglia); motivi più frequenti ricevuti con conteggio.

## 7. Sistema visivo
Direzione: caffè milanese classico — carta calda, inchiostro scuro, serif editoriale. Verde bottiglia come colore principale; terracotta solo per avvisi, disdetta ed errori.

| Ruolo | Colore |
|---|---|
| Fondo tela / carta | `#F5EFE6` |
| Superficie (card, input) | `#FFFCF7` |
| Inchiostro | `#2B211B` |
| Testo secondario | `#4A3E36` / `#6E6158` |
| Linee | `#E3D8CA`, bordi controlli `#CDBFAE` |
| Accento principale (CTA, conferme) | `#2F5D4E`, tinta chiara `#DCE7E0` / `#E4ECE6`, media `#A9C4B6` |
| Avvisi, disdetta, errori (terracotta) | `#A8491F`, testo su tinta `#8A3C18`, tinte `#F3E0D3` / `#F6E6DA` |
| Genere secondario nella barra (solo fondatore) | `#B98B3E` |

Tipografia (Google Fonts):
- **Newsreader** (500, corsivo per enfasi) — titoli e numeri grandi. H1 mobile 34–44px, interlinea ~1.05, tracking −0.01/−0.02em.
- **Instrument Sans** (400/500/600) — testo e interfaccia. Corpo 15–17px, interlinea 1.45–1.5.
- **JetBrains Mono** — etichette in maiuscolo, stati, metadati (11–13px, tracking +0.06em).

Logotipo: "Coffee" in Newsreader 600 + "Meeting" corsivo 500 nel colore principale.

Forme: raggio 12–14px per pulsanti e input, 18px per card, pillole a 999px. Altezza minima di tocco 44px (pulsanti principali 52–56px). Niente ombre pesanti né sfumature. Le immagini sono foto reali; fino ad allora, riquadri a righe con etichetta in monospazio.

## 8. Tono dei testi
Italiano, dare del tu, caldo e diretto, frasi brevi. Scadenze sempre esplicite con giorno e ora ("mercoledì 30 settembre, 19:45"). Dire sempre cosa succede ai soldi (addebito, nessun addebito, rimborso). Nessun gergo da social o da dating.

## 9. Requisiti tecnici
- Mobile-first, reattiva; il pannello del fondatore è pensato per desktop ma deve restare usabile da telefono.
- Accessibilità: contrasto testo ≥ 4.5:1, obiettivi di tocco ≥ 44px, stati non affidati al solo colore.
- Pagamento con un provider (es. Stripe): colazione (riuscito, fallito, rimborso in caso di disdetta entro le 12 ore) e abbonamento ricorrente (attivazione, rinnovo automatico, rinnovo fallito → scaduto, annullamento).
- Il motore di composizione esclude chi non ha abbonamento attivo, chi è in pausa, sospeso o espulso, e riduce la frequenza per chi è sotto soglia.
- Email transazionali: link di accesso, iscrizione ricevuta, approvazione (con link per attivare l'abbonamento), abbonamento attivato, rinnovo fallito, abbonamento scaduto, nuovo invito, promemoria scadenza, conferma, disdetta, riscontro, sospensione.
- Calendario: file .ics e link "aggiungi a Google Calendar".
- Fuso orario Europe/Rome per tutte le scadenze.

## 10. Dati ancora da fornire
- Prezzo della colazione.
- Prezzo dell'abbonamento mensile e annuale.
- Se la pausa sospende anche il pagamento dell'abbonamento.
- Slot, zone e locali reali (nome, indirizzo).
- Scadenza esatta per rispondere a un invito.
- Foto reali per la home.
- Testo delle regole della comunità e informativa privacy.
