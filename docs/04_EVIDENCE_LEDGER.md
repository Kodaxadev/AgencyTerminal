# Evidence Ledger Design

## Purpose

The Evidence Ledger is the canonical record of measurable contribution. Every validated contribution should produce an immutable score event. Every reversal should produce a reversal event. Scores should be computed from events, never hand-edited.

## Metric categories

- PvP Kill Value
- Fleet Participation
- Contracts Completed
- Intelligence Acquisitions
- Technical / Development Output
- Asset Contributions
- Exploration
- Lore Discovery

## Evidence status

```ts
type EvidenceStatus =
  | "submitted"
  | "under_review"
  | "stale_review"
  | "needs_more_evidence"
  | "validated"
  | "rejected"
  | "duplicate"
  | "credited"
  | "reversed";
```

## Quorum policy

Default validation policy:

| Evidence type | Validation mode |
|---|---|
| PvP Kill Value | two-reviewer quorum |
| Fleet Participation | single FC/officer |
| Contracts Completed | contract officer + witness |
| Intelligence Acquisitions | intel officer quorum |
| Technical / Development Output | technical officer or director |
| Asset Contributions | logistics/finance officer |
| Exploration | one reviewer unless sensitive |
| Lore Discovery | one reviewer or archive officer |

## Timeout escalation

```text
Evidence submitted
-> UNDER_REVIEW
-> 48h without quorum: STALE_REVIEW
-> post to #ops-queue
-> Handler/Director may unblock with director_override
-> audit log required
```

## Points

Use fixed configurable point tables in v1. Agents do not self-propose points.

```ts
type MetricConfig = {
  category: AgencyMetricCategory;
  basePoints: number;
  visibility: "public" | "officer_only";
  enabled: boolean;
  version: number;
};
```

## Score event

```ts
type AgentScoreEvent = {
  id: string;
  guildId: string;
  evidenceId: string;
  agentDiscordId: string;
  metricCategory: AgencyMetricCategory;
  pointSource: "configured_table" | "director_override" | "manual_adjustment";
  pointsApproved: number;
  pointsTableVersion: number;
  creditedBy: string;
  creditedAt: string;
  status: "credited" | "reversed";
};
```

## Score reversal

Score reversal requires:

1. Director-level actor.
2. One corroborating officer.
3. Mandatory reversal reason.
4. Mandatory audit-log post.
5. Optional notification to affected agent.

Reversal is always more protected than validation.
