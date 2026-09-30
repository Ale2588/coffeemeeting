import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

type ToastAction = { label: string; onClick: () => void };
type ToastState = { id: number; message: string; action?: ToastAction } | null;
type ShowToast = (message: string, action?: ToastAction) => void;

const ToastContext = createContext<ShowToast>(() => {});

const DURATION_MS = 8000;

/** Messaggio temporaneo in basso, con un'azione facoltativa (es. "Annulla"). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = useCallback<ShowToast>((message, action) => {
    clearTimeout(timer.current);
    setToast({ id: Date.now(), message, action });
    timer.current = setTimeout(() => setToast(null), DURATION_MS);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {toast && (
          <div className="toast" key={toast.id}>
            <span>{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                className="toast__action"
                onClick={() => {
                  setToast(null);
                  toast.action!.onClick();
                }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ShowToast {
  return useContext(ToastContext);
}
