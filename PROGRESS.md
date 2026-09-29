# PROGRESS — CoffeeMeeting

## Fase 1 — Fondamenta ✅ (in attesa di conferma)

### Fatto
- Progetto Vite 8 + React 19 + TypeScript (strict) + React Router 7. `npm run build` compila senza errori.
- Token visivi della specifica (sezione 7) in `src/styles/tokens.css`, con tema scuro come nel riferimento `coffeemeeting-demo.html`. Contrasti verificati ≥ 4.5:1 per le coppie testo/fondo usate.
- Tipografia: Newsreader, Instrument Sans, JetBrains Mono (Google Fonts) in `index.html`.
- Componenti base in `src/components/`:
  - `Button` / `ButtonLink` (principale verde, secondario contornato, terracotta per la disdetta; stato di caricamento; variante piccola);
  - `Pill` / `PillGroup` (scelta multipla, con spunta oltre al colore);
  - `OptionCard` / `OptionGroup` (slot in griglia 2×2, formato);
  - `TextField`, `SelectField`, `Checkbox` (etichetta, suggerimento ed errore collegati con attributi aria);
  - `Card` (chiara e scura), `Notice` (info, scuro, errore);
  - `StatusTag` (positivo, avviso, neutro: il testo porta sempre lo stato);
  - `Placeholder` (`[DA DEFINIRE]`), `PhotoPlaceholder`, `Price` (mostra il segnaposto se il prezzo è `null`);
  - `Logo`, `SiteHeader`, `SiteFooter`.
- Layout mobile a colonna unica (`PublicLayout`), aree sicure iOS, link "Vai al contenuto", altezze di tocco ≥ 44px. Verificato a 375px senza scroll orizzontale, in tema chiaro e scuro.
- Home pubblica statica (A1) con i due prezzi in segnaposto (feedback, punto 1) e la frase sulla frequenza degli inviti (feedback, punto 3).
- Parametri del pilota in `src/config/pilot.ts`: slot e zone provvisori, durata, regola delle 12 ore, prezzi `null`.
- Rotte: `/` home; `/iscriviti` e `/accedi` pagine provvisorie ("Non ancora disponibile"); 404; `/componenti` catalogo dei componenti, solo in sviluppo (escluso dal bundle di produzione).
- `vercel.json` con riscrittura per la SPA, `.env.example`, `.gitignore` (esclude `.env*`).

### Manca (fasi successive)
- Fase 2: Supabase, schema e RLS, iscrizione, lista d'attesa, accesso con link via email, pagina dell'iscritto.
- Nessun test automatico per ora: da introdurre con la logica (scadenze, regola delle 12 ore). La libreria di test va concordata.

### Da configurare a mano
- Niente per questa fase. Per il deploy su Vercel: collegare il repository, comando di build `npm run build`, cartella di output `dist`.
- Per la fase 2: creare il progetto Supabase e compilare `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` in `.env.local` e su Vercel.

### Domande aperte per il fondatore
1. Nella home, slot e zone provvisori (mar/gio, 7:45 e 8:30) vanno mostrati o sostituiti da un segnaposto finché non sono confermati?
2. La prima colazione ha un prezzo diverso dalle successive (PRODUCT.md ipotizza 12 € contro 8 €)?
3. Uno a uno: scelto all'iscrizione (specifica) o sbloccato solo da un "vorrei rincontrare" reciproco (PRODUCT.md)?
4. Genere: opzioni della demo (Donna, Uomo, Altro, Preferisco non dirlo). Come si trattano "Altro" e "Preferisco non dirlo" nell'indicatore di equilibrio?
5. File duplicati nel repository: `CLAUDE (1).md` e `CoffeeMeeting - specifica per Claude (1).md` (quest'ultimo è l'unica copia della specifica). Vanno rinominati o rimossi?
