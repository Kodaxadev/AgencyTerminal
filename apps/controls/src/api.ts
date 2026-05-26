import type {
  AuditLogDto,
  AuthStatus,
  DeploymentStatusDto,
  EvidenceQueueItemDto,
  GuildConfigDto,
  HealthCheckDto,
  MetricConfigDto,
  OverviewDto,
  RoleMappingDto,
  TicketQueueItemDto,
} from "./contracts";

export async function getAuthStatus(): Promise<AuthStatus> {
  return requestJson("/api/auth/status");
}

export async function logout(): Promise<void> {
  await requestJson("/api/auth/logout", { method: "POST" });
}

export async function getOverview(): Promise<OverviewDto> {
  return requestJson("/api/overview");
}

export async function getHealth(): Promise<HealthCheckDto[]> {
  return requestJson("/api/health");
}

export async function getConfig(): Promise<GuildConfigDto> {
  return requestJson("/api/config");
}

export async function saveConfig(config: GuildConfigDto): Promise<GuildConfigDto> {
  return requestJson("/api/config", { method: "PATCH", body: JSON.stringify(config) });
}

export async function getRoles(): Promise<RoleMappingDto[]> {
  return requestJson("/api/roles");
}

export async function createRoleMapping(input: {
  discordRoleId: string;
  capability: string;
  confirmation: string;
}): Promise<RoleMappingDto> {
  return requestJson("/api/roles", { method: "POST", body: JSON.stringify(input) });
}

export async function deleteRoleMapping(id: string): Promise<void> {
  await requestJson(`/api/roles/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function getMetrics(): Promise<MetricConfigDto[]> {
  return requestJson("/api/metrics");
}

export async function createMetricVersion(input: {
  category: string;
  basePoints: number;
  visibility: string;
  enabled: boolean;
  confirmation: string;
}): Promise<MetricConfigDto> {
  return requestJson("/api/metrics", { method: "POST", body: JSON.stringify(input) });
}

export async function getEvidence(): Promise<EvidenceQueueItemDto[]> {
  return requestJson("/api/evidence");
}

export async function getTickets(): Promise<TicketQueueItemDto[]> {
  return requestJson("/api/tickets");
}

export async function getAudit(): Promise<AuditLogDto[]> {
  return requestJson("/api/audit");
}

export async function getDeployment(): Promise<DeploymentStatusDto> {
  return requestJson("/api/deployment");
}

export async function registerCommands(confirmation: string): Promise<void> {
  await requestJson("/api/deployment/register-commands", {
    method: "POST",
    body: JSON.stringify({ confirmation }),
  });
}

async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    headers: { "content-type": "application/json", ...init.headers },
    ...init,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: response.statusText })) as { error?: string };
    throw new Error(payload.error ?? response.statusText);
  }
  if (response.status === 204) return undefined as T;
  return await response.json() as T;
}
