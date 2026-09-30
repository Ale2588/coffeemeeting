import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "react-router";

type Variant = "primary" | "secondary" | "danger";

type CommonProps = {
  variant?: Variant;
  size?: "default" | "small";
  block?: boolean;
  children: ReactNode;
};

function classes({ variant = "primary", size = "default", block }: Omit<CommonProps, "children">, extra?: string) {
  return [
    "btn",
    `btn--${variant}`,
    size === "small" && "btn--small",
    block && "btn--block",
    extra,
  ]
    .filter(Boolean)
    .join(" ");
}

type ButtonProps = CommonProps &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    /** Mostra la rotella e disattiva il pulsante (es. "Pagamento in corso…"). */
    loading?: boolean;
  };

export function Button({ variant, size, block, loading, disabled, className, children, type = "button", ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={classes({ variant, size, block }, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <span className="btn__spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}

type ButtonLinkProps = CommonProps & { to: string; className?: string };

export function ButtonLink({ variant, size, block, to, className, children }: ButtonLinkProps) {
  return (
    <Link to={to} className={classes({ variant, size, block }, className)}>
      {children}
    </Link>
  );
}
