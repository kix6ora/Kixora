import { createHash, randomUUID } from 'node:crypto';

const [orderCode, testCase] = process.argv.slice(2);
const customerUrl = process.env.STAGING_CUSTOMER_URL;
const passphrase = process.env.PAYFAST_PASSPHRASE;
const merchantId = process.env.VITE_PAYFAST_MERCHANT_ID;
const orderAmount = Number(process.env.STAGING_ORDER_AMOUNT);
const supportedCases = new Set([
  'valid',
  'duplicate',
  'wrong-amount',
  'wrong-signature',
  'unknown-order',
  'cancelled',
]);

if (!orderCode || !supportedCases.has(testCase)) {
  console.error(
    'Usage: node scripts/staging/payfast-itn-replay.mjs <order-code> <valid|duplicate|wrong-amount|wrong-signature|unknown-order|cancelled>'
  );
  process.exit(2);
}
if (!customerUrl || !passphrase || !merchantId || !Number.isFinite(orderAmount) || orderAmount <= 0) {
  console.error(
    'Set STAGING_CUSTOMER_URL, PAYFAST_PASSPHRASE, VITE_PAYFAST_MERCHANT_ID, and STAGING_ORDER_AMOUNT.'
  );
  process.exit(2);
}

function sign(fields) {
  const parameters = Object.keys(fields)
    .filter(key => key !== 'signature' && fields[key] !== undefined && fields[key] !== null)
    .map(key => `${key}=${encodeURIComponent(String(fields[key]).trim()).replace(/%20/g, '+')}`);
  parameters.push(`passphrase=${encodeURIComponent(passphrase.trim()).replace(/%20/g, '+')}`);
  return createHash('md5').update(parameters.join('&'), 'utf8').digest('hex');
}

function createPayload(paymentStatus, amount, targetOrderCode) {
  const fields = {
    merchant_id: merchantId,
    m_payment_id: targetOrderCode,
    pf_payment_id: `REPLAY-${randomUUID()}`,
    payment_status: paymentStatus,
    item_name: `Kixora order ${targetOrderCode}`,
    amount_gross: amount.toFixed(2),
    amount_fee: '0.00',
    amount_net: amount.toFixed(2),
    currency: 'ZAR',
  };
  fields.signature = sign(fields);
  if (testCase === 'wrong-signature') fields.signature = 'invalid-signature';
  return fields;
}

async function postNotification(fields, requestNumber) {
  const endpoint = new URL('/api/webhooks/payfast', customerUrl);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields),
    signal: AbortSignal.timeout(15000),
  });
  const result = (await response.text()).trim();
  console.log(
    `${testCase} request ${requestNumber}: HTTP ${response.status}${result ? ` (${result})` : ''}`
  );
}

const targetOrderCode = testCase === 'unknown-order'
  ? `KXO-UNKNOWN-${randomUUID()}`
  : orderCode;
const paymentStatus = testCase === 'cancelled' ? 'CANCELLED' : 'COMPLETE';
const amount = testCase === 'wrong-amount' ? orderAmount + 1 : orderAmount;
const payload = createPayload(paymentStatus, amount, targetOrderCode);
const requestCount = testCase === 'duplicate' ? 2 : 1;

for (let requestNumber = 1; requestNumber <= requestCount; requestNumber += 1) {
  await postNotification(payload, requestNumber);
}
