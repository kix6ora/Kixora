-- 0030_service_role_grants_and_rls_baseline.sql

-- 1. Server-side role: the service-role key is server-only and bypasses RLS,
--    but it still needs table privileges.
grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- 2. This table was the only one with RLS off. With RLS on and no policies,
--    anon and authenticated are denied; service_role is unaffected.
alter table public.payment_reconciliation_logs enable row level security;

-- 3. Remove privileges that RLS does not control.
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;