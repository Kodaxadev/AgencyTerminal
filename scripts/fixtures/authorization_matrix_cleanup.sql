-- Removes the authorization matrix fixture rows by their MATRIX_TEST title prefix.
-- Leaves all non-fixture data untouched. Safe to re-run.

\set guild_id '1417305427766546567'

BEGIN;
DELETE FROM tickets  WHERE guild_id = :'guild_id' AND title LIKE 'MATRIX_TEST_%';
DELETE FROM evidence WHERE guild_id = :'guild_id' AND title LIKE 'MATRIX_TEST_%';
COMMIT;

SELECT 'evidence' AS table_name, COUNT(*) AS remaining
FROM evidence WHERE guild_id = :'guild_id' AND title LIKE 'MATRIX_TEST_%'
UNION ALL
SELECT 'tickets', COUNT(*)
FROM tickets  WHERE guild_id = :'guild_id' AND title LIKE 'MATRIX_TEST_%';
