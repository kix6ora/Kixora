-- 0031_explicit_data_api_grants.sql

-- Public catalog: readable by anyone (RLS limits rows, e.g. is_active)
grant select on public.products, public.drops, public.brands, public.categories,
               public.product_images, public.product_sizes, public.inventory to anon;

-- Guest bespoke designs (policy allows guests to create and view their own)
grant select, insert on public.bespoke_designs to anon;

-- Signed-in users and admins. Policies decide who gets which rows.
grant select, insert, update, delete on
  public.products, public.drops, public.brands, public.categories,
  public.product_images, public.product_sizes, public.inventory,
  public.inventory_reservations, public.inventory_sync_logs,
  public.fulfillment_batches, public.fulfillment_channels, public.fulfillment_locations,
  public.promo_codes, public.shipments,
  public.carts, public.cart_items, public.wishlists, public.bespoke_designs
to authenticated;

grant select, insert on public.admin_audit_logs to authenticated;
grant select, insert, update on public.profiles, public.raffle_entries to authenticated;

-- Orders are written only through RPCs and the server, so read-only here
grant select on public.orders, public.order_items,
                public.order_status_history, public.promo_redemptions to authenticated;