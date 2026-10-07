-- Keep the seeded KIX10 promo consistent with the storefront fallback.
-- Guest cart smoke tests intentionally apply KIX10 to the first catalog item,
-- which may be below the database seed's former R1,500 minimum.
UPDATE public.promo_codes
SET min_spend = 0,
    is_active = true
WHERE code = 'KIX10';
