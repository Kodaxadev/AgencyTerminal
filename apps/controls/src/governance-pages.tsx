import { useState } from "react";
import {
  createExport,
  dryRunRetention,
  getExportDescriptors,
  getRetentionPolicies,
  runRetention,
  saveRetentionPolicy,
} from "./api";
import type { ExportPayloadDto, ExportType, RetentionDryRunDto } from "./contracts";
import { useAsyncData } from "./hooks";
import { DataState, PageHeader } from "./layout";

export function RetentionPage() {
  const { data, loading, error, reload } = useAsyncData(getRetentionPolicies);
  const [dryRun, setDryRun] = useState<RetentionDryRunDto>();
  const [message, setMessage] = useState<string>();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await saveRetentionPolicy({
      class: String(form.get("class") ?? ""),
      retainDays: optionalNumber(form.get("retainDays")),
      action: String(form.get("action") ?? "retain"),
      sensitivity: String(form.get("sensitivity") ?? "officer_only"),
      enabled: form.get("enabled") === "on",
      confirmation: String(form.get("confirmation") ?? ""),
    });
    setMessage("Retention policy saved");
    event.currentTarget.reset();
    reload();
  }

  async function dryRunNow() {
    setDryRun(await dryRunRetention());
    setMessage("Dry run complete");
  }

  async function runNow() {
    if (!dryRun) return;
    const result = await runRetention(dryRun.token, "RETENTION");
    setMessage(result.message);
  }

  return (
    <section>
      <PageHeader title="Retention" kicker="policy and dry run" />
      <DataState loading={loading} error={error} />
      <form className="panel inline-form" onSubmit={(event) => { void submit(event); }}>
        <select name="class" defaultValue="ticket_transcript">
          {(data ?? []).map((policy) => <option key={policy.class} value={policy.class}>{policy.class}</option>)}
        </select>
        <input name="retainDays" type="number" min="0" placeholder="retain days" />
        <select name="action" defaultValue="archive">
          <option value="retain">retain</option>
          <option value="archive">archive</option>
          <option value="delete">delete</option>
          <option value="redact">redact</option>
        </select>
        <select name="sensitivity" defaultValue="officer_only">
          <option value="public">public</option>
          <option value="member">member</option>
          <option value="officer_only">officer_only</option>
          <option value="director_only">director_only</option>
        </select>
        <label className="check"><input name="enabled" type="checkbox" defaultChecked /> enabled</label>
        <input name="confirmation" placeholder="RETENTION" />
        <button type="submit">Save policy</button>
      </form>
      <div className="panel inline-form">
        <button type="button" onClick={() => void dryRunNow()}>Dry run</button>
        <button type="button" onClick={() => void runNow()} disabled={!dryRun}>Run report</button>
      </div>
      {message ? <p className="form-message">{message}</p> : null}
      {dryRun ? <p className="notice">Eligible {dryRun.totalEligible} / destructive {dryRun.destructiveCount}</p> : null}
      <table>
        <thead><tr><th>Class</th><th>Days</th><th>Action</th><th>Sensitivity</th><th>Enabled</th><th>Protected</th></tr></thead>
        <tbody>
          {data?.length ? data.map((policy) => (
            <tr key={policy.class}>
              <td>{policy.class}</td>
              <td>{policy.retainDays ?? "indefinite"}</td>
              <td>{policy.action}</td>
              <td>{policy.sensitivity}</td>
              <td>{policy.enabled ? "yes" : "no"}</td>
              <td>{policy.protected ? "yes" : "no"}</td>
            </tr>
          )) : !loading && !error ? (
            <tr><td className="empty-cell" colSpan={6}>No retention policies available</td></tr>
          ) : null}
        </tbody>
      </table>
    </section>
  );
}

export function ExportsPage() {
  const { data, loading, error } = useAsyncData(getExportDescriptors);
  const [confirmation, setConfirmation] = useState("");
  const [lastExport, setLastExport] = useState<ExportPayloadDto>();

  async function submit(type: ExportType) {
    setLastExport(await createExport(type, confirmation));
    setConfirmation("");
  }

  return (
    <section>
      <PageHeader title="Exports" kicker="json reports" />
      <DataState loading={loading} error={error} />
      <div className="panel inline-form">
        <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="EXPORT" />
      </div>
      {lastExport ? (
        <p className="notice">{lastExport.type} export: {lastExport.recordCount} records at {new Date(lastExport.generatedAt).toLocaleString()}</p>
      ) : null}
      <table>
        <thead><tr><th>Export</th><th>Sensitivity</th><th>Confirmation</th><th></th></tr></thead>
        <tbody>
          {data?.length ? data.map((item) => (
            <tr key={item.type}>
              <td>{item.label}</td>
              <td>{item.sensitivity}</td>
              <td>{item.requiresConfirmation ? "EXPORT" : "none"}</td>
              <td><button type="button" onClick={() => void submit(item.type)}>Generate</button></td>
            </tr>
          )) : !loading && !error ? (
            <tr><td className="empty-cell" colSpan={4}>No exports available</td></tr>
          ) : null}
        </tbody>
      </table>
    </section>
  );
}

function optionalNumber(value: FormDataEntryValue | null): number | null | undefined {
  if (value === null || value === "") return undefined;
  return Number(value);
}
