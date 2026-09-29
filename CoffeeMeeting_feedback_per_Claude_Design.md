Aggiorna il design e la specifica di CoffeeMeeting con queste correzioni. Mantieni il sistema visivo, il tono dei testi e tutto ciò che non è citato qui.

1. ABBONAMENTO (manca del tutto)
Il modello di ricavo è abbonamento mensile + colazione prepagata.
- Aggiungi l'entità Abbonamento { id, utenteId, piano: mensile|annuale, stato: attivo|scaduto|annullato, rinnovoIl, pagamentoId }.
- Dopo l'approvazione dalla lista d'attesa, l'iscritto riceve il primo invito senza abbonamento: paga solo la colazione.
- Dopo la prima colazione, subito dopo aver inviato il riscontro, compare la proposta di abbonamento (nuova schermata): scelta del piano e pagamento. Tre opzioni: "Attiva l'abbonamento", "Non ora, ricordamelo tra una settimana", "Chiudi il mio account".
- Dalla seconda colazione in poi, senza abbonamento attivo non si ricevono inviti: aggiungi lo stato "Abbonamento non attivo" con "Attiva" e lo stato "Abbonamento scaduto" con "Rinnova".
- Nel pannello del fondatore, nella scheda Tavoli, segnala chi è alla prima colazione, così il fondatore può metterlo a tavola con abbonati attivi.
- Nel riquadro "In pratica" della home mostra due prezzi distinti con segnaposto: abbonamento [DA DEFINIRE] €/mese e colazione [DA DEFINIRE] €.

2. GENERE ED ETÀ NELL'ISCRIZIONE
Il pannello li usa per bilanciare i tavoli, ma l'iscrizione (A2) non li raccoglie.
- Aggiungi a A2 genere e anno di nascita, con la nota: "Servono solo a comporre tavoli equilibrati. Nessun iscritto li vedrà."

3. PUNTEGGIO AGGREGATO
Regola: chi ha un punteggio medio basso nel tempo riceve meno inviti e, dopo una verifica del fondatore, può essere espulso.
- Nella tabella Iscritti aggiungi la colonna "Media voti" (solo fondatore) e un segnale quando è sotto una soglia configurabile.
- Nella scheda dell'iscritto mostra l'andamento della media e i motivi più frequenti ricevuti.
- Nella home pubblica, sezione regole o domande frequenti: "La frequenza degli inviti dipende anche dal riscontro degli altri partecipanti."

4. EQUILIBRIO NEI TAVOLI UNO A UNO
La soglia "Genere sbilanciato ≥75%" non ha senso con due persone. Per i tavoli uno a uno disattiva il controllo sul genere e mantieni solo quello sull'età.

5. SCHERMATE MANCANTI
- Accesso: inserimento email → "Ti abbiamo mandato un link" → link scaduto.
- Pagina iniziale dell'iscritto: prossimi inviti, colazioni fatte, preferenze, stato dell'abbonamento, "Metti in pausa gli inviti" (con data di ripresa).
- Tavolo confermato: schermata dopo il pagamento riuscito (riepilogo, calendario, disdetta ancora visibile).
- Pannello del fondatore, voce "Locali": elenco con nome, indirizzo, zona, note, slot disponibili; aggiungi e modifica. Nella scheda Tavoli, "Assegna locale" sceglie da questo elenco.

6. ZONE MULTIPLE
L'iscritto può scegliere più zone, non una sola (vicino a casa, all'ufficio, sul tragitto). In A2 le pillole delle zone diventano a scelta multipla, con almeno una zona obbligatoria. Nel modello dati Utente.zona diventa zone[]. Il riepilogo in A3 e la pagina dell'iscritto mostrano tutte le zone scelte. La matrice Disponibilità conta un iscritto in ogni zona che ha scelto.

7. Aggiorna di conseguenza il modello dati, la lista delle email transazionali (aggiungi: abbonamento attivato, rinnovo fallito, abbonamento scaduto) e la sezione "Dati ancora da fornire" (aggiungi il prezzo dell'abbonamento).

Restituisci la specifica aggiornata e il file di design aggiornato.
