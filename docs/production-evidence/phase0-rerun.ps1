# Phase 0 rerun + reconciliation.
# 1) Re-run the RLS suite on a warm Vite/deps cache to confirm the RLS-05
#    cold-start timeout was environmental, not a code regression.
# 2) Collect branch/test-count evidence to reconcile the audit's "20 passed"
#    expectation against the 17 tests present on main.
$ErrorActionPreference = 'Continue'
$repo = 'C:\Users\mandl\OneDrive\Desktop\Kixora'
Set-Location $repo
$ev = Join-Path $repo 'docs\production-evidence'
$run = Join-Path $ev 'phase0-rerun.log'
function Mark($m) { Add-Content -Path $run -Value ("### {0} :: {1}" -f $m, (Get-Date -Format o)) }
Set-Content -Path $run -Value ("### START {0}" -f (Get-Date -Format o))

# Ensure port 3000 is free before starting (wait up to 5 minutes for any prior run).
$waited = 0
while ((Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) -and $waited -lt 300) {
    Start-Sleep -Seconds 10; $waited += 10
}
if (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) {
    Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique |
        ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
    Mark "killed-stale-listener-after-wait"
}
Mark ("port3000-free after {0}s wait" -f $waited)

# A) Warm re-run of the RLS penetration suite.
npx playwright test tests/security/phase8-rls-penetration.spec.ts --reporter=line *> (Join-Path $ev 'phase0-rls-rerun.log')
Mark ("rls-rerun rc={0}" -f $LASTEXITCODE)

# B) Branch/ref state.
git rev-parse main 2>&1 | Out-File -Append -FilePath $run
git rev-parse production-hardening 2>&1 | Out-File -Append -FilePath $run
git rev-parse origin/production-hardening 2>&1 | Out-File -Append -FilePath $run
git rev-parse origin/main 2>&1 | Out-File -Append -FilePath $run
Mark ("refs-read rc={0}" -f $LASTEXITCODE)

# C) Which integration specs exist on each branch?
"--- ls-tree main tests/integrations ---" | Out-File -Append -FilePath $run
git ls-tree -r --name-only main -- tests/integrations 2>&1 | Out-File -Append -FilePath $run
"--- ls-tree origin/production-hardening tests/integrations ---" | Out-File -Append -FilePath $run
git ls-tree -r --name-only origin/production-hardening -- tests/integrations 2>&1 | Out-File -Append -FilePath $run
Mark ("ls-tree rc={0}" -f $LASTEXITCODE)

# D) How far apart are the branches?
"--- log main..origin/production-hardening ---" | Out-File -Append -FilePath $run
git log --oneline main..origin/production-hardening 2>&1 | Out-File -Append -FilePath $run
"--- diff --stat main origin/production-hardening -- tests/ ---" | Out-File -Append -FilePath $run
git diff --stat main origin/production-hardening -- tests/ 2>&1 | Out-File -Append -FilePath $run
Mark ("branch-diff rc={0}" -f $LASTEXITCODE)

Mark "ALL-RERUN-COMPLETE"