import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import {
  ShippingCarrierDriver,
  CarrierProviderId,
  ShippingRateRequest,
  ShippingRateQuote,
  ShippingLabelRequest,
  ShippingLabelResult,
  CarrierTrackingResult,
  CarrierCapabilityError,
} from './carrierTypes';
import { SimulatedCourierGuyDriver } from './carrierDrivers';
import { calculateShipping } from './flatRate';
import { CARRIER_INTEGRATION_STATUS, describeCarrierMode } from './carrierCapabilities';
import { logger } from '../../../logger';

/** Resolves the flat-rate estimate for a production quote request. */
function productionFlatRateZar(request: ShippingRateRequest): number {
  return calculateShipping(request.totalValueZar, request.itemsCount);
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
    isEstimate: true,
  };
}

export class ShippingService {
  private drivers: Map<CarrierProviderId, ShippingCarrierDriver> = new Map();
  private defaultProvider: CarrierProviderId = 'the_courier_guy';

  constructor() {
    if (process.env.NODE_ENV !== 'production') {
      this.registerDriver(new SimulatedCourierGuyDriver());
    }
  }

  registerDriver(driver: ShippingCarrierDriver) {
    if (process.env.NODE_ENV === 'production' && driver.isSimulated === true) {
      throw new Error('SIMULATED_PROVIDER_NOT_ALLOWED_IN_PRODUCTION: simulated shipping carrier rejected.');
    }
    this.drivers.set(driver.providerId, driver);
  }

  getDriver(providerId?: CarrierProviderId): ShippingCarrierDriver {
    const id = providerId || this.defaultProvider;
    const driver = this.drivers.get(id);
    if (!driver) {
      throw new Error(`Unsupported shipping carrier: ${id}`);
    }
    if (process.env.NODE_ENV === 'production' && driver.isSimulated === true) {
      throw new Error('SIMULATED_PROVIDER_NOT_ALLOWED_IN_PRODUCTION: simulated shipping carrier rejected.');
    }
    return driver;
  }

  /**
   * Calculates live and fallback shipping quotes across available couriers.
   *
   * Production decision: when NODE_ENV is "production", do NOT throw and do NOT
   * reach out to the carrier. Return a single deterministic flat-rate quote in
   * ZAR (flat-rate table above). This intentionally surfaces a graceful fallback
   * rather than an outage banner / crash, so end users still get prices.
   */
  async calculateRates(request: ShippingRateRequest): Promise<ShippingRateQuote[]> {
    if (process.env.NODE_ENV === 'production') {
      // No live carrier call: return a deterministic flat-rate estimate and make
      // the degradation loud. Silent fallback pricing was a recorded risk.
      const quote = buildProductionFlatRateQuote(request);
      logger.warn('[Shipping] Flat-rate estimate used (carrier not live)', {
        carrierMode: describeCarrierMode(),
        rateZar: quote.rateZar,
        itemsCount: request.itemsCount,
        totalValueZar: request.totalValueZar,
      });
      return [quote];
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
      throw new CarrierCapabilityError(
        'CARRIER_LABEL_NOT_IMPLEMENTED',
        `The Courier Guy label API is not implemented (requires ${CARRIER_INTEGRATION_STATUS.requiresCredential} and a live integration). See docs/production-evidence/go-no-go.md.`,
      );
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
        errorCode: 'CARRIER_TRACKING_NOT_IMPLEMENTED',
      };
    }
    const driver = this.getDriver(carrierId);
    return driver.getTracking(trackingNumber);
  }
}

export const shippingService = new ShippingService();
