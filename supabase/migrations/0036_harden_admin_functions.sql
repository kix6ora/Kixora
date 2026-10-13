create or replace function public.get_auth_role()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb -> 'app_metadata' ->> 'role',
    'anon'
  );
exception when others then
  return 'anon';
end;
$$;

alter function public.is_admin() set search_path = public, pg_temp;
alter function public.is_super_admin() set search_path = public, pg_temp;

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert to public
  with check (auth.uid() = id and role = 'customer');
