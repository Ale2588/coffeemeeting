import { formatCents } from "../lib/format";
import { Placeholder } from "./Placeholder";

/** Mostra un prezzo in centesimi, oppure "[DA DEFINIRE] €" se non è ancora pubblico. */
export function Price({ cents }: { cents: number | null }) {
  if (cents === null) {
    return (
      <>
        <Placeholder /> €
      </>
    );
  }
  return <>{formatCents(cents)}</>;
}
