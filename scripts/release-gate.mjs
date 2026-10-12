import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, openSync, readdirSync, readFileSync, statSync, writeSync } from 'node:fs';
import path from 'node:path';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const port = process.env.PLAYWRIGHT_PORT || '3100';
const root = process.cwd();

// The single source of truth for what "releasable" means. Every suite below is
// resolved to concrete *.spec.ts files on disk before Playwright runs; a suite
// that resolves to nothing aborts the gate so a suite can never be silently
// skipped just because a path filter stopped matching.
const suites = [
  { name: 'phaseB', paths: ['tests/phaseB.spec.ts'] },
  { name: 'auth', paths: ['tests/auth'] },
  { name: 'integrations', paths: ['tests/integrations'] },
  { name: 'security', paths: ['tests/security', 'tests/security.spec.ts'] },
];

function normalize(p) {
  return p.split(path.sep).join('/');
}

// Playwright's JSON `spec.file` is relative to the config's testDir (tests/),
// while our resolved files are relative to the repo root (tests/...). Strip the
// leading testDir segment so per-file lookups match the report keys.
const TEST_DIR = 'tests';
function specKey(relToRoot) {
  const prefix = `${TEST_DIR}/`;
  return relToRoot.startsWith(prefix) ? relToRoot.slice(prefix.length) : relToRoot;
}

function collectSpecFiles(dir, out) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectSpecFiles(full, out);
    else if (entry.isFile() && entry.name.endsWith('.spec.ts')) out.push(full);
  }
}

function resolveSuite(suite) {
  const files = [];
  const missing = [];
  for (const p of suite.paths) {
    const abs = path.join(root, p);
    if (!existsSync(abs)) {
      missing.push(p);
      continue;
    }
    if (statSync(abs).isDirectory()) {
      const found = [];
      collectSpecFiles(abs, found);
      for (const f of found) files.push(normalize(path.relative(root, f)));
    } else {
      files.push(normalize(path.relative(root, abs)));
    }
  }
  return { ...suite, files: [...new Set(files)], missing };
}

function walkSpecs(suitesNode, visit) {
  for (const suite of suitesNode || []) {
    for (const spec of suite.specs || []) visit(spec);
    if (suite.suites) walkSpecs(suite.suites, visit);
  }
}

// --- UTF-8 run log ----------------------------------------------------------
// PowerShell 5.1's `*>` redirect writes UTF-16 (unreadable null-separated text).
// The gate writes its own complete, clean UTF-8 log so a readable transcript is
// always available regardless of how process output was captured. Writes are
// synchronous (writeSync) so nothing is lost even when we process.exit() early.
const logPath = process.env.RELEASE_GATE_LOG || path.join(root, 'test-results', 'release-gate.log');
mkdirSync(path.dirname(logPath), { recursive: true });
const logFd = openSync(logPath, 'w');

function emit(stream, text) {
  stream.write(text);
  writeSync(logFd, text);
}
function say(text) {
  emit(process.stdout, text + '\n');
}
function sayErr(text) {
  emit(process.stderr, text + '\n');
}
say(`[release-gate] Log file: ${normalize(logPath)}`);

// Kill any stale listener holding the gate's port. An interrupted prior run can
// leave a `tsx server.ts` alive; with reuseExistingServer:false the next
// Playwright launch would otherwise fail with a confusing "webServer ... Exit
// code: 1". Clearing the port here makes the gate self-healing.
function freePort(p) {
  const target = Number(p);
  if (!target) return;
  if (process.platform === 'win32') {
    const res = spawnSync('netstat', ['-ano', '-p', 'tcp'], { encoding: 'utf8' });
    if (res.status !== 0 || !res.stdout) return;
    const pids = new Set();
    for (const line of res.stdout.split(/\r?\n/)) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 5 && parts[3] === 'LISTENING' && parts[1].endsWith(`:${target}`)) {
        const pid = Number(parts[4]);
        if (Number.isInteger(pid) && pid > 0 && pid !== process.pid) pids.add(pid);
      }
    }
    for (const pid of pids) {
      spawnSync('taskkill', ['/F', '/PID', String(pid)], { stdio: 'ignore' });
      say(`[release-gate] Cleared stale listener PID ${pid} on port ${target}`);
    }
  } else {
    const res = spawnSync('sh', ['-c', `lsof -ti tcp:${target} 2>/dev/null || true`], { encoding: 'utf8' });
    if (!res.stdout) return;
    for (const token of res.stdout.split(/\s+/)) {
      const pid = Number(token);
      if (Number.isInteger(pid) && pid > 0 && pid !== process.pid) {
        try {
          process.kill(pid, 'SIGKILL');
          say(`[release-gate] Cleared stale listener PID ${pid} on port ${target}`);
        } catch {
          /* already gone */
        }
      }
    }
  }
}

// Run an npm step with live terminal output AND capture it to the UTF-8 log.
// Output is piped (not inherited) so we can tee it; the steps are non-interactive.
function run(label, args) {
  return new Promise((resolve) => {
    const child = spawn(npmCommand, args, {
      stdio: ['inherit', 'pipe', 'pipe'],
      env: { ...process.env, PLAYWRIGHT_PORT: port },
      shell: process.platform === 'win32',
    });
    child.stdout.on('data', (d) => emit(process.stdout, d.toString()));
    child.stderr.on('data', (d) => emit(process.stderr, d.toString()));
    child.on('error', (err) => {
      sayErr(`[release-gate] Failed to start ${label}: ${err.message}`);
      resolve(1);
    });
    child.on('close', (code, signal) => resolve(code ?? (signal ? 1 : 0)));
  });
}

async function runStep(label, args) {
  say(`\n[release-gate] --- ${label} ---`);
  say(`[release-gate] $ ${npmCommand} ${args.join(' ')}`);
  const code = await run(label, args);
  if (code !== 0) {
    sayErr(`[release-gate] FAILED at step: ${label} (exit ${code})`);
    process.exit(code || 1);
  }
  say(`[release-gate] PASSED: ${label}`);
}

// --- Preflight: fail fast on a clean checkout with no dependencies ----------
if (!existsSync(path.join(root, 'node_modules'))) {
  sayErr('[release-gate] node_modules not found. Run "npm ci" first (a clean checkout needs dependencies installed).');
  process.exit(1);
}

// --- Resolve and announce the suite manifest --------------------------------
const resolved = suites.map(resolveSuite);
say('[release-gate] Selected Playwright suites (resolved from disk):');
const allFiles = [];
for (const suite of resolved) {
  if (suite.missing.length > 0) {
    sayErr(`[release-gate] Suite "${suite.name}" references missing path(s): ${suite.missing.join(', ')}`);
    process.exit(1);
  }
  if (suite.files.length === 0) {
    sayErr(`[release-gate] Suite "${suite.name}" resolved to 0 spec files. Refusing to run a gate that could skip a suite.`);
    process.exit(1);
  }
  for (const f of suite.files) allFiles.push(f);
  say(`[release-gate]   ${suite.name} (${suite.files.length}):`);
  for (const f of suite.files) say(`[release-gate]     - ${f}`);
}

// --- Steps: lint -> build -> DB validation -> Playwright --------------------
await runStep('lint (eslint + tsc --noEmit)', ['run', 'lint']);
await runStep('build (tsc + vite + esbuild)', ['run', 'build']);
await runStep('DB validation (pg-mem migrations + RLS)', ['exec', '--', 'tsx', 'supabase/tests/validate_database.ts']);

// --- Playwright: one invocation per suite -----------------------------------
// Each suite runs as its own `playwright test` process so the log names exactly
// which suite is executing and a failing suite fails the whole gate (fail fast
// via runStep). freePort() first: an interrupted prior run can leave the
// webServer port occupied and the next launch would fail with a confusing
// "webServer ... Exit code: 1".
freePort(port);
for (const suite of resolved) {
  const label = `Playwright: ${suite.name} (${suite.files.length} spec file${suite.files.length === 1 ? '' : 's'})`;
  await runStep(label, ['exec', '--', 'playwright', 'test', ...suite.files]);
}

say('');
say('[release-gate] RESULT: PASS - every step ran to completion:');
say('[release-gate]   lint (eslint + tsc --noEmit)');
say('[release-gate]   build (tsc + vite + esbuild)');
say('[release-gate]   DB validation (pg-mem migrations + RLS)');
for (const suite of resolved) {
  say(`[release-gate]   Playwright suite "${suite.name}" (${suite.files.length} file${suite.files.length === 1 ? '' : 's'}):`);
  for (const f of suite.files) say(`[release-gate]     - ${f}`);
}

