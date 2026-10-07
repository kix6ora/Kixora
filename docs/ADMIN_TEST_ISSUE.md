# Admin Test Flaky Test Issue

## Problem
Admin smoke tests are failing because the admin dashboard is not loading properly when using the `?domain=admin` URL parameter and mock authentication.

## Current Status
- Customer smoke tests: ✅ 7/7 passing
- Admin smoke tests: ❌ 0/6 passing (all timeout/not found errors)

## Root Cause Analysis
The admin dashboard requires proper authentication flow that may not be working with the current mock session approach. The `?domain=admin` parameter combined with mock localStorage session may not be triggering the proper admin view rendering.

## Investigation Needed
1. Verify admin authentication flow with Supabase
2. Check if DomainGuard is properly allowing admin access
3. Test with real Supabase staging credentials
4. Review AdminRoute component authentication logic

## Temporary Workaround
- Skip admin tests in CI/CD until authentication is properly configured
- Test admin functionality manually with real Supabase credentials
- Re-enable tests once staging environment is set up with real auth

## Next Steps
1. Set up staging Supabase environment (Documented in STAGING_SETUP_GUIDE.md)
2. Test admin authentication with real staging credentials
3. Update test fixtures to work with real auth or improved mock
4. Re-enable admin tests once stable

## Priority
Medium - Critical admin functionality can be tested manually while tests are being fixed.
