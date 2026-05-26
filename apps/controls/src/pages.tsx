import { useState } from "react";
import { getAudit, getDeployment, getEvidence, getHealth, getOverview, getTickets, registerCommands } from "./api";
import { DataState, PageHeader } from "./layout";
import { useAsyncData } from "./hooks";
import { getStatusTone } from "./view-model";

export function LoginPage({ controlsEnabled }: { controlsEnabled: boolean }) {
  if (!controlsEnabled) return <DisabledPage />;
  return (
    <main className="login">
      <section>
        <span className="eyebrow">SIG//AGENCY TERMINAL</span>
        <h1>Operator Console</h1>
        <a className="primary-link" href="/api/auth/discord/start">Sign in with Discord</a>
      </section>
    </main>
  );
}

export function DisabledPage() {
  return <main className="login"><section><h1>Controls Disabled</h1></section></main>;
}

export function OverviewPage() {
  const { data, loading, error } = useAsyncData(getOverview);
  const tone = data ? getStatusTone(data.statusCode) : "warn";
  return (
    <section>
      <PageHeader title="Controls Overview" kicker={data ? `CODE ${data.statusCode} // ${data.statusLabel}` : "status"} />
      <DataState loading={loading} error={error} />
      {data ? (
        <>
          <div className="status-strip" data-tone={tone}>
            <strong>{data.guild.name}</strong>
            <span>{data.guild.guildId}</span>
          </div>
          <div className="metric-grid">
            <Metric label="Open tickets" value={data.counts.openTickets} />
            <Metric label="Stale evidence" value={data.counts.staleEvidence} />
            <Metric label="Pending quorum" value={data.counts.pendingQuorum} />
            <Metric label="Outbox pending" value={data.counts.outboxPending} />
            <Metric label="Outbox dead" value={data.counts.outboxDead} />
          </div>
        </>
      ) : null}
    </section>
  );
}

export function HealthPage() {
  const { data, loading, error } = useAsyncData(getHealth);
  return (
    <section>
      <PageHeader title="Health" kicker="runtime checks" />
      <DataState loading={loading} error={error} />
      <table>
        <thead><tr><th>Check</th><th>Status</th><th>Last checked</th><th>Detail</th></tr></thead>
        <tbody>
          {(data ?? []).map((check) => (
            <tr key={check.id}>
              <td>{check.label}</td>
              <td><span className={`pill ${check.status}`}>{check.status}</span></td>
              <td>{new Date(check.lastCheckedAt).toLocaleString()}</td>
              <td>{check.detail ?? check.remediation}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function EvidencePage() {
  const { data, loading, error } = useAsyncData(getEvidence);
  return (
    <section>
      <PageHeader title="Evidence Queue" kicker="review state" />
      <DataState loading={loading} error={error} />
      <table>
        <thead><tr><th>ID</th><th>Title</th><th>Metric</th><th>Status</th><th>Sensitivity</th><th>Created</th></tr></thead>
        <tbody>
          {(data ?? []).map((row) => (
            <tr key={row.id}>
              <td>{row.shortId ?? row.id}</td>
              <td>{row.title}</td>
              <td>{row.metricCategory}</td>
              <td>{row.status}</td>
              <td>{row.sensitivity}</td>
              <td>{new Date(row.createdAt).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function TicketsPage() {
  const { data, loading, error } = useAsyncData(getTickets);
  return (
    <section>
      <PageHeader title="Tickets" kicker="discord channels" />
      <DataState loading={loading} error={error} />
      <table>
        <thead><tr><th>ID</th><th>Type</th><th>Status</th><th>Priority</th><th>Title</th><th>Channel</th></tr></thead>
        <tbody>
          {(data ?? []).map((row) => (
            <tr key={row.id}>
              <td>{row.shortId ?? row.id}</td>
              <td>{row.type}</td>
              <td>{row.lifecycleStatus}</td>
              <td>{row.priority}</td>
              <td>{row.title}</td>
              <td>{row.channelId}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function AuditPage() {
  const { data, loading, error } = useAsyncData(getAudit);
  return (
    <section>
      <PageHeader title="Audit Log" kicker="read only" />
      <DataState loading={loading} error={error} />
      <table>
        <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Subject</th><th>Sensitivity</th></tr></thead>
        <tbody>
          {(data ?? []).map((row) => (
            <tr key={row.id}>
              <td>{new Date(row.createdAt).toLocaleString()}</td>
              <td>{row.actorDiscordId ?? "system"}</td>
              <td>{row.action}</td>
              <td>{row.subjectType}:{row.subjectId}</td>
              <td>{row.sensitivity}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function DeploymentPage() {
  const { data, loading, error, reload } = useAsyncData(getDeployment);
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState<string>();

  async function submit() {
    await registerCommands(confirmation);
    setMessage("Commands registered");
    setConfirmation("");
    reload();
  }

  return (
    <section>
      <PageHeader title="Discord Deployment" kicker="guild actions" />
      <DataState loading={loading} error={error} />
      {data ? (
        <>
          <div className="panel">
            <h2>Required env</h2>
            <div className="env-grid">
              {data.requiredEnv.map((item) => (
                <span key={item.key} className={`pill ${item.present ? "ok" : "fail"}`}>{item.key}</span>
              ))}
            </div>
            {data.inviteUrl ? (
              <a className="primary-link compact" href={data.inviteUrl} target="_blank" rel="noreferrer">
                Bot install link
              </a>
            ) : null}
          </div>
          <div className="panel inline-form">
            <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="REGISTER" />
            <button type="button" onClick={() => void submit()}>Register commands</button>
          </div>
          {message ? <p className="form-message">{message}</p> : null}
        </>
      ) : null}
    </section>
  );
}

export function NotFoundPage() {
  return <section><PageHeader title="Not Found" /></section>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong></div>;
}
