# 24 — Identity and Subject Semantics

## Purpose

The schema includes both `submitted_by_discord_id` and `subject_discord_id`. The semantics must be explicit.

## Definitions

```text
submitted_by_discord_id
  The Discord user who created the evidence submission.

subject_discord_id
  The Discord user who should receive contribution credit if the evidence is validated.
```

## Default Rule

If `subject_discord_id` is null at submission time:

```text
subject_discord_id = submitted_by_discord_id
```

Application code should normalize this before insert where possible.

## Allowed Submission Modes

### Self-submission

```text
submitted_by_discord_id = subject_discord_id
```

Used when an agent submits their own contribution.

### Peer submission

```text
submitted_by_discord_id != subject_discord_id
```

Used when an officer, FC, Handler, or another agent submits evidence on behalf of someone else.

### System/import submission

```text
submitted_by_discord_id = system actor
subject_discord_id = credited agent
```

Reserved for future integrations.

## Validation Behavior

Score credit always goes to:

```text
subject_discord_id
```

not necessarily the submitter.

## UX Language

Evidence modal should ask:

```text
Who should receive credit?
[default: yourself]
```

Reviewer embed should show:

```text
SUBMITTED BY: @submitter
CREDIT SUBJECT: @agent
```

## Acceptance Criteria

- Self-submission is the default.
- Peer-submission is allowed and visible.
- Score events use `subject_discord_id`.
- Reviewer UI shows both submitter and credit subject.
