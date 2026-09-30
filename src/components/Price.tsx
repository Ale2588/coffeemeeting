import { formatEur } from "../lib/format";
import { Placeholder } from "./Placeholder";

/** Mostra un prezzo, oppure "[DA DEFINIRE] €" se il valore non è ancora stato fornito. */
export function Price({ amount }: { amount: number | null }) {
  if (amount === null) {
    return (
      <>
        <Placeholder /> €
      </>
    );
  }
  return <>{formatEur(amount)}</>;
}
