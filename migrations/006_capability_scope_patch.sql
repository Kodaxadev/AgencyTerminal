-- Agency Terminal capability scope patch.
-- Adds more specific capabilities for controls page scoping.

alter type capability add value if not exists 'can_manage_enlistment';
alter type capability add value if not exists 'can_view_audit';
alter type capability add value if not exists 'can_view_sensitive_contracts';
alter type capability add value if not exists 'can_view_sensitive_intel';
