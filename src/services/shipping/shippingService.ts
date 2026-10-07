import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import {
  ShippingCarrierDriver,
  CarrierProviderId,
  ShippingRateRequest,
  ShippingRateQuote,
  ShippingLabelRequest,
  ShippingLabelResult,
  CarrierTrackingResult,
} from './carrierTypes';
import { TheCourierGuyDriver } from './carrierDrivers';

/**
 * Deterministic production flat-rate estimates for shipping quotes, in ZAR (rands).
 * Change rates here only — all production quotes read from this table.
 */
const PRODUCTION_FLAT_RATE_ZAR = {
  gauteng: 150,
  westernCape: 200,
  otherProvinces: 120,
} as const;

/** Orders with a subtotal strictly above this amount (in rands) ship free. */
const PRODUCTION_FREE_SHIPPING_THRESHOLD_ZAR = 1500;

/** Normalises province input so matching is case and whitespace insensitive. */
function normaliseProvince(value?: string): string {
  return (value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Resolves the flat-rate estimate for a production quote request. */
function productionFlatRateZar(request: ShippingRateRequest): number {
  if (request.totalValueZar > PRODUCTION_FREE_SHIPPING_THRESHOLD_ZAR) {
    return 0;
  }
  const province = normaliseProvince(request.destination?.stateOrProvince);
  if (province === 'gauteng') {
    return PRODUCTION_FLAT_RATE_ZAR.gauteng;
  }
  if (province === 'western cape') {
    return PRODUCTION_FLAT_RATE_ZAR.westernCape;
  }
  // Unknown or missing province falls into "all other provinces"
  return PRODUCTION_FLAT_RATE_ZAR.otherProvinces;
}

/** Builds a single flat-rate estimate quote for production fallback pricing. */
function buildProductionFlatRateQuote(request: ShippingRateRequest): ShippingRateQuote {
  const estimatedDeliveryDays = 3;
  const estimatedDeliveryDate = new Date();
  estimatedDeliveryDate.setDate(estimatedDeliveryDate.getDate() + estimatedDeliveryDays);

  return {
    rateId: 'prod-flat-rate-estimate',
    carrierId: 'the_courier_guy',
    carrierName: 'The Courier Guy',
    serviceName: 'Flat Rate Estimate (Production Fallback)',
    estimatedDeliveryDays,
    estimatedDeliveryDate: estimatedDeliveryDate.toISOString().split('T')[0],
    rateZar: productionFlatRateZar(request),
    currency: 'ZAR',
    isInsured: false,
  };
}

export class ShippingService {
  private drivers: Map<CarrierProviderId, ShippingCarrierDriver> = new Map();
  private defaultProvider: CarrierProviderId = 'the_courier_guy';

  constructor() {
    this.registerDriver(new TheCourierGuyDriver());
  }

  registerDriver(driver: ShippingCarrierDriver) {
    this.drivers.set(driver.providerId, driver);
  }

  getDriver(providerId?: CarrierProviderId): ShippingCarrierDriver {
    const id = providerId || this.defaultProvider;
    const driver = this.drivers.get(id);
    if (!driver) {
      throw new Error(`Unsupported shipping carrier: ${id}`);
    }
    return driver;
  }

  /**
   * Calculates live and fallback shipping quotes across available couriers
   */
  async calculateRates(request: ShippingRateRequest): Promise<ShippingRateQuote[]> {
    if (process.env.NODE_ENV === 'production') {
      // Deterministic flat-rate estimate instead of a live carrier rate
      return [buildProductionFlatRateQuote(request)];
    }
    const quotes: ShippingRateQuote[] = [];

    for (const driver of this.drivers.values()) {
      try {
        const driverQuotes = await driver.calculateRates(request);
        quotes.push(...driverQuotes);
      } catch {
        // Silently handle errors when carrier integration fails
      }
    }

    return quotes;
  }

  /**
   * Generates waybill label and registers the tracking record in Supabase
   */
  async createShipmentLabel(request: ShippingLabelRequest): Promise<ShippingLabelResult> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('The Courier Guy API integration is not implemented; production labels are unavailable.');
    }
    const driver = this.getDriver(request.carrierId);
    const labelResult = await driver.generateLabel(request);

    if (labelResult.success && isSupabaseConfigured() && request.orderId) {
      try {
        // Upsert shipment record
        await supabase
          .from('shipments')
          .upsert({
            order_id: request.orderId,
            tracking_number: labelResult.trackingNumber,
            carrier: labelResult.carrier,
            waybill_id: labelResult.waybillId,
            label_url: labelResult.labelUrl,
            tracking_url: labelResult.trackingUrl,
            carrier_status: 'pending_pickup',
            dispatched_at: new Date().toISOString(),
            estimated_delivery: labelResult.estimatedDeliveryDate,
          }, { onConflict: 'order_id' });

        // Update orders table with quick-access courier tracking cache
        await supabase
          .from('orders')
          .update({
            carrier: labelResult.carrier,
            tracking_number: labelResult.trackingNumber,
            tracking_url: labelResult.trackingUrl,
            current_status: 'Processing',
          })
          .eq('id', request.orderId);

        // Add milestone to order_status_history
        await supabase
          .from('order_status_history')
          .insert({
            order_id: request.orderId,
            status: 'Processing',
            title: 'Waybill & Label Generated',
            description: `Shipment label generated with ${labelResult.carrier}. Tracking: ${labelResult.trackingNumber}`,
          });

      } catch {
        // Silently handle database errors
      }
    }

    return labelResult;
  }

  /**
   * Retrieves tracking history and status for a given tracking number
   */
  async getTracking(trackingNumber: string, carrierId?: CarrierProviderId): Promise<CarrierTrackingResult> {
    if (process.env.NODE_ENV === 'production') {
      return {
        trackingNumber,
        carrier: 'The Courier Guy',
        status: 'PENDING_PICKUP',
        internalStatus: 'Pending',
        origin: '',
        destination: '',
        events: [],
        error: 'The Courier Guy API integration is not implemented; production tracking is unavailable.',
      };
    }
    const driver = this.getDriver(carrierId);
    return driver.getTracking(trackingNumber);
  }
}

export const shippingService = new ShippingService();
