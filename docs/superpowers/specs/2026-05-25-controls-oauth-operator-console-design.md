# Controls OAuth Operator Console Design

## Goal

Build the controls site as an internal operator console that The Agency leader can use without relying on the repo owner having Discord authority.

## Confirmed Auth Decision

Use Discord OAuth2 for login. Password-only access is rejected for the finished build because it cannot prove Discord identity, guild membership, or role-backed authority.

## Evidence

- Existing spec requires Discord OAuth2, configured-guild membership, mapped capabilities, and no public account creation: `docs/08_CONTROLS_PAGE.md`.
- Security spec requires HTTP-only sessions, server-side role checks, sensitive action confirmations, and audit logging: `docs/09_SECURITY_PRIVACY_COUNTERINTEL.md`.
- Discord docs identify the needed scopes:
  - `identify` for current user identity.
  - `guilds` for guild membership listing.
  - `guilds.members.read` for current user's member record in a guild.

## Product Shape

This is not a SaaS dashboard. It is a dense operational tool for one Discord guild.

Primary screens:
- Overview
- Health
- Config
- Roles
- Metrics
- Evidence
- Tickets
- Audit
- Retention
- Exports
- Deployment

## Server Boundary

The browser never receives Discord bot token, OAuth client secret, database URL, or raw environment values. The server owns:
- Discord OAuth code exchange.
- HTTP-only session cookies.
- Guild-member role recheck.
- Capability enforcement.
- Database reads and writes.
- Audit log writes.
- Discord command registration actions.

## Bootstrap

Before role mappings exist, `CONTROLS_BOOTSTRAP_DISCORD_IDS` grants initial operator capabilities to explicitly listed Discord user IDs. This is the leader bootstrap path, not a public fallback.

## Capabilities

Page access follows the current controls-page spec. Mutations require specific capabilities:
- Config, roles, metrics, retention, deployment: `can_manage_config`
- Audit: `can_view_audit` or `can_manage_config`
- Evidence queues: `can_validate_evidence`
- Sensitive intel: `can_manage_intel`
- Contracts: `can_manage_contracts`
- Clearance: `can_manage_clearance`

## Dangerous Actions

Actions requiring typed confirmation:
- Role mapping changes: `SAVE`
- Metric version changes: `VERSION`
- Retention run/export: `RETENTION`
- Audit export: `EXPORT`
- Discord command registration: `REGISTER`

Every mutation writes to `audit_log`.

## Tradeoffs

Use a built-in Node HTTP server rather than Express/Hono for this pass. This avoids adding a dependency while the route surface is still small. If routing grows past this module split, Hono is a reasonable later migration.

Use process-local sessions for v1. This fits a single Railway service and keeps OAuth tokens server-side. If controls runs on multiple instances, move sessions to Postgres.
