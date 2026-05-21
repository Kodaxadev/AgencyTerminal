import { Routes, Route, Link, useLocation } from "react-router-dom";

export function ControlsApp() {
  return (
    <div style={{ fontFamily: "ui-monospace, monospace", background: "#050606", color: "#e8fff5", minHeight: "100vh", padding: "48px" }}>
      <nav style={{ marginBottom: "32px", borderBottom: "1px solid rgba(52,211,153,0.3)", paddingBottom: "16px" }}>
        <span style={{ letterSpacing: "0.22em", fontSize: "14px", color: "#a7f3d0" }}>SIG//AGENCY TERMINAL</span>
        <div style={{ marginTop: "12px", display: "flex", gap: "16px" }}>
          <NavLink to="/">Home</NavLink>
          <NavLink to="/health">Health</NavLink>
          <NavLink to="/config">Config</NavLink>
          <NavLink to="/audit">Audit</NavLink>
        </div>
      </nav>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/health" element={<HealthPage />} />
        <Route path="/config" element={<PlaceholderPage title="Config" />} />
        <Route path="/audit" element={<PlaceholderPage title="Audit Log" />} />
        <Route path="*" element={<PlaceholderPage title="Not Found" />} />
      </Routes>
    </div>
  );
}

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  const location = useLocation();
  const active = location.pathname === to;
  return (
    <Link
      to={to}
      style={{
        color: active ? "#86efac" : "#7a827f",
        textDecoration: "none",
        fontSize: "13px",
        letterSpacing: "0.14em",
      }}
    >
      {children}
    </Link>
  );
}

function HomePage() {
  return (
    <div>
      <h2 style={{ fontSize: "18px", fontWeight: "normal", marginBottom: "16px" }}>STATUS // CODE 200 // OPERATIONAL</h2>
      <p style={{ color: "#7a827f", fontSize: "13px" }}>Controls page skeleton — pages are stubs pending implementation.</p>
      <div style={{ marginTop: "24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <StatusCard label="Bot" status="OK" detail="Discord Gateway connected" />
        <StatusCard label="Database" status="OK" detail="Migrations current" />
        <StatusCard label="Worker" status="WARN" detail="Last scan: pending" />
        <StatusCard label="Outbox" status="OK" detail="0 pending / 0 dead" />
      </div>
    </div>
  );
}

function HealthPage() {
  const checks = [
    { id: "DISCORD_TOKEN", label: "Discord Token", status: "ok" },
    { id: "DATABASE_URL", label: "Database URL", status: "ok" },
    { id: "MIGRATIONS", label: "Migrations", status: "ok" },
    { id: "WORKER", label: "Worker Heartbeat", status: "warn" },
  ];
  return (
    <div>
      <h2 style={{ fontSize: "18px", fontWeight: "normal", marginBottom: "16px" }}>HEALTH CHECKS</h2>
      {checks.map((c) => (
        <div key={c.id} style={{ padding: "8px 0", borderBottom: "1px solid #242827", display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: "13px" }}>{c.label}</span>
          <span style={{ color: c.status === "ok" ? "#86efac" : "#fbbf24", fontSize: "13px" }}>{c.status.toUpperCase()}</span>
        </div>
      ))}
    </div>
  );
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div>
      <h2 style={{ fontSize: "18px", fontWeight: "normal" }}>{title}</h2>
      <p style={{ color: "#7a827f", fontSize: "13px" }}>Pending implementation.</p>
    </div>
  );
}

function StatusCard({ label, status, detail }: { label: string; status: string; detail: string }) {
  return (
    <div style={{ border: "1px solid #242827", borderRadius: "8px", padding: "12px", background: "rgba(255,255,255,0.02)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
        <span style={{ fontSize: "12px", color: "#7a827f" }}>{label}</span>
        <span style={{ fontSize: "12px", color: status === "OK" ? "#86efac" : "#fbbf24" }}>{status}</span>
      </div>
      <span style={{ fontSize: "12px", color: "#94a3b8" }}>{detail}</span>
    </div>
  );
}
