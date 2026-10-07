// ==============================================================================
// KIXORA CRYPTOGRAPHIC UTILITIES & SIGNATURE VERIFICATION (Phase 3C)
// Provides MD5 hashing and timing-safe signature comparison for PayFast ITNs
// and HMAC-SHA256 verification for carrier webhooks.
// ==============================================================================

import crypto from 'node:crypto';

/**
 * Perform a timing-safe string comparison to prevent side-channel timing attacks.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }
  const bufA = Buffer.from(a, 'utf-8');
  const bufB = Buffer.from(b, 'utf-8');

  if (bufA.length !== bufB.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Compare tokens without leaking their lengths through the comparison itself.
 */
export function constantTimeTokenEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) {
    return false;
  }

  const digestA = crypto.createHash('sha256').update(a, 'utf-8').digest();
  const digestB = crypto.createHash('sha256').update(b, 'utf-8').digest();
  return crypto.timingSafeEqual(digestA, digestB);
}

/**
 * Compute HMAC-SHA256 hex digest for a given payload and secret.
 */
export function computeHmacSha256(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload, 'utf-8').digest('hex');
}

/**
 * Compute MD5 hex digest for a given payload.
 */
export function computeMd5(payload: string): string {
  return crypto.createHash('md5').update(payload, 'utf-8').digest('hex');
}

export interface CarrierSignatureResult {
  valid: boolean;
  timestamp?: number;
  error?: string;
}

/**
 * Verify Carrier / Shipping webhook signature header with HMAC-SHA256 and timestamp drift validation.
 * Format supported:
 * 1. 't=1614555555,v1=abc...' (Standard timestamped HMAC)
 * 2. 'sha256=abc...' with optional timestampHeader
 * 3. Raw hex digest with optional timestampHeader
 *
 * @param rawBody - Exact unparsed string or Buffer of the HTTP request body
 * @param signatureHeader - The signature header (e.g., 'x-kixora-signature', 'x-shipping-signature')
 * @param secret - The webhook signing secret
 * @param timestampHeader - Optional explicit timestamp header if not in signatureHeader
 * @param toleranceSeconds - Maximum allowed drift between event timestamp and current time (default 300s / 5 min)
 */
export function verifyCarrierWebhookSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
  timestampHeader?: string,
  toleranceSeconds = 300
): CarrierSignatureResult {
  if (!rawBody || typeof rawBody !== 'string') {
    return { valid: false, error: 'Raw body is required for webhook signature verification.' };
  }
  if (!signatureHeader || typeof signatureHeader !== 'string') {
    return { valid: false, error: 'Missing webhook signature header.' };
  }
  if (!secret || typeof secret !== 'string') {
    return { valid: false, error: 'Webhook signing secret is not configured.' };
  }

  let timestampStr: string | null = timestampHeader || null;
  let signatureToCompare: string | null = null;

  // Check if header is key-value formatted (e.g. t=...,v1=...)
  if (signatureHeader.includes('=')) {
    const parts = signatureHeader.split(',').map(p => p.trim());
    for (const part of parts) {
      const [key, value] = part.split('=');
      if (key === 't' && value) {
        timestampStr = value;
      } else if ((key === 'v1' || key === 'sha256' || key === 'sig') && value) {
        signatureToCompare = value;
      }
    }
  } else {
    signatureToCompare = signatureHeader.trim();
  }

  if (!signatureToCompare) {
    return { valid: false, error: 'Signature hash missing in signature header.' };
  }

  // If timestamp is present or provided, enforce replay protection window
  let timestamp: number | undefined;
  if (timestampStr) {
    timestamp = parseInt(timestampStr, 10);
    // Support either seconds or milliseconds
    if (timestamp > 1000000000000) {
      timestamp = Math.floor(timestamp / 1000);
    }
    if (isNaN(timestamp)) {
      return { valid: false, error: 'Invalid timestamp format in webhook header.' };
    }

    const now = Math.floor(Date.now() / 1000);
    const drift = Math.abs(now - timestamp);
    if (drift > toleranceSeconds) {
      return {
        valid: false,
        timestamp,
        error: `Webhook timestamp is outside the tolerance window (${drift}s drift exceeds ${toleranceSeconds}s limit).`
      };
    }
  }

  // Calculate expected HMAC
  const payloadToSign = timestampStr ? `${timestampStr}.${rawBody}` : rawBody;
  const expectedSignature = computeHmacSha256(payloadToSign, secret);

  // Also check without timestamp prefix if direct body signing was used
  const directSignature = computeHmacSha256(rawBody, secret);

  const isValid =
    timingSafeEqual(signatureToCompare.toLowerCase(), expectedSignature.toLowerCase()) ||
    timingSafeEqual(signatureToCompare.toLowerCase(), directSignature.toLowerCase());

  if (!isValid) {
    return {
      valid: false,
      timestamp,
      error: 'Calculated webhook signature does not match received signature.'
    };
  }

  return { valid: true, timestamp };
}

export interface PayFastSignatureResult {
  valid: boolean;
  expectedSignature?: string;
  error?: string;
}

/**
 * Generate PayFast parameter string and calculate MD5 signature.
 * Keeps blank values and parameter order because PayFast ITNs sign both.
 */
export function generatePayFastSignature(
  data: Record<string, any>,
  passphrase?: string
): string {
  const keys = Object.keys(data).filter(
    key => key !== 'signature' && data[key] !== undefined && data[key] !== null
  );
  
  // PayFast preserves post order or alphabetical order
  const paramPairs: string[] = [];
  for (const key of keys) {
    const val = String(data[key]).trim();
    paramPairs.push(`${key}=${encodeURIComponent(val).replace(/%20/g, '+')}`);
  }

  let paramString = paramPairs.join('&');
  if (passphrase && passphrase.trim() !== '') {
    paramString += `&passphrase=${encodeURIComponent(passphrase.trim()).replace(/%20/g, '+')}`;
  }

  return computeMd5(paramString);
}

/**
 * Verify PayFast ITN notification signature.
 */
export function verifyPayFastSignature(
  data: Record<string, any>,
  receivedSignature: string,
  passphrase?: string
): PayFastSignatureResult {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid PayFast data payload.' };
  }
  if (!receivedSignature || typeof receivedSignature !== 'string') {
    return { valid: false, error: 'Missing PayFast signature.' };
  }

  const expected = generatePayFastSignature(data, passphrase);
  const isValid = timingSafeEqual(receivedSignature.trim().toLowerCase(), expected.toLowerCase());

  if (!isValid) {
    return {
      valid: false,
      expectedSignature: expected,
      error: 'Calculated PayFast signature does not match received signature.'
    };
  }

  return { valid: true, expectedSignature: expected };
}
