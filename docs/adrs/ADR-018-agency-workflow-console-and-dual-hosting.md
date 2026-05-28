# ADR-018 — Agency Workflow Console (TicketTool Replacement) and Dual-Hosting

## Status

Proposed. Drafted on `design/agency-workflow-console-pivot`. Companion design: [`docs/18_AGENCY_WORKFLOW_CONSOLE_PIVOT.md`](../18_AGENCY_WORKFLOW_CONSOLE_PIVOT.md).

## Context

External validation by a real Agency leader showed the install path works but there is no configuration/activation surface, slash commands do not activate in a newly-joined guild (registration is bound to a single `DISCORD_GUILD_ID`), and the install permission posture is operations-oriented and broad. The customer's actual first need is a **recruitment intake / ticket workflow** that replaces the paid TicketTool subset they currently use (panels, pre-ticket forms, private tickets, logging). The leader explicitly does not want a slash-command recruitment UX.

The platform already has the reusable pieces: a button→modal→action interaction pipeline (`apps/bot/src/handlers.ts`), private-channel provisioning with permission overwrites (`outbox-processor.ts`), the outbox worker, the ticket lifecycle engine (ADR-017 / `docs/17`), per-guild config + role→capability mapping, idempotency, audit, and the ATCC controls platform with an install-URL + per-guild command-registration deployment surface.

## Decision

1. **The first customer-facing product is the Agency Workflow Console — a tribe-owned TicketTool replacement**, delivered as an **Agency Intake** surface (recruitment: panels → forms → private tickets, Application first, Diplomacy/Contracts later) sharing a foundation with a later/private **Agency Terminal Operations** surface (the existing evidence/intel/clearance/governance work).
2. **Reuse the existing `enlistment` workflow; re-front the UX.** The Application pilot maps onto the **already-implemented `enlistment` workflow type** (ADR-017 / `docs/17` §6) — **no new `recruitment`/`application` workflow type is created.** State mapping: Application received → `submitted`; staff review → `screening`; interview → `interview`; accepted → `authorized`; declined → `denied`; archived → `archived`. Whether `trial_agent` is a required stage between Interview and Accept is an **open Agency question**; the pilot does not invent a workflow type to avoid it and does not implement the final acceptance transition (`→ authorized`) until it is answered. The slash-command transition UX is **paused as the recruitment interface** (not deleted; may serve operator/operations use). ADR-017 §15's "transitions arrive only via slash command" assumption is overtaken for the recruitment surface.
3. **Support two hosting models, single-guild-first.** **Model A:** Kodaxa-hosted *managed single-tenant* pilot on **one Agency-targeted active deployment profile** (single guild) — Kodaxa owns the Discord app + infra; ATCC is the config/activation surface. Concurrent Kodaxa-dev + Agency operation under one bot application, and any multi-guild managed iteration, are **later decisions, not pilot prerequisites.** **Model B:** Agency-owned self-host — own Discord app, own runtime, plain **PostgreSQL** (no Railway/Supabase requirement, no SQLite rewrite), likely Docker Compose (bot + controls + postgres). Object/transcript storage goes through an adapter (local for self-host, bucket for managed).
4. **Minimize installation permissions.** Request only what intake needs (read/post, manage channels, channel-scoped overwrites, create instant invite, attach files for transcripts). Drop Administrator/Manage-Server/Kick/Ban and server-wide role management from the recruitment install.
5. **No automatic authority mutation (ADR-011 reaffirmed).** "Accept" issues a *temporary invite*, never a role grant/promotion. No role/ban/kick automation is authorized.

## Consequences

- This is **not** a move to multi-tenant SaaS. ADR-001 (single-guild-first) and ADR-008 (not-SaaS) are reaffirmed: Model A is managed single-tenant, Model B is self-host single-guild.
- New config concepts must be built that do not exist today: panels, forms/questions, published message/button IDs, ticket/overflow/archive categories, per-panel staff routing, ticket limits/duplicate protection, claiming, transcripts, automation, invite-handoff config, and per-guild activation/readiness state.
- Single-guild hard-codes (command registration + outbox loop bound to `DISCORD_GUILD_ID`) are **fine for the pilot** (single active deployment profile) and for Model B; they would only need revisiting if concurrent multi-guild managed operation is later pursued — a separate decision.
- `docs/16` is re-sequenced, not rewritten: its Sprint-2 buttons/modals and Sprint-9 rollout work are prioritized into the recruitment slices; the operations governance sprints continue as the private track.
- The uncommitted `feature/ticket-transition-engine` WIP is preserved; its engine is reused, its slash-command UX is superseded for recruitment.

## Alternatives considered

- **Just activate the existing operations bot in the recruitment guild.** Rejected: wrong UX (slash commands), wrong permission posture, no configuration surface, and not the customer's need.
- **Build a generic multi-tenant TicketTool SaaS.** Rejected: violates ADR-008; far larger scope than the single-customer pilot requires.
- **SQLite / no-database self-host.** Rejected as a requirement: PostgreSQL is acceptable and already targeted; a rewrite is unnecessary.
