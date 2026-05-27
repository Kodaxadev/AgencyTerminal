-- Authorization matrix fixture for live role-based acceptance testing.
--
-- Seeds deterministic evidence and ticket rows covering each (domain, sensitivity)
-- combination needed by the matrix in docs/AUTHORIZATION_MATRIX.md. Every row is
-- tagged with the MATRIX_TEST prefix in its title and a synthetic discord id
-- (matrix-test-actor / matrix-test-channel-*) so it can be filtered and cleaned
-- up after the run.
--
-- Idempotent: re-running deletes the previous fixture rows by their MATRIX_TEST
-- title prefix and reinserts the canonical set.
--
-- Safe to run on the dev guild (1417305427766546567) only. Adjust the
-- :guild_id literal if running elsewhere.

\set guild_id '1417305427766546567'

BEGIN;

-- Clean up previous fixture state, leaving non-fixture data untouched.
DELETE FROM tickets   WHERE guild_id = :'guild_id' AND title LIKE 'MATRIX_TEST_%';
DELETE FROM evidence  WHERE guild_id = :'guild_id' AND title LIKE 'MATRIX_TEST_%';

-- Evidence rows. Three domains × two sensitivities each. The non-empty
-- description ensures the export redactor has something to redact (it skips
-- null/empty values), making redaction observable in live export tests.
INSERT INTO evidence (guild_id, submitted_by_discord_id, metric_category, sensitivity, title, description) VALUES
  (:'guild_id', 'matrix-test-actor', 'intelligence_acquisitions', 'officer_only',  'MATRIX_TEST_evidence_intel_officer',   'MATRIX_TEST_redactable_description_intel_officer'),
  (:'guild_id', 'matrix-test-actor', 'intelligence_acquisitions', 'director_only', 'MATRIX_TEST_evidence_intel_director',  'MATRIX_TEST_redactable_description_intel_director'),
  (:'guild_id', 'matrix-test-actor', 'contracts_completed',       'officer_only',  'MATRIX_TEST_evidence_contract_officer', 'MATRIX_TEST_redactable_description_contract_officer'),
  (:'guild_id', 'matrix-test-actor', 'contracts_completed',       'director_only', 'MATRIX_TEST_evidence_contract_director','MATRIX_TEST_redactable_description_contract_director'),
  (:'guild_id', 'matrix-test-actor', 'pvp_kill_value',            'officer_only',  'MATRIX_TEST_evidence_pvp_officer',     'MATRIX_TEST_redactable_description_pvp_officer'),
  (:'guild_id', 'matrix-test-actor', 'pvp_kill_value',            'director_only', 'MATRIX_TEST_evidence_pvp_director',    'MATRIX_TEST_redactable_description_pvp_director');

-- Ticket rows. One per ticket type, with director-only variants for the three
-- domains that have explicit per-domain sensitive-view capabilities. The
-- non-empty summary makes redaction observable in the tickets export.
INSERT INTO tickets (guild_id, channel_id, creator_discord_id, type, sensitivity, title, summary) VALUES
  (:'guild_id', 'matrix-test-channel-enlistment',        'matrix-test-actor', 'enlistment',          'officer_only',  'MATRIX_TEST_ticket_enlistment_officer',   'MATRIX_TEST_redactable_summary_enlistment'),
  (:'guild_id', 'matrix-test-channel-contract-officer',  'matrix-test-actor', 'contract',            'officer_only',  'MATRIX_TEST_ticket_contract_officer',     'MATRIX_TEST_redactable_summary_contract_officer'),
  (:'guild_id', 'matrix-test-channel-contract-director', 'matrix-test-actor', 'contract',            'director_only', 'MATRIX_TEST_ticket_contract_director',    'MATRIX_TEST_redactable_summary_contract_director'),
  (:'guild_id', 'matrix-test-channel-intel-officer',     'matrix-test-actor', 'intel',               'officer_only',  'MATRIX_TEST_ticket_intel_officer',        'MATRIX_TEST_redactable_summary_intel_officer'),
  (:'guild_id', 'matrix-test-channel-intel-director',    'matrix-test-actor', 'intel',               'director_only', 'MATRIX_TEST_ticket_intel_director',       'MATRIX_TEST_redactable_summary_intel_director'),
  (:'guild_id', 'matrix-test-channel-clearance-officer', 'matrix-test-actor', 'clearance',           'officer_only',  'MATRIX_TEST_ticket_clearance_officer',    'MATRIX_TEST_redactable_summary_clearance_officer'),
  (:'guild_id', 'matrix-test-channel-clearance-director','matrix-test-actor', 'clearance',           'director_only', 'MATRIX_TEST_ticket_clearance_director',   'MATRIX_TEST_redactable_summary_clearance_director'),
  (:'guild_id', 'matrix-test-channel-performance',       'matrix-test-actor', 'performance_evidence','member',        'MATRIX_TEST_ticket_performance_member',   'MATRIX_TEST_redactable_summary_performance'),
  (:'guild_id', 'matrix-test-channel-doctrine',          'matrix-test-actor', 'doctrine_challenge',  'member',        'MATRIX_TEST_ticket_doctrine_member',      'MATRIX_TEST_redactable_summary_doctrine'),
  (:'guild_id', 'matrix-test-channel-general',           'matrix-test-actor', 'general',             'officer_only',  'MATRIX_TEST_ticket_general_officer',      'MATRIX_TEST_redactable_summary_general');

COMMIT;

-- Verification: row counts the seeded fixture should land in the database.
-- evidence: 6 rows; tickets: 10 rows.
SELECT 'evidence' AS table_name, COUNT(*) AS rows
FROM evidence WHERE guild_id = :'guild_id' AND title LIKE 'MATRIX_TEST_%'
UNION ALL
SELECT 'tickets', COUNT(*)
FROM tickets  WHERE guild_id = :'guild_id' AND title LIKE 'MATRIX_TEST_%';
