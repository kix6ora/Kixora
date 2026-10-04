const required = [
  'GCP_PROJECT_ID',
  'GCP_SERVICE_ACCOUNT_KEY',
  'CLOUD_RUN_REGION',
  'CLOUD_RUN_SERVICE_STAGING',
];

const missing = required.filter((key) => !process.env[key] || process.env[key].trim() === '');

if (missing.length > 0) {
  console.error('Missing deployment environment variables:');
  for (const key of missing) {
    console.error(`- ${key}`);
  }
  process.exit(1);
}

console.log('Deployment prerequisites validated for Cloud Run.');
