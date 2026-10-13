# Staging Gate Deferrals

## Google sign-in — deferred from Item 1

- **What:** Google sign-in for customer or administrator accounts.
- **Why:** The application has no Supabase `signInWithOAuth` flow or Google sign-in button. The existing Google Identity Services hook is for Google Drive report access in the admin Orders page, not account authentication.
- **Risk:** None for checkout or email/password authentication.
- **Dashboard prerequisites:** Enable Google under Supabase Authentication providers; configure a Google OAuth web client and its client ID/secret; register both staging site origins as authorized JavaScript origins; and configure the Supabase callback URL (`https://gzxhgeudovbdpgbvzwoa.supabase.co/auth/v1/callback`) in the Google OAuth client.
- **Add later when:** Product approval requests Google account sign-in and the Supabase provider plus Google OAuth client settings have been completed and verified on staging.

## Replace placeholder icons with the real logo — deferred

- **What:** Replace the placeholder site/app icons with approved Kixora brand assets.
- **Why:** The staging gate targets the real staging runtime, checkout, and access controls; the repository does not provide an approved final icon asset to install.
- **Risk:** No impact to checkout, email/password authentication, or the staging origin; browser/app branding remains incomplete.
- **Prerequisite:** Supply approved icon files and confirm the required sizes and branding usage.
- **Add later when:** The approved asset set is available for the favicon, manifest icons, and any platform-specific icons.

## Live PayFast account passphrase — deferred

- **What:** Configure the live PayFast account with a passphrase distinct from the sandbox passphrase.
- **Why:** This gate validates sandbox only; live checkout is explicitly excluded.
- **Risk:** No impact to sandbox checkout or staging email/password authentication. Live PayFast processing remains unavailable until configured and separately verified.
- **Prerequisite:** Set a distinct live-account passphrase in the protected production Render environment and align the live PayFast account configuration.
- **Add later when:** A separate production-readiness gate authorizes live payment verification. Never use live checkout as part of this staging gate.

## Tailwind v3 -> v4 migration — deferred

- **What:** Tailwind v3 -> v4 migration deferred. 5 high + 2 moderate npm advisories (braces, chokidar, micromatch, fast-glob, postcss-selector-parser, postcss-nested) are build-time (dev) dependencies via tailwindcss <=3.4.19; not present in the production runtime. CI audit gate now checks production dependencies only. Revisit before production go-live.
- **Why:** The flagged advisories come from the Tailwind v3 build-time dependency chain and do not ship in the production runtime.
- **Risk:** No impact to the production runtime; build-time tooling remains on Tailwind v3 until migration.
- **Add later when:** Tailwind v4 migration is scheduled and verified before production go-live.
