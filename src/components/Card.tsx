import type { HTMLAttributes, ReactNode } from "react";

type CardProps = HTMLAttributes<HTMLElement> & {
  tone?: "surface" | "dark";
  as?: "div" | "section" | "article";
  children: ReactNode;
};

export function Card({ tone = "surface", as: Tag = "div", className, children, ...rest }: CardProps) {
  const base = tone === "dark" ? "darkbox" : "card";
  return (
    <Tag className={className ? `${base} ${className}` : base} {...rest}>
      {children}
    </Tag>
  );
}

type NoticeProps = {
  tone?: "info" | "dark" | "error";
  children: ReactNode;
};

/** Riquadro di testo: informazione, privacy (scuro) o errore (terracotta). */
export function Notice({ tone = "info", children }: NoticeProps) {
  return (
    <div className={`notice notice--${tone}`} role={tone === "error" ? "alert" : undefined}>
      {children}
    </div>
  );
}
