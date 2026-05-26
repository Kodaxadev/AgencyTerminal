import { getClearanceTickets, getContractTickets, getIntelEvidence } from "./api";
import type { EvidenceQueueItemDto, TicketQueueItemDto } from "./contracts";
import { useAsyncData } from "./hooks";
import { DataState, PageHeader } from "./layout";

export function IntelEvidencePage() {
  const { data, loading, error } = useAsyncData(getIntelEvidence);
  return (
    <section>
      <PageHeader title="Intel Evidence" kicker="scoped queue" />
      <DataState loading={loading} error={error} />
      <EvidenceTable rows={data ?? []} loading={loading} error={error} emptyLabel="No intel evidence in queue" />
    </section>
  );
}

export function ContractsPage() {
  const { data, loading, error } = useAsyncData(getContractTickets);
  return (
    <section>
      <PageHeader title="Contracts" kicker="scoped queue" />
      <DataState loading={loading} error={error} />
      <TicketTable rows={data ?? []} loading={loading} error={error} emptyLabel="No contract tickets in queue" />
    </section>
  );
}

export function ClearancePage() {
  const { data, loading, error } = useAsyncData(getClearanceTickets);
  return (
    <section>
      <PageHeader title="Clearance" kicker="scoped queue" />
      <DataState loading={loading} error={error} />
      <TicketTable rows={data ?? []} loading={loading} error={error} emptyLabel="No clearance tickets in queue" />
    </section>
  );
}

function EvidenceTable({
  rows,
  loading,
  error,
  emptyLabel,
}: {
  rows: EvidenceQueueItemDto[];
  loading: boolean;
  error?: string;
  emptyLabel: string;
}) {
  return (
    <table>
      <thead><tr><th>ID</th><th>Title</th><th>Status</th><th>Sensitivity</th><th>Created</th></tr></thead>
      <tbody>
        {rows.length ? rows.map((row) => (
          <tr key={row.id}>
            <td>{row.shortId ?? row.id}</td>
            <td>{row.title}</td>
            <td>{row.status}</td>
            <td>{row.sensitivity}</td>
            <td>{new Date(row.createdAt).toLocaleDateString()}</td>
          </tr>
        )) : !loading && !error ? (
          <tr><td className="empty-cell" colSpan={5}>{emptyLabel}</td></tr>
        ) : null}
      </tbody>
    </table>
  );
}

function TicketTable({
  rows,
  loading,
  error,
  emptyLabel,
}: {
  rows: TicketQueueItemDto[];
  loading: boolean;
  error?: string;
  emptyLabel: string;
}) {
  return (
    <table>
      <thead><tr><th>ID</th><th>Status</th><th>Priority</th><th>Sensitivity</th><th>Title</th></tr></thead>
      <tbody>
        {rows.length ? rows.map((row) => (
          <tr key={row.id}>
            <td>{row.shortId ?? row.id}</td>
            <td>{row.lifecycleStatus}</td>
            <td>{row.priority}</td>
            <td>{row.sensitivity}</td>
            <td>{row.title}</td>
          </tr>
        )) : !loading && !error ? (
          <tr><td className="empty-cell" colSpan={5}>{emptyLabel}</td></tr>
        ) : null}
      </tbody>
    </table>
  );
}
