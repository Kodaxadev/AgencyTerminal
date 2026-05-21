# 27 — Repo Hygiene and Changelog Policy

## Purpose

Earlier delivery packs included patch notes files that are useful during handoff but should not live permanently in `/docs` as product documentation.

## Decision

Delivery artifacts should be merged into a changelog or deleted before repo initialization.

## Keep

```text
docs/01_PRD.md
docs/02_ARCHITECTURE.md
docs/...
docs/adrs/*.md
migrations/*.sql
schema/*.ts
web/*.tsx
```

## Remove or Merge

```text
docs/README_PATCH_NOTES.md
docs/README_PATCH_02.md
docs/README_PATCH_03.md
```

## Changelog

Use a single root-level changelog:

```text
CHANGELOG.md
```

Recommended format:

```md
# Changelog

## Unreleased

### Added
- Workflow state machine spec.
- Score correction path.
- Contract details table.

### Changed
- Ticket lifecycle separated from workflow status.

### Removed
- SaaS/platform language.
```

## Acceptance Criteria

- No sandbox/delivery references remain in repo docs.
- Patch notes are merged into CHANGELOG.md or deleted.
- README links only to living docs.
