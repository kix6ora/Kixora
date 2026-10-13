do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('revoke truncate, references, trigger on public.%I from anon, authenticated', r.tablename);
  end loop;
end $$;

alter default privileges in schema public revoke truncate, references, trigger on tables from anon, authenticated;

alter table public.payment_reconciliation_logs enable row level security;
revoke all on public.payment_reconciliation_logs from anon, authenticated;
