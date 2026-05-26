import { useState } from "react";
import { CAPABILITIES } from "./contracts";
import { createMetricVersion, createRoleMapping, deleteRoleMapping, getConfig, getMetrics, getRoles, saveConfig } from "./api";
import { DataState, PageHeader } from "./layout";
import { useAsyncData } from "./hooks";

export function ConfigPage() {
  const { data, loading, error, reload } = useAsyncData(getConfig);
  const [message, setMessage] = useState<string>();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data) return;
    const form = new FormData(event.currentTarget);
    const staleReviewHours = Number(form.get("staleReviewHours"));
    const saved = await saveConfig({
      guildId: data.guildId,
      name: String(form.get("name") ?? data.name),
      adminChannelId: field(form, "adminChannelId"),
      auditChannelId: field(form, "auditChannelId"),
      opsQueueChannelId: field(form, "opsQueueChannelId"),
      archiveChannelId: field(form, "archiveChannelId"),
      doctrineChangesChannelId: field(form, "doctrineChangesChannelId"),
      staleReviewHours,
    });
    setMessage(`Saved ${saved.name}`);
    reload();
  }

  return (
    <section>
      <PageHeader title="Guild Config" kicker="single guild" />
      <DataState loading={loading} error={error} />
      {data ? (
        <form className="panel form-grid" onSubmit={(event) => { void submit(event); }}>
          <label>Guild ID<input name="guildId" value={data.guildId} readOnly /></label>
          <label>Name<input name="name" defaultValue={data.name} /></label>
          <label>Admin channel ID<input name="adminChannelId" defaultValue={data.adminChannelId} /></label>
          <label>Audit channel ID<input name="auditChannelId" defaultValue={data.auditChannelId} /></label>
          <label>Ops queue channel ID<input name="opsQueueChannelId" defaultValue={data.opsQueueChannelId} /></label>
          <label>Archive channel ID<input name="archiveChannelId" defaultValue={data.archiveChannelId} /></label>
          <label>Doctrine channel ID<input name="doctrineChangesChannelId" defaultValue={data.doctrineChangesChannelId} /></label>
          <label>Stale review hours<input name="staleReviewHours" type="number" min="1" defaultValue={data.staleReviewHours} /></label>
          <button type="submit">Save config</button>
          {message ? <span className="form-message">{message}</span> : null}
        </form>
      ) : null}
    </section>
  );
}

export function RolesPage() {
  const { data, loading, error, reload } = useAsyncData(getRoles);
  const [message, setMessage] = useState<string>();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await createRoleMapping({
      discordRoleId: String(form.get("discordRoleId") ?? ""),
      capability: String(form.get("capability") ?? ""),
      confirmation: String(form.get("confirmation") ?? ""),
    });
    setMessage("Role mapping saved");
    event.currentTarget.reset();
    reload();
  }

  return (
    <section>
      <PageHeader title="Role Capabilities" kicker="authority mapping" />
      <DataState loading={loading} error={error} />
      <form className="panel inline-form" onSubmit={(event) => { void submit(event); }}>
        <input name="discordRoleId" placeholder="Discord role ID" />
        <select name="capability" defaultValue="can_manage_config">
          {CAPABILITIES.map((capability) => <option key={capability} value={capability}>{capability}</option>)}
        </select>
        <input name="confirmation" placeholder="Type SAVE to confirm" />
        <button type="submit">Save</button>
      </form>
      {message ? <p className="form-message">{message}</p> : null}
      <table>
        <thead><tr><th>Role</th><th>Capability</th><th>Created</th><th></th></tr></thead>
        <tbody>
          {(data ?? []).map((row) => (
            <tr key={row.id}>
              <td>{row.discordRoleId}</td>
              <td>{row.capability}</td>
              <td>{new Date(row.createdAt).toLocaleString()}</td>
              <td><button type="button" onClick={() => void deleteRoleMapping(row.id).then(reload)}>Remove</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function MetricsPage() {
  const { data, loading, error, reload } = useAsyncData(getMetrics);
  const [message, setMessage] = useState<string>();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await createMetricVersion({
      category: String(form.get("category") ?? ""),
      basePoints: Number(form.get("basePoints")),
      visibility: String(form.get("visibility") ?? "public"),
      enabled: form.get("enabled") === "on",
      confirmation: String(form.get("confirmation") ?? ""),
    });
    setMessage("Metric version created");
    event.currentTarget.reset();
    reload();
  }

  return (
    <section>
      <PageHeader title="Metric Table" kicker="versioned points" />
      <DataState loading={loading} error={error} />
      <form className="panel inline-form" onSubmit={(event) => { void submit(event); }}>
        <input name="category" placeholder="metric category" />
        <input name="basePoints" type="number" min="0" placeholder="points" />
        <select name="visibility" defaultValue="public">
          <option value="public">public</option>
          <option value="officer_only">officer_only</option>
        </select>
        <label className="check"><input name="enabled" type="checkbox" defaultChecked /> enabled</label>
        <input name="confirmation" placeholder="VERSION" />
        <button type="submit">Create version</button>
      </form>
      {message ? <p className="form-message">{message}</p> : null}
      <table>
        <thead><tr><th>Category</th><th>Points</th><th>Visibility</th><th>Enabled</th><th>Version</th></tr></thead>
        <tbody>
          {data?.length ? data.map((row) => (
            <tr key={row.id}>
              <td>{row.category}</td>
              <td>{row.basePoints}</td>
              <td>{row.visibility}</td>
              <td>{row.enabled ? "yes" : "no"}</td>
              <td>{row.version}</td>
            </tr>
          )) : !loading && !error ? (
            <tr><td className="empty-cell" colSpan={5}>No metrics defined</td></tr>
          ) : null}
        </tbody>
      </table>
    </section>
  );
}

function field(form: FormData, name: string): string | undefined {
  const value = form.get(name);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
