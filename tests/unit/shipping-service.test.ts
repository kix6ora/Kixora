import { afterEach, describe, expect, it } from 'vitest';
import { shippingService } from '../../src/services/shipping/shippingService';

describe('shipping service production fallback', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('returns fallback quotes instead of throwing in production when carrier auth is unavailable', async () => {
    process.env.NODE_ENV = 'production';

    const quotes = await shippingService.calculateRates({
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
    });

    expect(quotes.length).toBeGreaterThan(0);
    expect(quotes.some((quote) => quote.carrierId === 'the_courier_guy')).toBe(true);
    expect(quotes.every((quote) => quote.currency === 'ZAR')).toBe(true);
  });
});
