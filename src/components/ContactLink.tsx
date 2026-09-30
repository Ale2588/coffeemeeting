import { PILOT } from "../config/pilot";
import { Placeholder } from "./Placeholder";

/** "Scrivici": link all'email di contatto, o segnaposto finché non è fornita. */
export function ContactLink({ children = "Scrivici" }: { children?: string }) {
  if (!PILOT.contactEmail) {
    return (
      <span>
        {children} <Placeholder>EMAIL DA FORNIRE</Placeholder>
      </span>
    );
  }
  return (
    <a className="text-link" href={`mailto:${PILOT.contactEmail}`}>
      {children}
    </a>
  );
}
