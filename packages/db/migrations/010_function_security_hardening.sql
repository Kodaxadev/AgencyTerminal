-- Function security hardening.
-- Addresses Supabase database advisors:
--   * anon_security_definer_function_executable / authenticated_security_definer_function_executable
--     on public.rls_auto_enable() — REST-exposed SECURITY DEFINER function.
--   * function_search_path_mutable on the internal trigger functions.

-- Revoke EXECUTE on the event-trigger function from REST-exposed roles.
-- Event triggers run as the system role; REST callers never need this.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;

-- Pin search_path on internal trigger functions so they cannot be hijacked
-- by a shadowing object in a user-controlled schema. pg_catalog must be on
-- the path because the assign_* functions call nextval() and lpad(), and
-- set_updated_at() calls now(). public is included for the sequences.
ALTER FUNCTION public.set_updated_at()           SET search_path = pg_catalog, public;
ALTER FUNCTION public.assign_ticket_short_id()   SET search_path = pg_catalog, public;
ALTER FUNCTION public.assign_evidence_short_id() SET search_path = pg_catalog, public;
