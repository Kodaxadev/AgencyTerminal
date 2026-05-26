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
        <div className="sidebar-divider"></div>
        <nav className="nav">
          {nav.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={location.pathname === item.href ? "active" : ""}
            >
              <span className="nav-prefix">// </span>{item.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-divider"></div>
        <div className="identity">
          <span className="user-badge">{auth.user?.globalName ?? auth.user?.username}</span>
          <button type="button" onClick={onLogout} className="btn-signout">
            TERMINATE_SESSION
          </button>
        </div>
      </aside>
      <main className="content">
        <div className="hud-strip">
          <span>AGENCY TERMINAL // OPERATOR CONSOLE</span>
          <span>DISCORD-NATIVE WORKFLOW LEDGER</span>
          <span>CONTROL SURFACE</span>
        </div>
        {children}
      </main>
    </div>
  );
}

export function PageHeader({ title, kicker }: { title: string; kicker?: string }) {
  return (
    <header className="page-header">
      <div className="header-meta">
        {kicker ? <span className="eyebrow">{kicker}</span> : null}
        <span className="security-stamp">SIG//AGENCY</span>
      </div>
      <h1>{title}</h1>
      <div className="header-rule"></div>
    </header>
  );
}

export function DataState({ error, loading }: { error?: string; loading: boolean }) {
  if (loading) return <div className="notice loading-state">[ PROCESSING REQUEST... ]</div>;
  if (error) return <div className="notice danger">[ ERROR // {error} ]</div>;
  return null;
}
