export interface Check {
  seat: string;
  path: string;
  method?: "GET" | "POST";
  body?: unknown;
  expectStatus: number;
  mustInclude?: string[];
  mustExclude?: string[];
  /** When set, after the request runs we query audit_log for a controls_export_created row attributed to this seat. */
  audit?: "expect-row" | "expect-no-row";
}

export const CHECKS: Check[] = [
  // -----------------------------------------------------------------------
  // GET checks: page-level access + row-level visibility
  // -----------------------------------------------------------------------

  // recruiter (can_manage_enlistment only)
  { seat: "recruiter", path: "/api/tickets",  expectStatus: 200,
    mustInclude: ["MATRIX_TEST_ticket_enlistment_officer"],
    mustExclude: [
      "MATRIX_TEST_ticket_contract_officer", "MATRIX_TEST_ticket_contract_director",
      "MATRIX_TEST_ticket_intel_officer",    "MATRIX_TEST_ticket_intel_director",
      "MATRIX_TEST_ticket_clearance_officer","MATRIX_TEST_ticket_clearance_director",
      "MATRIX_TEST_ticket_general_officer",
    ] },
  { seat: "recruiter", path: "/api/evidence",  expectStatus: 403 },
  { seat: "recruiter", path: "/api/contracts", expectStatus: 403 },
  { seat: "recruiter", path: "/api/clearance", expectStatus: 403 },

  // contracts handler (can_manage_contracts only — no sensitive cap)
  { seat: "contracts", path: "/api/contracts", expectStatus: 200,
    mustInclude: ["MATRIX_TEST_ticket_contract_officer"],
    mustExclude: ["MATRIX_TEST_ticket_contract_director"] },
  { seat: "contracts", path: "/api/tickets",  expectStatus: 403 },
  { seat: "contracts", path: "/api/evidence", expectStatus: 403 },

  // intel handler (can_manage_intel only — no sensitive cap)
  { seat: "intel", path: "/api/evidence/intel", expectStatus: 200,
    mustInclude: ["MATRIX_TEST_evidence_intel_officer"],
    mustExclude: [
      "MATRIX_TEST_evidence_intel_director",
      "MATRIX_TEST_evidence_contract_officer", "MATRIX_TEST_evidence_contract_director",
      "MATRIX_TEST_evidence_pvp_officer",      "MATRIX_TEST_evidence_pvp_director",
    ] },
  { seat: "intel", path: "/api/evidence",  expectStatus: 403 },
  { seat: "intel", path: "/api/contracts", expectStatus: 403 },

  // clearance handler
  { seat: "clearance", path: "/api/clearance", expectStatus: 200,
    mustInclude: ["MATRIX_TEST_ticket_clearance_officer"],
    mustExclude: ["MATRIX_TEST_ticket_clearance_director"] },
  { seat: "clearance", path: "/api/tickets",  expectStatus: 403 },
  { seat: "clearance", path: "/api/evidence", expectStatus: 403 },

  // intel-director (can_manage_intel + can_view_sensitive_intel) — sees both officer and director intel
  { seat: "intel-director", path: "/api/evidence/intel", expectStatus: 200,
    mustInclude: [
      "MATRIX_TEST_evidence_intel_officer",
      "MATRIX_TEST_evidence_intel_director",
    ],
    mustExclude: [
      "MATRIX_TEST_evidence_contract_director", "MATRIX_TEST_evidence_contract_officer",
      "MATRIX_TEST_evidence_pvp_director",      "MATRIX_TEST_evidence_pvp_officer",
    ] },
  { seat: "intel-director", path: "/api/evidence",  expectStatus: 403 },
  { seat: "intel-director", path: "/api/tickets",   expectStatus: 403 },
  { seat: "intel-director", path: "/api/contracts", expectStatus: 403 },
  { seat: "intel-director", path: "/api/clearance", expectStatus: 403 },

  // contract-director (can_manage_contracts + can_view_sensitive_contracts) — sees both officer and director contract
  { seat: "contract-director", path: "/api/contracts", expectStatus: 200,
    mustInclude: [
      "MATRIX_TEST_ticket_contract_officer",
      "MATRIX_TEST_ticket_contract_director",
    ],
    mustExclude: [
      "MATRIX_TEST_ticket_intel_director",     "MATRIX_TEST_ticket_intel_officer",
      "MATRIX_TEST_ticket_clearance_director", "MATRIX_TEST_ticket_clearance_officer",
    ] },
  { seat: "contract-director", path: "/api/evidence", expectStatus: 403 },
  { seat: "contract-director", path: "/api/tickets",  expectStatus: 403 },

  // validator (can_validate_evidence only) — broad evidence: all non-director, no director
  { seat: "validator", path: "/api/evidence", expectStatus: 200,
    mustInclude: [
      "MATRIX_TEST_evidence_intel_officer",
      "MATRIX_TEST_evidence_contract_officer",
      "MATRIX_TEST_evidence_pvp_officer",
    ],
    mustExclude: [
      "MATRIX_TEST_evidence_intel_director",
      "MATRIX_TEST_evidence_contract_director",
      "MATRIX_TEST_evidence_pvp_director",
    ] },
  { seat: "validator", path: "/api/exports", expectStatus: 200,
    mustInclude: ['"type":"ledger"'],
    mustExclude: ['"type":"audit"', '"type":"tickets"', '"type":"retention"'] },
  { seat: "validator", path: "/api/tickets", expectStatus: 403 },

  // auditor (can_view_audit) — cross-domain super-cap; sees all non-director, no director
  { seat: "auditor", path: "/api/evidence", expectStatus: 200,
    mustInclude: [
      "MATRIX_TEST_evidence_intel_officer",
      "MATRIX_TEST_evidence_contract_officer",
      "MATRIX_TEST_evidence_pvp_officer",
    ],
    mustExclude: [
      "MATRIX_TEST_evidence_intel_director",
      "MATRIX_TEST_evidence_contract_director",
      "MATRIX_TEST_evidence_pvp_director",
    ] },
  { seat: "auditor", path: "/api/tickets", expectStatus: 200,
    mustInclude: [
      "MATRIX_TEST_ticket_enlistment_officer",
      "MATRIX_TEST_ticket_contract_officer",
      "MATRIX_TEST_ticket_intel_officer",
      "MATRIX_TEST_ticket_clearance_officer",
      "MATRIX_TEST_ticket_general_officer",
    ],
    mustExclude: [
      "MATRIX_TEST_ticket_contract_director",
      "MATRIX_TEST_ticket_intel_director",
      "MATRIX_TEST_ticket_clearance_director",
    ] },
  { seat: "auditor", path: "/api/audit",   expectStatus: 200 },
  { seat: "auditor", path: "/api/exports", expectStatus: 200,
    mustInclude: ['"type":"ledger"', '"type":"agents"', '"type":"audit"'],
    mustExclude: ['"type":"tickets"', '"type":"retention"'] },

  // viewer-all-tickets — cross-domain ticket super-cap; sees all non-director ticket rows
  { seat: "viewer-all-tickets", path: "/api/tickets", expectStatus: 200,
    mustInclude: [
      "MATRIX_TEST_ticket_enlistment_officer",
      "MATRIX_TEST_ticket_contract_officer",
      "MATRIX_TEST_ticket_intel_officer",
      "MATRIX_TEST_ticket_clearance_officer",
      "MATRIX_TEST_ticket_general_officer",
    ],
    mustExclude: [
      "MATRIX_TEST_ticket_contract_director",
      "MATRIX_TEST_ticket_intel_director",
      "MATRIX_TEST_ticket_clearance_director",
    ] },
  { seat: "viewer-all-tickets", path: "/api/exports", expectStatus: 200,
    mustInclude: ['"type":"tickets"'],
    mustExclude: ['"type":"ledger"', '"type":"audit"', '"type":"agents"', '"type":"retention"'] },
  { seat: "viewer-all-tickets", path: "/api/evidence", expectStatus: 403 },

  // config-admin (control case) — sees every fixture row across every endpoint
  { seat: "config-admin", path: "/api/evidence", expectStatus: 200,
    mustInclude: [
      "MATRIX_TEST_evidence_intel_officer",   "MATRIX_TEST_evidence_intel_director",
      "MATRIX_TEST_evidence_contract_officer","MATRIX_TEST_evidence_contract_director",
      "MATRIX_TEST_evidence_pvp_officer",     "MATRIX_TEST_evidence_pvp_director",
    ] },
  { seat: "config-admin", path: "/api/tickets", expectStatus: 200,
    mustInclude: [
      "MATRIX_TEST_ticket_enlistment_officer",
      "MATRIX_TEST_ticket_contract_officer",   "MATRIX_TEST_ticket_contract_director",
      "MATRIX_TEST_ticket_intel_officer",      "MATRIX_TEST_ticket_intel_director",
      "MATRIX_TEST_ticket_clearance_officer",  "MATRIX_TEST_ticket_clearance_director",
      "MATRIX_TEST_ticket_general_officer",
    ] },
  { seat: "config-admin", path: "/api/exports", expectStatus: 200,
    mustInclude: ['"type":"ledger"', '"type":"agents"', '"type":"audit"', '"type":"tickets"', '"type":"retention"'] },

  // -----------------------------------------------------------------------
  // POST export checks: body filtering, redaction, audit-row mutation
  // -----------------------------------------------------------------------

  // validator exports ledger: non-director evidence + redacted description fields
  { seat: "validator", path: "/api/exports/ledger", method: "POST",
    body: { confirmation: "EXPORT" }, expectStatus: 200,
    mustInclude: [
      'MATRIX_TEST_evidence_intel_officer',
      'MATRIX_TEST_evidence_contract_officer',
      'MATRIX_TEST_evidence_pvp_officer',
      '"description":"[REDACTED]"',
    ],
    mustExclude: [
      'MATRIX_TEST_evidence_intel_director',
      'MATRIX_TEST_evidence_contract_director',
      'MATRIX_TEST_evidence_pvp_director',
      'MATRIX_TEST_redactable_description_',
    ],
    audit: "expect-row" },

  // viewer-all-tickets exports tickets: non-director + redacted summary fields
  { seat: "viewer-all-tickets", path: "/api/exports/tickets", method: "POST",
    body: {}, expectStatus: 200,
    mustInclude: [
      'MATRIX_TEST_ticket_enlistment_officer',
      'MATRIX_TEST_ticket_contract_officer',
      'MATRIX_TEST_ticket_intel_officer',
      'MATRIX_TEST_ticket_clearance_officer',
      '"summary":"[REDACTED]"',
    ],
    mustExclude: [
      'MATRIX_TEST_ticket_contract_director',
      'MATRIX_TEST_ticket_intel_director',
      'MATRIX_TEST_ticket_clearance_director',
      'MATRIX_TEST_redactable_summary_',
    ],
    audit: "expect-row" },

  // auditor exports audit: just verify 200 + audit row written
  { seat: "auditor", path: "/api/exports/audit", method: "POST",
    body: { confirmation: "EXPORT" }, expectStatus: 200,
    audit: "expect-row" },

  // unauthorized exports: 403 and NO audit row
  { seat: "recruiter",          path: "/api/exports/tickets", method: "POST", body: {},                       expectStatus: 403, audit: "expect-no-row" },
  { seat: "validator",          path: "/api/exports/audit",   method: "POST", body: { confirmation: "EXPORT" }, expectStatus: 403, audit: "expect-no-row" },
  { seat: "auditor",            path: "/api/exports/tickets", method: "POST", body: {},                       expectStatus: 403, audit: "expect-no-row" },
  { seat: "viewer-all-tickets", path: "/api/exports/audit",   method: "POST", body: { confirmation: "EXPORT" }, expectStatus: 403, audit: "expect-no-row" },
];
