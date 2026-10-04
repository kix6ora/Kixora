import { execFileSync } from 'node:child_process';

const services = {
  customer: 'https://kixora-staging.onrender.com/api/health',
  admin: 'https://kixora-admin-staging.onrender.com/api/health',
};
const expectedCommit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
const pollCount = 20;
const pollIntervalMs = 30_000;

async function readCommit(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    let commit = null;
    try {
      const body = await response.json();
      commit = typeof body.commit === 'string' ? body.commit : null;
    } catch {
      commit = null;
    }
    return { status: response.status, commit };
  } catch {
    return { status: 'unreachable', commit: null };
  }
}

let current = {};
for (let attempt = 1; attempt <= pollCount; attempt += 1) {
  current = Object.fromEntries(await Promise.all(
    Object.entries(services).map(async ([name, url]) => [name, await readCommit(url)]),
  ));
  console.log(JSON.stringify({
    attempt,
    expectedCommit,
    customer: current.customer,
    admin: current.admin,
  }));
  if (Object.values(current).every((service) => service.status === 200 && service.commit === expectedCommit)) {
    process.exit(0);
  }
  if (attempt < pollCount) await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
}

for (const [name, service] of Object.entries(current)) {
  if (service.status !== 200 || service.commit !== expectedCommit) {
    console.error(`${name} service did not reach ${expectedCommit}. Check Render branch/auto-deploy and manually deploy latest commit.`);
  }
}
process.exitCode = 1;
