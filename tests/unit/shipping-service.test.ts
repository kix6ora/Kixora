import { afterEach, describe, expect, it } from 'vitest';
import { shippingService, ShippingService } from '../../src/services/shipping/shippingService';
import { SimulatedCourierGuyDriver } from '../../src/services/shipping/carrierDrivers';
import { calculateShipping } from '../../src/services/shipping/flatRate';
import { getPaymentDriver } from '../../src/services/payments';
import type { ShippingRateRequest } from '../../src/services/shipping/carrierTypes';

function zuluDestination(): ShippingRateRequest {
  return {
    destination: {
      fullName: 'Sipho Zulu',
      street: '155 West Street',
      city: 'Sandton',
      stateOrProvince: 'Gauteng',
      postalCode: '2196',
      country: 'South Africa',
      phone: '+27 82 123 4567',
      email: 'sipho@example.com',
    },
    itemsCount: 1,
    totalValueZar: 1800,
  };
}

describe('shipping service production fallback', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('returns fallback quotes instead of throwing in production when carrier auth is unavailable', async () => {
    process.env.NODE_ENV = 'production';

    const quotes = await shippingService.calculateRates(zuluDestination());

    expect(quotes.length).toBeGreaterThan(0);
    expect(quotes.some((quote) => quote.carrierId === 'the_courier_guy')).toBe(true);
    expect(quotes.every((quote) => quote.currency === 'ZAR')).toBe(true);
  });

  it('returns a single deterministic flat-rate quote in production (ZAR, no carrier call)', async () => {
    process.env.NODE_ENV = 'production';

    // R2,001 is strictly greater than the R2,000 threshold, so shipping is free (flatRate.ts:20-22).
    const freeShipping = await shippingService.calculateRates({
      ...zuluDestination(),
      totalValueZar: 2001,
    });
    expect(freeShipping).toHaveLength(1);
    expect(freeShipping[0]).toMatchObject({
      rateId: 'prod-flat-rate-estimate',
      carrierId: 'the_courier_guy',
      currency: 'ZAR',
      rateZar: 0,
    });

    // Below the threshold the flat rate is R200 (flatRate.ts:8,23).
    const paidShipping = await shippingService.calculateRates({
      ...zuluDestination(),
      totalValueZar: 900,
    });
    expect(paidShipping).toHaveLength(1);
    expect(paidShipping[0]).toMatchObject({
      rateId: 'prod-flat-rate-estimate',
      currency: 'ZAR',
      rateZar: 200,
    });

    // Deterministic: identical requests return identical quotes.
    const repeated = await shippingService.calculateRates({
      ...zuluDestination(),
      totalValueZar: 900,
    });
    expect(repeated[0].rateZar).toBe(paidShipping[0].rateZar);
    expect(repeated[0].rateId).toBe(paidShipping[0].rateId);
  });

  it('returns driver quotes outside production without any network calls', async () => {
    process.env.NODE_ENV = 'test';

    // TheCourierGuyDriver.calculateRates is pure arithmetic (carrierDrivers.ts:30-74) — hermetic.
    const quotes = await shippingService.calculateRates({
      ...zuluDestination(),
      totalValueZar: 900,
    });

    expect(quotes.length).toBeGreaterThan(0);
    expect(quotes.every((quote) => quote.carrierId === 'the_courier_guy')).toBe(true);
    expect(quotes.every((quote) => quote.currency === 'ZAR')).toBe(true);
    expect(quotes.map((quote) => quote.rateId)).toEqual(['tcg-overnight-vault', 'tcg-eco-standard']);
  });
});

describe('flat-rate shipping boundaries (R200 flat, free when > R2000)', () => {
  it('returns 200 at 0, 1999, and exactly 2000', () => {
    expect(calculateShipping(0, 1)).toBe(200);
    expect(calculateShipping(1999, 1)).toBe(200);
    expect(calculateShipping(2000, 1)).toBe(200);
  });

  it('returns 0 at 2001', () => {
    expect(calculateShipping(2001, 1)).toBe(0);
  });

  it('returns 0 for an empty cart', () => {
    expect(calculateShipping(900, 0)).toBe(0);
    expect(calculateShipping(5000, 0)).toBe(0);
  });

  it('uses the discounted subtotal (subtotal after discount)', () => {
    // 2200 - 300 discount = 1900 -> paid
    expect(calculateShipping(2200 - 300, 2)).toBe(200);
    // 2500 - 400 discount = 2100 -> free
    expect(calculateShipping(2500 - 400, 2)).toBe(0);
    // Exactly at the boundary after discount stays paid
    expect(calculateShipping(2300 - 300, 1)).toBe(200);
  });
});

describe('simulated courier driver production guards', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalApiKey = process.env.THE_COURIER_GUY_API_KEY;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalApiKey === undefined) delete process.env.THE_COURIER_GUY_API_KEY;
    else process.env.THE_COURIER_GUY_API_KEY = originalApiKey;
  });

  it('rejects SimulatedCourierGuyDriver under NODE_ENV=production', () => {
    process.env.NODE_ENV = 'production';
    const service = new ShippingService();
    expect(() => service.registerDriver(new SimulatedCourierGuyDriver('test-key'))).toThrow(
      'SIMULATED_PROVIDER_NOT_ALLOWED_IN_PRODUCTION',
    );
  });

  it('isConfigured() is false without credentials', () => {
    delete process.env.THE_COURIER_GUY_API_KEY;
    expect(new SimulatedCourierGuyDriver().isConfigured()).toBe(false);
  });
});

describe('mock payment driver production guard', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("getPaymentDriver('mock') throws in production", () => {
    process.env.NODE_ENV = 'production';
    expect(() => getPaymentDriver('mock')).toThrow();
  });
});
