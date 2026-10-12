import { afterEach, describe, expect, it } from 'vitest';
import { shippingService } from '../../src/services/shipping/shippingService';
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

    // R1,800 exceeds the R1,500 free-shipping threshold (shippingService.ts:24,33-35).
    const freeShipping = await shippingService.calculateRates(zuluDestination());
    expect(freeShipping).toHaveLength(1);
    expect(freeShipping[0]).toMatchObject({
      rateId: 'prod-flat-rate-estimate',
      carrierId: 'the_courier_guy',
      currency: 'ZAR',
      rateZar: 0,
    });

    // Below the threshold the Gauteng flat rate is R150 (shippingService.ts:17-21,37-38).
    const paidShipping = await shippingService.calculateRates({
      ...zuluDestination(),
      totalValueZar: 900,
    });
    expect(paidShipping).toHaveLength(1);
    expect(paidShipping[0]).toMatchObject({
      rateId: 'prod-flat-rate-estimate',
      currency: 'ZAR',
      rateZar: 150,
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
