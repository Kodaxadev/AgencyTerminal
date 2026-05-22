import { Routes, Route, Link, useLocation } from "react-router-dom";
import type { EvidenceRecord, EvidenceStatus } from "@agency-terminal/core";
import type { ScoreEvent } from "@agency-terminal/core";

// --- Mock data for Phase 1 ---

const MOCK_EVIDENCE: EvidenceRecord[] = [
  {
    id: "EVD-0001",
    guildId: "guild-1",
    submittedByDiscordId: "user-1",
    subjectDiscordId: "user-2",
    metricCategory: "pvp_kill_value",
    status: "credited",
    sensitivity: "member",
    title: "Fleet PvP engagement in Jita",
    description: "Participated in fleet action with 40+ pilots.",
    validationRequiredApprovals: 2,
    submittedMode: "live_bot",
    createdAt: new Date("2025-01-15T10:00:00Z"),
    updatedAt: new Date("2025-01-15T12:00:00Z"),
    validatedAt: new Date("2025-01-15T11:30:00Z"),
    creditedAt: new Date("2025-01-15T12:00:00Z"),
  },
  {
    id: "EVD-0002",
    guildId: "guild-1",
    submittedByDiscordId: "user-3",
    subjectDiscordId: "user-3",
    metricCategory: "exploration",
    status: "under_review",
    sensitivity: "member",
    title: "Wormhole exploration site completion",
    description: "Completed 15 sites in C5 wormhole.",
    validationRequiredApprovals: 1,
    submittedMode: "live_bot",
    createdAt: new Date("2025-01-16T08:00:00Z"),
    updatedAt: new Date("2025-01-16T08:00:00Z"),
  },
];

const MOCK_SCORES: ScoreEvent[] = [
  {
    id: "score-001",
    guildId: "guild-1",
    evidenceId: "EVD-0001",
    agentDiscordId: "user-2",
    metricCategory: "pvp_kill_value",
    pointSource: "configured_table",
    pointsApproved: 10,
    pointsTableVersion: 1,
    creditedBy: "system",
    creditedAt: new Date("2025-01-15T12:00:00Z"),
    status: "credited",
  },
];

export function ControlsApp() {
  return (
    <div style={{ fontFamily: "ui-monospace, monospace", background: "#050606", color: "#e8fff5", minHeight: "100vh", padding: "48px" }}>
      <nav style={{ marginBottom: "32px", borderBottom: "1px solid rgba(52,211,153,0.3)", paddingBottom: "16px" }}>
        <span style={{ letterSpacing: "0.22em", fontSize: "14px", color: "#a7f3d0" }}>SIG//AGENCY TERMINAL</span>
        <div style={{ marginTop: "12px", display: "flex", gap: "16px", flexWrap: "wrap" }}>
          <NavLink to="/">Home</NavLink>
          <NavLink to="/health">Health</NavLink>
          <NavLink to="/evidence">Evidence</NavLink>
          <NavLink to="/scores">Scores</NavLink>
          <NavLink to="/config">Config</NavLink>
          <NavLink to="/audit">Audit</NavLink>
        </div>
      </nav>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/health" element={<HealthPage />} />
        <Route path="/evidence" element={<EvidencePage />} />
        <Route path="/scores" element={<ScoresPage />} />
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
      <p style={{ color: "#7a827f", fontSize: "13px" }}>Controls page — Phase 1 scaffold with evidence and score ledger.</p>
      <div style={{ marginTop: "24px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
        <StatusCard label="Bot" status="OK" detail="Discord Gateway connected" />
        <StatusCard label="Database" status="OK" detail="Migrations current" />
        <StatusCard label="Evidence" status="OK" detail={`${MOCK_EVIDENCE.length} records`} />
        <StatusCard label="Scores" status="OK" detail={`${MOCK_SCORES.length} events`} />
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

const STATUS_COLORS: Record<EvidenceStatus, string> = {
  submitted: "#3b82f6",
  under_review: "#fbbf24",
  stale_review: "#f97316",
  needs_more_evidence: "#a78bfa",
  validated: "#34d399",
  rejected: "#f87171",
  duplicate: "#6b7280",
  credited: "#86efac",
  reversed: "#ef4444",
};

function EvidencePage() {
  return (
    <div>
      <h2 style={{ fontSize: "18px", fontWeight: "normal", marginBottom: "16px" }}>EVIDENCE LEDGER</h2>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #242827", textAlign: "left" }}>
            <th style={{ padding: "8px 4px", color: "#7a827f" }}>ID</th>
            <th style={{ padding: "8px 4px", color: "#7a827f" }}>Title</th>
            <th style={{ padding: "8px 4px", color: "#7a827f" }}>Metric</th>
            <th style={{ padding: "8px 4px", color: "#7a827f" }}>Status</th>
            <th style={{ padding: "8px 4px", color: "#7a827f" }}>Submitted</th>
          </tr>
        </thead>
        <tbody>
          {MOCK_EVIDENCE.map((ev) => (
            <tr key={ev.id} style={{ borderBottom: "1px solid #1a1e1d" }}>
              <td style={{ padding: "8px 4px", color: "#a7f3d0" }}>{ev.id}</td>
              <td style={{ padding: "8px 4px" }}>{ev.title}</td>
              <td style={{ padding: "8px 4px", color: "#94a3b8" }}>{ev.metricCategory}</td>
              <td style={{ padding: "8px 4px", color: STATUS_COLORS[ev.status] }}>{ev.status}</td>
              <td style={{ padding: "8px 4px", color: "#7a827f" }}>{ev.createdAt.toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ScoresPage() {
  const totalByAgent = MOCK_SCORES.reduce<Record<string, number>>((acc, s) => {
    acc[s.agentDiscordId] = (acc[s.agentDiscordId] ?? 0) + s.pointsApproved;
    return acc;
  }, {});

  return (
    <div>
      <h2 style={{ fontSize: "18px", fontWeight: "normal", marginBottom: "16px" }}>SCORE LEDGER</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginBottom: "24px" }}>
        {Object.entries(totalByAgent).map(([agent, total]) => (
          <StatusCard key={agent} label={`<@${agent}>`} status="OK" detail={`${total} points`} />
        ))}
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #242827", textAlign: "left" }}>
            <th style={{ padding: "8px 4px", color: "#7a827f" }}>Agent</th>
            <th style={{ padding: "8px 4px", color: "#7a827f" }}>Metric</th>
            <th style={{ padding: "8px 4px", color: "#7a827f" }}>Points</th>
            <th style={{ padding: "8px 4px", color: "#7a827f" }}>Evidence</th>
            <th style={{ padding: "8px 4px", color: "#7a827f" }}>Date</th>
          </tr>
        </thead>
        <tbody>
          {MOCK_SCORES.map((s) => (
            <tr key={s.id} style={{ borderBottom: "1px solid #1a1e1d" }}>
              <td style={{ padding: "8px 4px", color: "#a7f3d0" }}>&lt;@{s.agentDiscordId}&gt;</td>
              <td style={{ padding: "8px 4px", color: "#94a3b8" }}>{s.metricCategory}</td>
              <td style={{ padding: "8px 4px", color: "#86efac" }}>+{s.pointsApproved}</td>
              <td style={{ padding: "8px 4px", color: "#7a827f" }}>{s.evidenceId}</td>
              <td style={{ padding: "8px 4px", color: "#7a827f" }}>{s.creditedAt.toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
