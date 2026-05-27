# Authorization matrix — acceptance run log

Each entry records a live run of the simulator against the deployed Controls
API. The runs are kept here so the evidence persists even after fixture
cleanup. New entries go at the top.

---

## Run 2026-05-27 (#3) — `/evidence status` post-deploy acceptance

Live Discord smoke for the database-backed `/evidence status` slice
(commit `811723350be5b871d69a237619dd9636e7cb7ba2`, PR #9). This is not a
simulator run — it is a real-user Discord interaction acceptance.

| Field | Value |
|---|---|
| Deployed SHA | `811723350be5b871d69a237619dd9636e7cb7ba2` |
| Railway deployment | `324df1ee-648f-425e-a4de-f054a51a4c77` (RUNNING) |
| Target | Agency Terminal dev guild (`1417305427766546567`) |
| Participant | real dev-guild member; submitter and subject of `EVD-0023` |
| Disposition | **DEPLOYED — authorized live path accepted; final real-user negative authorization smoke pending** |

### Accepted live checks

- **Authorized participant lookup by short ID `EVD-0023`**: PASS.
- **Authorized participant lookup by UUID `b41e539b-092a-4cda-b7c3-6b2e3edda60c`**: PASS.
- Both responses returned the expected safe status projection only:
  - visible evidence ID
  - status
  - metric category
  - eligible / required approvals
  - submitted timestamp
  - validated timestamp only when present
- Confirmed absent from the returned content:
  - description
  - evidence links / URLs
  - reviewer identities
  - review rationale
  - conflict details
  - audit payloads
  - submitter / subject Discord identifiers

### Still pending

- Visual confirmation that the successful responses showed Discord's ephemeral "Only you can see this" marker, unless already observed directly during the run.
- Unrelated real dev-guild member negative test: **DEFERRED — pending available unrelated real guild member; do not substitute synthetic-session or bot-token testing.**

### Backlog note (no code change in this turn)

- `/evidence status` short-ID input normalization for lowercase user input such as `evd-0023`. The strict `^[A-Z]{2,6}-[0-9]{1,12}$` pattern caused a false-negative neutral reply on the first attempt during this run; uppercase retry succeeded. Treat as a UX improvement, not a security defect or acceptance blocker.

---

## Run 2026-05-27 (#2) — expanded acceptance

| Field | Value |
|---|---|
| Deployed SHA | `40f0ecabcea67fc4671ca881ffc44da9f6c60440` |
| Harness SHA (pre-commit) | adds try/finally cleanup, sensitive seats, export POST + redaction + audit checks |
| Target | `https://atcc.kodaxa.dev` |
| Fixture namespace | `MATRIX_TEST_*` (with redactable description/summary fields) |
| Seats | 10 (added intel-director, contract-director) |
| Checks | 41 (was 26) |
| Run | 41/41 passed |
| Cleanup | 10 sessions deleted, 3 export audit rows deleted (in finally) |

### Coverage added vs. Run #1

- Sensitive-domain positive access:
  - `intel-director` (`can_manage_intel` + `can_view_sensitive_intel`) sees both officer-only and director-only intel evidence on `/api/evidence/intel`; does not see contract or clearance rows; broad pages 403.
  - `contract-director` (`can_manage_contracts` + `can_view_sensitive_contracts`) sees both officer-only and director-only contract tickets on `/api/contracts`; does not see intel or clearance rows; broad pages 403.
- Export body filtering on `POST /api/exports/<type>`:
  - `validator` ledger export contains all non-director evidence titles, no director, and `"description":"[REDACTED]"` on every row.
  - `viewer-all-tickets` ticket export contains all non-director ticket titles, no director, and `"summary":"[REDACTED]"` on every row.
  - No raw `MATRIX_TEST_redactable_*` content appears in either export body.
- Export audit-row creation:
  - Every successful export produces exactly one `controls_export_created` row attributed to the seat's actor id and subject_id.
  - Every 403 (unauthorized type for the seat) produces zero audit rows.
- Failure-safe cleanup:
  - All planted sessions and the export audit rows produced by the run are deleted in a `finally` block. Interruption mid-run cannot leave synthetic state.

### Disposition

PASS — full deployed authorization matrix at `40f0eca`, covering broad-read
visibility, scoped queue denials, per-domain `director_only` rules, sensitive-
operator positive access, export body filtering, `[REDACTED]` field redaction,
and `controls_export_created` audit-row mutation. This run is the supportable
basis for the statement: "Every authorization rule and export control tested by
the matrix is verified live against the deployed Controls API."

---

## Run 2026-05-26 (#1) — initial deployed acceptance

| Field | Value |
|---|---|
| Deployed SHA | `40f0ecabcea67fc4671ca881ffc44da9f6c60440` |
| Target | `https://atcc.kodaxa.dev` |
| Fixture namespace | `MATRIX_TEST_*` |
| Initial run | 22/26; exposed page-gate defect for `auditor`/`config-admin` broad reads |
| Corrective commit | `40f0ecabcea67fc4671ca881ffc44da9f6c60440` |
| Post-fix run | 26/26 passed |

### Coverage proved live

- Broad evidence and tickets visibility for the eight initially-tested seats
- Scoped queue denials (`/api/evidence/intel`, `/api/contracts`, `/api/clearance`)
- Cross-domain `director_only` denial for every single-domain handler seat
- Page-gate super-cap admission (`can_manage_config`, `can_view_audit` reaching broad endpoints)
- Export descriptor listing capability-gating per seat

### Not yet covered live in this run

- Same-domain `director_only` positive access for sensitive-intel and sensitive-contract operators
- Export body filtering (`POST /api/exports/<type>`) — only descriptor list was tested
- Export body redaction — was not asserted on the response body
- Export audit row creation — not verified after export POSTs

### Outstanding harness defects called out by reviewer

- Session planting/execution not wrapped in `try/finally` — leftover sessions possible on early failure
- Full synthetic session IDs were logged — reduce to seat name and counts only

### Disposition

PASS — deployed broad-read and tested-seat authorization matrix at `40f0eca`, using
synthetic signed sessions and marked fixtures in the existing database.

Not yet supportable: "Every authorization rule and export control is verified live."
That requires a subsequent run with the missing seats and export body/audit checks.
