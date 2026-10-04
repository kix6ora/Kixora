import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import csurf from 'csurf';
import { webhookService } from './src/services/webhookService';
import { shippingService } from './src/services/shipping/shippingService';
import { trackingWebhookService } from './src/services/shipping/trackingWebhookService';
import { emailService } from './src/services/email/emailService';
import { getEnvConfig, getServerConfig, validateProductionEnv } from './src/config/env';
import { logger } from './logger';
import { healthCheck } from './src/lib/healthCheck';
import { getSupabaseAdmin } from './src/lib/supabaseAdmin';
import { authorizePayFastOrder, initiatePayFastCheckout } from './src/services/payments/payfastCheckout';
import { buildCspConnectSources, buildCspImageSources, buildCspWorkerSources } from './src/config/cspImageSources';
import { mountProductionStaticAssets } from './src/server/staticAssets';

/**
 * Kixora Production Server (Express + Vite)
 * Handles secure webhook ingress for PayFast and carrier tracking,
 * provides SPA routing, and integrates Vite for development.
 */
import { validateCorsAllowlistForProduction } from './src/config/cors';

async function startServer() {
  const productionEnv = validateProductionEnv();
  if (!productionEnv.valid) {
    throw new Error(`Invalid production environment:\n- ${productionEnv.errors.join('\n- ')}`);
  }

  const app = express();
  app.set('trust proxy', 1);
  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? '0.0.0.0';
  const startupConfig = getServerConfig();
  const clientConfig = getEnvConfig();
  logger.info('[Startup] Configuration validated', {
    environment: process.env.NODE_ENV || 'development',
    paymentProvider: clientConfig.paymentProviderMode,
    payfastSandbox: clientConfig.payfastSandbox,
    corsOriginCount: (process.env.CORS_ALLOWED_ORIGINS || 'https://kixora.com').split(',').filter(Boolean).length,
    payfastWebhookConfigured: Boolean(startupConfig.payfastPassphrase),
    shippingWebhookConfigured: Boolean(startupConfig.shippingWebhookSecret),
  });

  // ===========================================================================
  // REQUEST CONTEXT & LOGGING (Task 2)
  // ===========================================================================
  app.use((req, res, next) => {
    const start = Date.now();
    const requestId = req.headers['x-request-id'] as string || Math.random().toString(36).substring(2, 15);
    
    // Attach to res for access in handlers if needed
    (res as any).requestId = requestId;

    // Log request completion
    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.info(`HTTP ${req.method} ${req.url}`, {
        requestId,
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration,
        userAgent: req.headers['user-agent']
      });
    });

    next();
  });

  // ===========================================================================
  // SECURITY MIDDLEWARE & HEADERS (Task 4)
  // ===========================================================================
  const isProduction = process.env.NODE_ENV === 'production';

  // Phase A: Keep the framing policy consistent across Helmet and CSP.
  // X-Frame-Options: DENY and CSP frame-ancestors 'none' both block framing.
  // If a legitimate production iframe use case is approved later, remove
  // frameguard and use only CSP frame-ancestors with an explicit allowlist.
  const frameAncestors = ["'none'"];

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://www.google-analytics.com", "https://accounts.google.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://accounts.google.com"],
        imgSrc: buildCspImageSources(),
        connectSrc: [
          ...buildCspConnectSources(process.env.VITE_SNEAKER_MODEL_BASE_URL),
          ...(isProduction ? [] : ['ws:', 'wss:']),
        ],
        workerSrc: buildCspWorkerSources(),
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        frameSrc: ["'self'", "https://accounts.google.com"],
        frameAncestors,
        formAction: ["'self'", "https://sandbox.payfast.co.za", "https://www.payfast.co.za"],
        objectSrc: ["'none'"],
        ...(isProduction ? { upgradeInsecureRequests: [] } : { upgradeInsecureRequests: null }),
      },
    },
    frameguard: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  }));

  // Standard Security Headers
  app.use((_req, res, next) => {
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });

  // ===========================================================================
  // PHASE A: CORS allowlist (no wildcard in production)
  // -----------------------------------------------------------------------
  // Production must not use a wildcard. Cross-origin browser requests outside
  // the allowlist are blocked. Same-origin requests continue to work.
  // An explicit 403 is returned for invalid origins to make API testing
  // deterministic (browsers enforce CORS headers; non-browser clients do not).
  // -----------------------------------------------------------------------
  let corsOrigin: string | string[] = '*';

  if (isProduction) {
    // Fail closed: CORS_ALLOWED_ORIGINS is the single source of truth (same
    // name validated by src/config/env.ts). Reject wildcard in production.
    const raw = process.env.CORS_ALLOWED_ORIGINS || '';
    const { origins, errors } = validateCorsAllowlistForProduction(raw);
    if (errors.length > 0) {
      throw new Error(`${errors.join(' ')} Set CORS_ALLOWED_ORIGINS to a comma-separated list of allowed origins.`);
    }
    corsOrigin = origins;
  } else {
    // Development: allow local origins
    const localPort = process.env.PORT || '3000';
    corsOrigin = [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      `http://localhost:${localPort}`,
      `http://127.0.0.1:${localPort}`,
    ];
  }

  app.use(
    cors({
      origin: function (origin, callback) {
        // Allow requests with no origin (e.g., curl, mobile clients, server-to-server)
        if (!origin) return callback(null, true);

        if (isProduction) {
          if (corsOrigin.includes(origin)) {
            return callback(null, true);
          }
          // Deterministic 403 for invalid origins in production
          const corsError = new Error('Blocked by CORS allowlist');
          (corsError as any).status = 403;
          return callback(corsError);
        }

        // Development: allow configured origins
        if (typeof corsOrigin === 'string' ? origin === corsOrigin : corsOrigin.includes(origin)) {
          return callback(null, true);
        }
        const corsError = new Error('Blocked by CORS allowlist');
        (corsError as any).status = 403;
        return callback(corsError);
      },
      credentials: true,
      maxAge: 86400,
    })
  );

  // ===========================================================================
  // PHASE A: CSRF protection setup
  // -----------------------------------------------------------------------
  // cookie-parser must run before csurf to read the CSRF cookie.
  // A token endpoint is provided for clients to retrieve a CSRF token.
  // The protected route groups are then secured with csurf middleware.
  // -----------------------------------------------------------------------
  app.use(cookieParser());

  // CSRF token endpoint (outside protected groups)
  const csrfProtection = csurf({
    cookie: {
      key: 'csrf_secret',
      httpOnly: true,
      sameSite: 'strict',
      secure: isProduction,
    },
  });

  // Parse request bodies before CSRF validation so oversized requests return 413.
  app.use('/api/webhooks/tracking', express.raw({ type: 'application/json', limit: '10mb' }));
  app.use('/api/webhooks/payfast', express.urlencoded({
    extended: false,
    limit: '10mb',
    verify: (req, _res, buffer) => {
      (req as express.Request & { rawBody?: string }).rawBody = buffer.toString('utf-8');
    },
  }));
  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: true, limit: '10kb' }));

  app.get(['/api/csrf', '/api/csrf-token'], csrfProtection, (_req, res) => {
    res.json({ csrfToken: _req.csrfToken() });
  });

  // Apply CSRF protection to the required route groups
  app.use('/api/payments', csrfProtection);
  app.use('/api/shipping', csrfProtection);
  app.use('/api/notifications', csrfProtection);

  // ===========================================================================
  // RATE LIMITING (Task 2)
  // ===========================================================================
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' }
  });

  const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // Limit each IP to 10 auth attempts per hour
    message: { error: 'Too many login attempts, please try again in an hour.' }
  });

  const checkoutLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: { error: 'Too many checkout attempts, please contact support if you are having issues.' }
  });

  // Apply limiters
  app.use('/api/', apiLimiter);
  app.use('/api/auth/', authLimiter);

  // ===========================================================================
  // SOCIAL MEDIA CRAWLER INTERCEPTOR (Task 7)
  // ===========================================================================
  app.get('/product/:id', async (req, res, next) => {
    const userAgent = req.headers['user-agent'] || '';
    const isCrawler = /Twitterbot|facebookexternalhit|Facebot|Slackbot|Discordbot|WhatsApp|Googlebot|bingbot|Baiduspider|yacybot|yandexbot/i.test(userAgent);
    
    if (isCrawler && process.env.NODE_ENV === 'production') {
      const productId = req.params.id;
      // In a real production app, we would fetch product data from DB here.
      // For this implementation, we serve a minimal template with standard Kixora branding
      // and instructions for the crawler.
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Kixora Sneaker Vault</title>
            <meta property="og:title" content="Kixora | Sneaker Vault" />
            <meta property="og:description" content="Exclusive authenticated sneaker drops." />
            <meta property="og:image" content="https://kixora.com/og-image-default.png" />
            <meta name="twitter:card" content="summary_large_image" />
          </head>
          <body>
            <h1>Kixora</h1>
            <p>Loading sneaker details...</p>
            <script>window.location.href = "/?product=${productId}";</script>
          </body>
        </html>
      `;
      return res.send(html);
    }
    next();
  });

  app.get('/api/health', healthCheck);

  app.get('/api/ready', (_req, res) => {
    const config = validateProductionEnv();
    if (!config.valid) {
      return res.status(503).json({
        status: 'not_ready',
        checks: { configuration: false },
      });
    }

    return res.json({
      status: 'ready',
      checks: {
        configuration: true,
        paymentProvider: clientConfig.paymentProviderMode,
        payfastWebhookConfigured: Boolean(startupConfig.payfastPassphrase),
        shippingWebhookConfigured: Boolean(startupConfig.shippingWebhookSecret),
      },
    });
  });

  if (process.env.NODE_ENV === 'test') {
    app.use('/rest/v1', (_req, res) => {
      res.json([]);
    });
  }

  // ===========================================================================
  // SECURE WEBHOOK INGRESS (Production Blocker Fix)
  // ===========================================================================

  app.post('/api/payments/payfast/initiate', checkoutLimiter, async (req, res) => {
    try {
      const admin = getSupabaseAdmin();
      const result = await initiatePayFastCheckout({
        ...(req.body || {}),
        authorization: req.header('authorization'),
      }, {
        findOrder: async orderCode => {
          const { data, error } = await admin
            .from('orders')
            .select('order_code, user_id, guest_access_token, payment_status, total, customer_snapshot')
            .eq('order_code', orderCode)
            .maybeSingle();
          return { order: data, error };
        },
        getUserId: async accessToken => {
          const { data, error } = await admin.auth.getUser(accessToken);
          return error ? null : data.user?.id || null;
        },
      });

      res.status(result.status).json(result.body);
    } catch (err: unknown) {
      logger.error('[PayFast Initiation] Failed to prepare checkout', {
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      res.status(500).json({ error: 'Unable to initialize PayFast checkout.' });
    }
  });

  app.post('/api/payments/payfast/status', async (req, res) => {
    try {
      const admin = getSupabaseAdmin();
      const orderCode = typeof req.body?.orderCode === 'string' ? req.body.orderCode.trim() : '';
      if (!orderCode) {
        return res.status(400).json({ error: 'Order code is required.' });
      }

      const { data: order, error } = await admin
        .from('orders')
        .select('order_code, user_id, guest_access_token, payment_status, current_status, total, customer_snapshot')
        .eq('order_code', orderCode)
        .maybeSingle();
      if (error) {
        return res.status(500).json({ error: 'Unable to load order status.' });
      }
      if (!order) {
        return res.status(404).json({ error: 'Order not found.' });
      }

      const authorization = req.header('authorization') || '';
      const bearerMatch = authorization.match(/^Bearer\s+([^\s]+)$/i);
      const authorized = await authorizePayFastOrder(
        order,
        {
          bearerToken: bearerMatch?.[1],
          guestAccessToken: typeof req.body?.guestAccessToken === 'string'
            ? req.body.guestAccessToken
            : undefined,
        },
        async accessToken => {
          const { data, error: authError } = await admin.auth.getUser(accessToken);
          return authError ? null : data.user?.id || null;
        }
      );
      if (!authorized) {
        return res.status(403).json({ error: 'Not authorized to view this order.' });
      }

      res.json({
        orderCode: order.order_code,
        paymentStatus: order.payment_status,
        currentStatus: order.current_status,
        total: order.total,
      });
    } catch (err: unknown) {
      logger.error('[PayFast Order Status] Failed to load status', {
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      res.status(500).json({ error: 'Unable to load order status.' });
    }
  });

  /**
   * POST /api/webhooks/payfast
   * PayFast ITN Verification & Reconciliation
   */
  app.post('/api/webhooks/payfast', async (req, res) => {
    const { payfastPassphrase } = getServerConfig();
    const { payfastSandbox } = getEnvConfig();
    const payload = req.body;
    const rawBody = (req as express.Request & { rawBody?: string }).rawBody;

    try {
      logger.info('[PayFast Webhook] Received ITN fields', {
        fieldNames: Object.keys(payload || {}),
      });
      if (!payfastPassphrase) {
        logger.error('[PayFast Webhook] PAYFAST_PASSPHRASE is not configured');
        return res.status(503).send('Webhook verification is unavailable');
      }
      if (!rawBody) {
        logger.warn('[PayFast Webhook] Missing raw ITN body');
        return res.status(400).send('Verification failed');
      }

      const validationUrl = payfastSandbox
        ? 'https://sandbox.payfast.co.za/eng/query/validate'
        : 'https://www.payfast.co.za/eng/query/validate';
      const validationResponse = await fetch(validationUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: rawBody,
        signal: AbortSignal.timeout(10000),
      });
      const validationResult = (await validationResponse.text()).trim();
      if (!validationResponse.ok || validationResult !== 'VALID') {
        logger.warn('[PayFast Webhook] PayFast postback validation rejected ITN', {
          responseStatus: validationResponse.status,
        });
        return res.status(400).send('Verification failed');
      }

      const result = await webhookService.verifyAndProcessPayFastWebhook(
        payload,
        payload.signature,
        payfastPassphrase
      );

      if (result.success) {
        logger.info(`[PayFast Webhook] Successfully processed: ${result.event}`, {
          orderCode: result.orderCode,
          event: result.event
        });
        res.status(200).send('OK');
      } else {
        logger.warn(`[PayFast Webhook] Verification failed`, { error: result.error });
        res.status(400).send('Verification failed');
      }
    } catch (err: any) {
      logger.error('[PayFast Webhook] Exception', { error: err.message });
      res.status(500).send('Internal server error');
    }
  });

  // ===========================================================================
  // CARRIER TRACKING WEBHOOK & SHIPPING INTEGRATIONS (Phase 9)
  // ===========================================================================

  /**
   * POST /api/webhooks/tracking
   * Carrier Tracking Milestone Webhook Ingress (Signature-Verified, Replay-Protected & Idempotent)
   */
  app.post('/api/webhooks/tracking', async (req, res) => {
    try {
      const rawBody = Buffer.isBuffer(req.body)
        ? req.body.toString('utf-8')
        : (typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}));

      const signatureHeader = (req.headers['x-kixora-signature'] ||
        req.headers['x-shipping-signature'] ||
        req.headers['x-tcg-signature'] ||
        req.headers['signature']) as string | undefined;

      const timestampHeader = (req.headers['x-kixora-timestamp'] ||
        req.headers['x-webhook-timestamp'] ||
        req.headers['x-timestamp']) as string | undefined;

      logger.info('[Tracking Webhook] Inbound carrier event received', {
        hasSignature: !!signatureHeader,
        hasTimestamp: !!timestampHeader,
      });

      const result = await trackingWebhookService.verifyAndProcessTrackingWebhook({
        rawBody,
        signatureHeader,
        timestampHeader,
      });

      if (!result.success) {
        logger.warn('[Tracking Webhook] Verification or processing rejected', { error: result.error });
        return res.status(401).json({ error: result.error || 'Webhook verification failed' });
      }

      res.status(200).json(result);
    } catch (err: any) {
      logger.error('[Tracking Webhook] Exception', { error: err.message });
      res.status(500).json({ error: 'Failed to process tracking webhook' });
    }
  });

  /**
   * POST /api/shipping/rates
   * Real-time Multi-Carrier Shipping Rate Calculation
   */
  app.post('/api/shipping/rates', csrfProtection, async (req, res) => {
    try {
      const quotes = await shippingService.calculateRates(req.body);
      res.json({ success: true, quotes });
    } catch (err: any) {
      logger.error('[Shipping Rates API] Exception', { error: err.message });
      res.status(500).json({ error: 'Failed to calculate shipping rates' });
    }
  });

  /**
   * POST /api/shipping/labels
   * Admin / Automation Carrier Waybill Label Generation
   */
  app.post('/api/shipping/labels', csrfProtection, async (req, res) => {
    try {
      const label = await shippingService.createShipmentLabel(req.body);
      res.json(label);
    } catch (err: any) {
      logger.error('[Shipping Labels API] Exception', { error: err.message });
      res.status(500).json({ error: 'Failed to generate shipping label' });
    }
  });

  /**
   * POST /api/notifications/email/order-confirmation
   * Transactional Order Confirmation Dispatch
   */
  app.post('/api/notifications/email/order-confirmation', csrfProtection, async (req, res) => {
    try {
      const result = await emailService.sendOrderConfirmation(req.body);
      res.json(result);
    } catch (err: any) {
      logger.error('[Email Notification API] Exception', { error: err.message });
      res.status(500).json({ error: 'Failed to send confirmation email' });
    }
  });

  // Global Error Handler for API & Payload errors
  app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err) {
      if (err.code === 'EBADCSRFTOKEN') {
        return res.status(403).json({ error: 'Invalid CSRF token' });
      }
      if (err.type === 'entity.too.large' || err.status === 413 || err.name === 'PayloadTooLargeError') {
        logger.warn('[Express] PayloadTooLargeError intercepted', { message: err.message });
        return res.status(413).json({ error: 'Payload too large' });
      }
      if (err.message === 'Blocked by CORS allowlist') {
        return res.status(403).json({ error: 'Blocked by CORS allowlist' });
      }
      logger.error('[Express Server Error]', { message: err.message, stack: err.stack });
      return res.status(err.status || 500).json({ error: 'Internal server error' });
    }
    next();
  });

  // ===========================================================================
  // VITE & STATIC SERVING
  // ===========================================================================

  if (process.env.NODE_ENV !== 'production') {
    // Vite middleware for development
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.NODE_ENV === 'test' ? false : undefined,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('Vite development middleware mounted.');
  } else {
    // Static file serving for production
    const distPath = path.join(process.cwd(), 'dist');
    mountProductionStaticAssets(app, distPath);
    console.log('Production static assets and SPA fallback enabled.');
  }

  app.listen(port, host, () => {
    console.log(`Server listening on http://${host}:${port}`);
  });
}

  startServer().catch((err) => {
  logger.error('Failed to start server', { error: err.message });
  process.exit(1);
});
