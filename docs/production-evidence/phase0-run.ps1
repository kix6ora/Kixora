# Phase 0 - Baseline and Agent Workspace reproduction script.
# Runs: pin baseline -> branch -> .env -> npm ci -> playwright install ->
# 20 integration tests + 6 RLS tests -> lint -> build.
# Every step's exit code is appended to phase0-run.log for later evidence review.
$ErrorActionPreference = 'Continue'
$repo = 'C:\Users\mandl\OneDrive\Desktop\Kixora'
Set-Location $repo
$ev = Join-Path $repo 'docs\production-evidence'
$T  = Join-Path $env:TEMP 'kixora-phase0'
New-Item -ItemType Directory -Force -Path $T | Out-Null
$run = Join-Path $ev 'phase0-run.log'
function Mark($m) { Add-Content -Path $run -Value ("### {0} :: {1}" -f $m, (Get-Date -Format o)) }
Set-Content -Path $run -Value ("### START {0}" -f (Get-Date -Format o))

# Step 0: free port 3000 if a stale server (e.g. previous session's webServer) still holds it.
$listener = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($listener) {
    $pids = $listener | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($procId in $pids) {
        $p = Get-Process -Id $procId -ErrorAction SilentlyContinue
        if ($p) { Mark ("killing stale listener pid={0} name={1}" -f $procId, $p.ProcessName); Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue }
    }
    Start-Sleep -Seconds 2
} else { Mark "port3000-free" }

# Step 1: pin the audit baseline (fresh-clone HEAD = main) and create the work branch.
git status --short --branch 2>&1 | Out-File -Append -FilePath $run
git checkout main 2>&1 | Out-File -Append -FilePath $run
Mark ("checkout-main rc={0}" -f $LASTEXITCODE)
$branchNow = (git branch --show-current) 2>&1 | Out-String
$headNow = (git rev-parse HEAD) 2>&1 | Out-String
Add-Content -Path $run -Value ("state branch='{0}' head='{1}'" -f $branchNow.Trim(), $headNow.Trim())
if ($branchNow.Trim() -ne 'main') { Mark "ABORT: could not return to main"; exit 2 }
git checkout -b production-readiness/audit-execution 2>&1 | Out-File -Append -FilePath $run
Mark ("create-branch rc={0}" -f $LASTEXITCODE)
Add-Content -Path $run -Value ("state branch='{0}'" -f ((git branch --show-current) | Out-String).Trim())

# Step 2: local env in mock mode (never overwrite an existing local .env).
if (!(Test-Path -Path (Join-Path $repo '.env'))) { Copy-Item .env.example .env }
Mark ("env-present={0}" -f (Test-Path -Path (Join-Path $repo '.env')))

# Step 3: reproducible install.
npm ci *> (Join-Path $T 'npm-ci.log')
Mark ("npm-ci rc={0}" -f $LASTEXITCODE)
if ($LASTEXITCODE -ne 0) { Mark "ABORT: npm ci failed"; exit 3 }

# Step 4: playwright browsers.
npx playwright install --with-deps *> (Join-Path $T 'pw-install.log')
Mark ("pw-install rc={0}" -f $LASTEXITCODE)
if ($LASTEXITCODE -ne 0) { Mark "ABORT: playwright install failed"; exit 4 }

# Step 5: the two audit suites (expect 20 passed, then 6 passed).
npx playwright test tests/integrations --reporter=line *> (Join-Path $ev 'phase0-integrations-test.log')
Mark ("test-integrations rc={0}" -f $LASTEXITCODE)
npx playwright test tests/security/phase8-rls-penetration.spec.ts --reporter=line *> (Join-Path $ev 'phase0-rls-test.log')
Mark ("test-rls rc={0}" -f $LASTEXITCODE)

# Step 6: lint and build.
npm run lint *> (Join-Path $ev 'phase0-lint.log')
Mark ("lint rc={0}" -f $LASTEXITCODE)
npm run build *> (Join-Path $ev 'phase0-build.log')
Mark ("build rc={0}" -f $LASTEXITCODE)

Mark "ALL-STEPS-COMPLETE"