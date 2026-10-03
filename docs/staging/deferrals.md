# Staging Gate Deferrals

## Google sign-in — deferred from Item 1

- **What:** Google sign-in for customer or administrator accounts.
- **Why:** The application has no Supabase `signInWithOAuth` flow or Google sign-in button. The existing Google Identity Services hook is for Google Drive report access in the admin Orders page, not account authentication.
- **Risk:** None for checkout or email/password authentication.
- **Dashboard prerequisites:** Enable Google under Supabase Authentication providers; configure a Google OAuth web client and its client ID/secret; register both staging site origins as authorized JavaScript origins; and configure the Supabase callback URL (`https://gzxhgeudovbdpgbvzwoa.supabase.co/auth/v1/callback`) in the Google OAuth client.
- **Add later when:** Product approval requests Google account sign-in and the Supabase provider plus Google OAuth client settings have been completed and verified on staging.
