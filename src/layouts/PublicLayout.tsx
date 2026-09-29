import { Outlet, ScrollRestoration } from "react-router";

/** Colonna unica mobile-first per le pagine pubbliche e dell'iscritto. */
export function PublicLayout() {
  return (
    <>
      <a className="skip-link" href="#contenuto">
        Vai al contenuto
      </a>
      <div className="page">
        <Outlet />
      </div>
      <ScrollRestoration />
    </>
  );
}
