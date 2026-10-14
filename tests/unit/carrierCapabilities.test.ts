import { describe, expect, it } from 'vitest';
import {
  CARRIER_INTEGRATION_STATUS,
  describeCarrierMode,
} from '../../src/services/shipping/carrierCapabilities';

describe('carrier integration status', () => {
  it('records the go/no-go deferral for every carrier capability', () => {
    expect(CARRIER_INTEGRATION_STATUS.provider).toBe('the_courier_guy');
    expect(CARRIER_INTEGRATION_STATUS.rates).toBe('flat_rate_fallback');
    expect(CARRIER_INTEGRATION_STATUS.labels).toBe('not_implemented');
    expect(CARRIER_INTEGRATION_STATUS.tracking).toBe('not_implemented');
    expect(CARRIER_INTEGRATION_STATUS.deferred).toBe(true);
    expect(CARRIER_INTEGRATION_STATUS.requiresCredential).toBe('THE_COURIER_GUY_API_KEY');
  });

  it('summarises the mode for /api/ready', () => {
    expect(describeCarrierMode()).toBe(
      'rates=flat_rate_fallback,labels=not_implemented,tracking=not_implemented',
    );
  });
});
