drop policy if exists "Bespoke designs viewable by creator or admin" on public.bespoke_designs;
drop policy if exists "Users or guests can create bespoke designs" on public.bespoke_designs;

create policy "Bespoke designs viewable by creator or admin"
  on public.bespoke_designs for select to authenticated
  using (auth.uid() = user_id or is_admin());

create policy "Users can create own bespoke designs"
  on public.bespoke_designs for insert to authenticated
  with check (auth.uid() = user_id or is_admin());

revoke insert on public.bespoke_designs from anon;
