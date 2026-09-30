import { useCallback, useEffect, useState } from "react";
import { Link, NavLink, Outlet, useNavigate, useOutletContext } from "react-router";
import { Notice } from "../components/Card";
import { LoadingState } from "../components/LoadingState";
import { SiteHeader } from "../components/SiteHeader";
import { ToastProvider } from "../components/Toast";
import { ApiError, signOut } from "../lib/api";
import { fetchFounderCatalog, fetchWaitlistCount, type FounderCatalog } from "./founderApi";
import "../styles/founder.css";

export type FounderContext = {
  catalog: FounderCatalog;
  /** Da chiamare dopo un'azione che cambia i contatori della barra laterale. */
  refreshCounts: () => void;
};

export function useFounder(): FounderContext {
  return useOutletContext<FounderContext>();
}

const NAV = [
  { to: "/pannello", label: "Disponibilità", end: true },
  { to: "/pannello/lista-attesa", label: "Lista d'attesa", counter: "waitlist" as const },
  { to: "/pannello/iscritti", label: "Iscritti" },
  { to: "/pannello/locali", label: "Locali" },
];

/** Pannello del fondatore: barra laterale su desktop, navigazione orizzontale su telefono. */
export function FounderLayout() {
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState<FounderCatalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [waitlist, setWaitlist] = useState<number | null>(null);

  const refreshCounts = useCallback(() => {
    fetchWaitlistCount()
      .then(setWaitlist)
      .catch(() => setWaitlist(null));
  }, []);

  useEffect(() => {
    fetchFounderCatalog()
      .then(setCatalog)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Impossibile caricare il pannello."));
    refreshCounts();
  }, [refreshCounts]);

  async function logout() {
    await signOut();
    navigate("/", { replace: true });
  }

  return (
    <ToastProvider>
      <a className="skip-link" href="#contenuto">
        Vai al contenuto
      </a>
      <div className="page page--wide">
        <SiteHeader
          action={
            <span className="header-actions">
              <Link to="/account" className="text-link">
                Il mio account
              </Link>
              <button type="button" className="text-link" onClick={logout}>
                Esci
              </button>
            </span>
          }
        />
        <div className="admin">
          <aside className="admin__side" aria-label="Sezioni del pannello">
            <p className="label-mono">Pannello</p>
            <nav className="admin__nav">
              {NAV.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} className="admin__link">
                  <span>{item.label}</span>
                  {item.counter === "waitlist" && waitlist !== null && waitlist > 0 && (
                    <span className="count" aria-label={`${waitlist} in attesa`}>
                      {waitlist}
                    </span>
                  )}
                </NavLink>
              ))}
            </nav>
            <p className="admin__fixed">Indicatori di genere ed età visibili solo qui.</p>
          </aside>
          <main id="contenuto" className="admin__main">
            {error && <Notice tone="error">{error}</Notice>}
            {!error && !catalog && <LoadingState />}
            {catalog && <Outlet context={{ catalog, refreshCounts } satisfies FounderContext} />}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
