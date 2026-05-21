# Controls Page Wireframe

## /controls

```text
┌──────────────────────────────────────────────────────────────┐
│ SIG//AGENCY TERMINAL                                        │
│ STATUS // CODE 200 // OPERATIONAL                           │
├──────────────────────────────────────────────────────────────┤
│ Bot        OK     Discord Gateway connected                  │
│ Database   OK     Migrations current                         │
│ Worker     WARN   Last stale-review scan: 21m ago            │
│ Outbox     OK     0 pending / 0 dead                          │
├──────────────────────────────────────────────────────────────┤
│ Open tickets        12                                       │
│ Under review         6                                       │
│ Stale evidence       1      [Review]                         │
│ Failed projections   0                                       │
└──────────────────────────────────────────────────────────────┘
```

## /controls/evidence

```text
Tabs: Submitted | Under Review | Stale Review | Needs Evidence | Validated | Reversed

[STALE] EVD-0042  Intelligence Acquisition  @agent
Submitted: 52h ago
Approvals: 1/2
Actions: View | Request Evidence | Escalate | Director Override
```

## /controls/roles

```text
Capability                  Discord Role
can_validate_evidence        @Handlers
can_override_quorum          @Directors
can_reverse_score            @Directors
can_manage_intel             @Intel
can_manage_config            @Operators
```

## /controls/metrics

```text
Metric                       Points   Visibility
PvP Kill Value               5        Public
Fleet Participation          2        Public
Contracts Completed          8        Public
Intelligence Acquisitions    6        Officer Only
Technical / Dev Output       10       Officer Only
Asset Contributions          4        Officer Only
Exploration                  3        Public
Lore Discovery               3        Public
```

## /controls/retention

```text
Policy                       Retain        Action
Ticket Transcript            365 days      Archive
Evidence Record              Indefinite    Retain
Sensitive Intel              180 days      Redact
Contract Terms               365 days      Archive
Score Events                 Indefinite    Retain

[Run Dry-Run] [Export Report]
```
