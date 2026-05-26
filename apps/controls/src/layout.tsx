import { Link, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import type { AuthStatus } from "./contracts";
import { visibleNavigation } from "./view-model";

export function AppLayout({
  auth,
  onLogout,
  children,
}: {
  auth: AuthStatus;
  onLogout: () => void;
  children: ReactNode;
}) {
  const location = useLocation();
  const nav = visibleNavigation(auth.capabilities);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="eyebrow">SIG//AGENCY</span>
          <strong>Terminal Controls</strong>
        </div>
        <nav className="nav">
          {nav.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={location.pathname === item.href ? "active" : ""}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="identity">
          <span>{auth.user?.globalName ?? auth.user?.username}</span>
          <button type="button" onClick={onLogout}>Sign out</button>
        </div>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}

export function PageHeader({ title, kicker }: { title: string; kicker?: string }) {
  return (
    <header className="page-header">
      {kicker ? <span className="eyebrow">{kicker}</span> : null}
      <h1>{title}</h1>
    </header>
  );
}

export function DataState({ error, loading }: { error?: string; loading: boolean }) {
  if (loading) return <div className="notice">Loading</div>;
  if (error) return <div className="notice danger">{error}</div>;
  return null;
}
