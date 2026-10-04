# Phase 0 finalize: commit the evidence set and push the work branch.
# GIT_TERMINAL_PROMPT=0 makes a credential-less push fail fast instead of hanging.
$ErrorActionPreference = 'Continue'
$repo = 'C:\Users\mandl\OneDrive\Desktop\Kixora'
Set-Location $repo
$T = Join-Path $env:TEMP 'kixora-phase0'
New-Item -ItemType Directory -Force -Path $T | Out-Null
$log = Join-Path $T 'finalize.log'
function Mark($m) { Add-Content -Path $log -Value ("### {0} :: {1}" -f $m, (Get-Date -Format o)) }
Set-Content -Path $log -Value ("### START {0}" -f (Get-Date -Format o))
$env:GIT_TERMINAL_PROMPT = '0'
$env:GCM_INTERACTIVE = 'never'

git add docs/production-evidence 2>&1 | Out-File -Append -FilePath $log
Mark ("git-add rc={0}" -f $LASTEXITCODE)
git status --short 2>&1 | Out-File -Append -FilePath $log

git commit -m "Phase 0: pin baseline 7768759 and record reproduced mock-mode evidence" -m "Evidence: 17/17 integrations pass and 6/6 RLS pass on the pinned commit; audit doc's 20/26 test counts are not reproducible (only 5 integration spec files exist on main and production-hardening). RLS-05 cold-start 60s timeout recorded and shown to pass on warm re-run. See docs/production-evidence/TRACKER.md." 2>&1 | Out-File -Append -FilePath $log
Mark ("git-commit rc={0}" -f $LASTEXITCODE)
git rev-parse --short HEAD 2>&1 | Out-File -Append -FilePath $log
git branch --show-current 2>&1 | Out-File -Append -FilePath $log
git log --oneline -1 2>&1 | Out-File -Append -FilePath $log

git push -u origin production-readiness/audit-execution 2>&1 | Out-File -Append -FilePath $log
Mark ("git-push rc={0}" -f $LASTEXITCODE)
git rev-parse --short origin/production-readiness/audit-execution 2>&1 | Out-File -Append -FilePath $log
Mark ("verify-origin rc={0}" -f $LASTEXITCODE)

Mark "FINALIZE-COMPLETE"