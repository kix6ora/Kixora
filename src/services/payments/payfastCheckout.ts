import { getEnvConfig, getServerConfig } from '../../config/env';
import { constantTimeTokenEqual, generatePayFastSignature } from './crypto';

export interface PayFastOrderRecord {
  order_code: string;
  user_id: string | null;
  guest_access_token: string | null;
  payment_status: string;
  total: number | string;
  customer_snapshot: Record<string, unknown> | null;
}

export interface PayFastCheckoutCredentials {
  bearerToken?: string;
  guestAccessToken?: string;
}

export interface PayFastOrderLookup {
  order: PayFastOrderRecord | null;
  error?: unknown;
}

export interface PayFastCheckoutDependencies {
  findOrder(orderCode: string): Promise<PayFastOrderLookup>;
  getUserId(accessToken: string): Promise<string | null>;
  config?: {
    merchantId: string;
    merchantKey: string;
    passphrase: string;
    customerOrigin: string;
    sandbox: boolean;
  };
}

export interface PayFastCheckoutResponse {
  status: number;
  body: { error: string } | { processUrl: string; fields: Record<string, string> };
}

function getCheckoutConfig(): NonNullable<PayFastCheckoutDependencies['config']> {
  const clientConfig = getEnvConfig();
  const serverConfig = getServerConfig();
  return {
    merchantId: clientConfig.payfastMerchantId,
    merchantKey: clientConfig.payfastMerchantKey,
    passphrase: serverConfig.payfastPassphrase,
    customerOrigin: serverConfig.customerOrigin,
    sandbox: clientConfig.payfastSandbox,
  };
}

export async function authorizePayFastOrder(
  order: PayFastOrderRecord,
  credentials: PayFastCheckoutCredentials,
  getUserId: PayFastCheckoutDependencies['getUserId']
): Promise<boolean> {
  let authorized = false;

  if (credentials.bearerToken) {
    try {
      const userId = await getUserId(credentials.bearerToken);
      authorized = Boolean(userId && order.user_id && userId === order.user_id);
    } catch {
      authorized = false;
    }
  }

  if (credentials.guestAccessToken && order.guest_access_token) {
    authorized = constantTimeTokenEqual(credentials.guestAccessToken, order.guest_access_token) || authorized;
  }

  return authorized;
}

function getBearerToken(authorization?: string): string | undefined {
  const match = authorization?.match(/^Bearer\s+([^\s]+)$/i);
  return match?.[1];
}

function getCustomerSnapshotValue(order: PayFastOrderRecord, key: string): string {
  const value = order.customer_snapshot?.[key];
  return typeof value === 'string' ? value.trim() : '';
}

export async function initiatePayFastCheckout(
  input: {
    orderCode?: unknown;
    guestAccessToken?: unknown;
    authorization?: string;
    amount?: unknown;
  },
  dependencies: PayFastCheckoutDependencies
): Promise<PayFastCheckoutResponse> {
  const orderCode = typeof input.orderCode === 'string' ? input.orderCode.trim() : '';
  if (!orderCode) {
    return { status: 400, body: { error: 'Order code is required.' } };
  }

  const lookup = await dependencies.findOrder(orderCode);
  if (lookup.error) {
    return { status: 500, body: { error: 'Unable to load order for payment.' } };
  }
  if (!lookup.order) {
    return { status: 404, body: { error: 'Order not found.' } };
  }

  const order = lookup.order;
  const guestAccessToken = typeof input.guestAccessToken === 'string'
    ? input.guestAccessToken
    : undefined;
  const authorized = await authorizePayFastOrder(
    order,
    { bearerToken: getBearerToken(input.authorization), guestAccessToken },
    dependencies.getUserId
  );
  if (!authorized) {
    return { status: 403, body: { error: 'Not authorized to pay for this order.' } };
  }
  if (order.payment_status !== 'pending') {
    return { status: 409, body: { error: 'Order is not awaiting payment.' } };
  }

  const config = dependencies.config || getCheckoutConfig();
  if (!config.merchantId || !config.merchantKey || !config.passphrase) {
    return { status: 503, body: { error: 'PayFast is not configured on the server.' } };
  }

  const amount = Number(order.total);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { status: 422, body: { error: 'Order total is invalid.' } };
  }

  const customerOrigin = new URL(config.customerOrigin).origin;
  const returnUrl = new URL('/', customerOrigin);
  returnUrl.searchParams.set('order', order.order_code);
  const cancelUrl = new URL('/', customerOrigin);
  cancelUrl.searchParams.set('cancel', 'true');
  cancelUrl.searchParams.set('order', order.order_code);

  const fullName = getCustomerSnapshotValue(order, 'fullName');
  const fields: Record<string, string> = {
    merchant_id: config.merchantId,
    merchant_key: config.merchantKey,
    return_url: returnUrl.toString(),
    cancel_url: cancelUrl.toString(),
    notify_url: new URL('/api/webhooks/payfast', customerOrigin).toString(),
    name_first: fullName.split(/\s+/)[0] || 'Kixora Collector',
    email_address: getCustomerSnapshotValue(order, 'email'),
    m_payment_id: order.order_code,
    amount: amount.toFixed(2),
    item_name: `Kixora Vault Order #${order.order_code}`,
    item_description: `Authentication & Courier for Order ${order.order_code}`,
  };
  fields.signature = generatePayFastSignature(fields, config.passphrase);

  return {
    status: 200,
    body: {
      processUrl: config.sandbox
        ? 'https://sandbox.payfast.co.za/eng/process'
        : 'https://www.payfast.co.za/eng/process',
      fields,
    },
  };
}
