import type { ReactNode } from "react";
import { Logo } from "./Logo";

export function SiteHeader({ action }: { action?: ReactNode }) {
  return (
    <header className="site-header">
      <Logo />
      {action}
    </header>
  );
}
