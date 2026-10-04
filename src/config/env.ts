// Kixora Production Environment Configuration & Validation
import { validateCorsAllowlistForProduction } from './cors';

/**
 * Client-safe configuration. These variables are safe to expose to the browser.
 * They MUST be prefixed with VITE_ in the environment.
 */
export interface ClientEnvConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  useSupabaseCatalog: boolean;
  paymentProviderMode: 'mock' | 'payfast';
  payfastMerchantId: string;
  payfastMerchantKey: string;
  payfastSandbox: boolean;
  customerDomain: string;
  adminDomain: string;
  googleClientId: string;
  cloudinaryCloudName: string;
  cloudinaryUploadPreset: string;
  cloudinaryApiKey: string;
}

/**
 * Server-only configuration. These variables contain sensitive secrets
 * and MUST NOT be prefixed with VITE_. They are only accessible in the Node.js environment.
 */
export interface ServerEnvConfig {
  payfastPassphrase: string;
  payfastMerchantKeySecret: string; 
  supabaseServiceRoleKey: string;
  resendApiKey: string;
  emailFrom: string;
  theCourierGuyApiKey: string;
  shippingWebhookSecret: string;
  adminOrigin: string;
  customerOrigin: string;
}

export interface ProductionEnvValidation {
  valid: boolean;
  errors: string[];
}

export function getEnvConfig(): ClientEnvConfig {
  const metaEnv = (typeof import.meta !== 'undefined' && (import.meta as any).env) || {};
  const procEnv = (typeof process !== 'undefined' && process.env) || {};
  const readEnv = (key: string) => procEnv[key] ?? metaEnv[key];

  const configuredProvider = readEnv('VITE_PAYMENT_PROVIDER_MODE') || 'mock';
  if (configuredProvider !== 'mock' && configuredProvider !== 'payfast') {
    throw new Error(`Payment configuration Error: Unsupported payment provider "${configuredProvider}".`);
  }
  const paymentProviderMode: ClientEnvConfig['paymentProviderMode'] = configuredProvider;

  return {
    supabaseUrl: readEnv('VITE_SUPABASE_URL') || '',
    supabaseAnonKey: readEnv('VITE_SUPABASE_ANON_KEY') || '',
    useSupabaseCatalog: readEnv('VITE_USE_SUPABASE_CATALOG') === 'true',
    paymentProviderMode,
    payfastMerchantId: readEnv('VITE_PAYFAST_MERCHANT_ID') || '',
    payfastMerchantKey: readEnv('VITE_PAYFAST_MERCHANT_KEY') || '',
    payfastSandbox: (readEnv('VITE_PAYFAST_SANDBOX') ?? 'true') !== 'false',
    customerDomain: readEnv('VITE_CUSTOMER_DOMAIN') || 'https://kixora.com',
    adminDomain: readEnv('VITE_ADMIN_DOMAIN') || 'https://admin.kixora.com',
    googleClientId: readEnv('VITE_GOOGLE_CLIENT_ID') || '',
    cloudinaryCloudName: readEnv('VITE_CLOUDINARY_CLOUD_NAME') || 'kixora',
    cloudinaryUploadPreset: readEnv('VITE_CLOUDINARY_UPLOAD_PRESET') || 'kixora_product_images',
    cloudinaryApiKey: readEnv('VITE_CLOUDINARY_API_KEY') || '',
  };
}

/**
 * Retrieves server-side secrets. This will return empty strings in the browser.
 */
export function getServerConfig(): ServerEnvConfig {
  const isServer = typeof process !== 'undefined' && process.env;
  if (!isServer) {
    return {
      payfastPassphrase: '',
      payfastMerchantKeySecret: '',
      supabaseServiceRoleKey: '',
      resendApiKey: '',
      emailFrom: '',
      theCourierGuyApiKey: '',
      shippingWebhookSecret: '',
      adminOrigin: '',
      customerOrigin: '',
    };
  }

  const env = process.env;
  return {
    payfastPassphrase: env.PAYFAST_PASSPHRASE || '',
    payfastMerchantKeySecret: env.PAYFAST_MERCHANT_KEY || '',
    supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY || '',
    resendApiKey: env.RESEND_API_KEY || '',
    emailFrom: env.EMAIL_FROM || 'Kixora Vault <orders@kixora.com>',
    theCourierGuyApiKey: env.THE_COURIER_GUY_API_KEY || '',
    shippingWebhookSecret: env.SHIPPING_WEBHOOK_SECRET || '',
    adminOrigin: env.ADMIN_ORIGIN || env.VITE_ADMIN_ORIGIN || env.VITE_ADMIN_DOMAIN || 'https://admin.kixora.com',
    customerOrigin: env.CUSTOMER_ORIGIN || env.VITE_CUSTOMER_ORIGIN || env.VITE_CUSTOMER_DOMAIN || 'https://kixora.com',
  };
}

export function validateProductionEnv(): ProductionEnvValidation {
  if (process.env.NODE_ENV !== 'production') {
    return { valid: true, errors: [] };
  }

  const client = getEnvConfig();
  const server = getServerConfig();
  const errors: string[] = [];
  const provider = client.paymentProviderMode;

  if (!client.supabaseUrl || !client.supabaseAnonKey) {
    errors.push('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required in production.');
  }
  if (!server.supabaseServiceRoleKey) {
    errors.push('SUPABASE_SERVICE_ROLE_KEY is required for server-side commerce reconciliation.');
  }

  if (provider !== 'payfast') {
    errors.push('VITE_PAYMENT_PROVIDER_MODE must be payfast in production.');
  }

  if (provider === 'payfast') {
    if (!client.payfastMerchantId || !client.payfastMerchantKey) errors.push('PayFast merchant credentials are required.');
    if (!server.payfastPassphrase) errors.push('PAYFAST_PASSPHRASE is required.');
  }

  const shippingEnabled = process.env.ENABLE_SHIPPING === 'true' || process.env.VITE_ENABLE_SHIPPING === 'true';
  if (shippingEnabled && !server.shippingWebhookSecret) {
    errors.push('SHIPPING_WEBHOOK_SECRET is required when shipping is enabled.');
  }

  // Shared source of truth with server.ts: CORS_ALLOWED_ORIGINS parsing and
  // wildcard rejection live in src/config/cors.ts.
  const { origins } = validateCorsAllowlistForProduction(process.env.CORS_ALLOWED_ORIGINS);
  if (origins.length === 0 || origins.includes('*')) {
    errors.push('CORS_ALLOWED_ORIGINS must contain explicit origins in production.');
  } else {
    for (const origin of origins) {
      try {
        const parsed = new URL(origin);
        if (!['http:', 'https:'].includes(parsed.protocol)) errors.push(`Invalid CORS origin: ${origin}`);
      } catch {
        errors.push(`Invalid CORS origin: ${origin}`);
      }
    }

    const adminOrigin = server.adminOrigin;
    const customerOrigin = server.customerOrigin;
    for (const [name, origin] of [['ADMIN_ORIGIN', adminOrigin], ['CUSTOMER_ORIGIN', customerOrigin]] as const) {
      try {
        const parsed = new URL(origin);
        if (parsed.protocol !== 'https:' || parsed.pathname !== '/' || parsed.search || parsed.hash) {
          errors.push(`${name} must be an HTTPS origin without a path, query, or hash.`);
        }
      } catch {
        errors.push(`${name} must be a valid HTTPS origin.`);
      }
    }
    if (adminOrigin === customerOrigin) {
      errors.push('ADMIN_ORIGIN and CUSTOMER_ORIGIN must be different origins.');
    }
    if (!origins.includes(adminOrigin) || !origins.includes(customerOrigin)) {
      errors.push('CORS_ALLOWED_ORIGINS must include both ADMIN_ORIGIN and CUSTOMER_ORIGIN.');
    }
  }

  return { valid: errors.length === 0, errors };
}

export function isPaymentConfigured(): boolean {
  const config = getEnvConfig();
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production' &&
      process.env.VITE_PAYMENT_PROVIDER_MODE !== 'payfast') {
    throw new Error('Payment configuration Error: PayFast is the only supported production payment provider.');
  }
  if (config.paymentProviderMode === 'mock') {
    const isProdBrowser = typeof import.meta !== 'undefined' && (import.meta as any).env?.PROD;
    const isProdServer = typeof process !== 'undefined' && process.env.NODE_ENV === 'production';
    if (isProdBrowser || isProdServer) {
      throw new Error('Payment configuration Error: Mock payment mode is strictly prohibited in production builds.');
    }
    return true;
  }
  if (config.paymentProviderMode === 'payfast') return !!config.payfastMerchantId && !!config.payfastMerchantKey;
  throw new Error(`Payment configuration Error: Unsupported payment provider "${config.paymentProviderMode}".`);
}

