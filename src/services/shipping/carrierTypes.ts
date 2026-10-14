/**
 * Kixora Carrier Shipping & Tracking Types
 */

export type CarrierProviderId = 'the_courier_guy';

export type CarrierMilestone = 
  | 'PENDING_PICKUP'
  | 'COLLECTED'
  | 'IN_TRANSIT_HUB'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'EXCEPTION'
  | 'RETURNED_TO_SENDER';

export interface ShippingAddress {
  fullName: string;
  street: string;
  suburb?: string;
  city: string;
  stateOrProvince: string;
  postalCode: string;
  country: string;
  phone: string;
  email: string;
}

export interface ParcelDimensions {
  weightKg: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
}

export interface ShippingRateRequest {
  destination: ShippingAddress;
  origin?: Partial<ShippingAddress>;
  itemsCount: number;
  totalValueZar: number;
  parcels?: ParcelDimensions[];
  serviceType?: 'standard' | 'express' | 'same_day_vault';
}

export interface ShippingRateQuote {
  rateId: string;
  carrierId: CarrierProviderId;
  carrierName: string;
  serviceName: string;
  estimatedDeliveryDays: number;
  estimatedDeliveryDate: string;
  rateZar: number;
  currency: 'ZAR';
  isInsured: boolean;
  /**
   * True when this rate is a deterministic estimate rather than a live carrier
   * quote (production flat-rate fallback). Callers must surface this to the user.
   */
  isEstimate?: boolean;
}

export type CarrierErrorCode =
  | 'CARRIER_NOT_CONFIGURED'
  | 'CARRIER_LABEL_NOT_IMPLEMENTED'
  | 'CARRIER_TRACKING_NOT_IMPLEMENTED';

/** Thrown when a carrier capability is unavailable; carries a machine-readable code. */
export class CarrierCapabilityError extends Error {
  readonly code: CarrierErrorCode;

  constructor(code: CarrierErrorCode, message: string) {
    super(message);
    this.name = 'CarrierCapabilityError';
    this.code = code;
  }
}

export interface ShippingLabelRequest {
  orderId: string;
  orderCode: string;
  recipient: ShippingAddress;
  rateId?: string;
  carrierId?: CarrierProviderId;
  serviceName?: string;
  itemsSummary: {
    sku: string;
    name: string;
    sizeUs: number;
    quantity: number;
    valueZar: number;
  }[];
  insuranceRequired?: boolean;
}

export interface ShippingLabelResult {
  success: boolean;
  waybillId: string;
  trackingNumber: string;
  carrier: string;
  carrierId: CarrierProviderId;
  labelUrl: string;
  trackingUrl: string;
  estimatedDeliveryDate: string;
  barcodeDataUri?: string;
  error?: string;
}

export interface CarrierTrackingScan {
  timestamp: string;
  status: CarrierMilestone;
  location: string;
  description: string;
  signatureName?: string;
}

export interface CarrierTrackingResult {
  trackingNumber: string;
  carrier: string;
  status: CarrierMilestone;
  internalStatus: 'Pending' | 'Authenticated' | 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled';
  estimatedDelivery?: string;
  deliveredAt?: string;
  origin: string;
  destination: string;
  events: CarrierTrackingScan[];
  /**
   * Set when the carrier integration is unavailable and the service fails closed,
   * so callers can surface a degraded-tracking reason instead of real milestones.
   */
  error?: string;
  /** Machine-readable reason matching `error`. */
  errorCode?: CarrierErrorCode;
  rawPayload?: any;
}

export interface CarrierWebhookPayload {
  eventId: string;
  carrier: string;
  trackingNumber: string;
  waybillId?: string;
  orderCode?: string;
  status: string;
  location?: string;
  timestamp: string;
  description?: string;
  signature?: string;
  metadata?: Record<string, any>;
}

export interface ShippingCarrierDriver {
  providerId: CarrierProviderId;
  providerName: string;
  readonly isSimulated: boolean;
  isConfigured(): boolean;
  calculateRates(request: ShippingRateRequest): Promise<ShippingRateQuote[]>;
  generateLabel(request: ShippingLabelRequest): Promise<ShippingLabelResult>;
  getTracking(trackingNumber: string): Promise<CarrierTrackingResult>;
  parseWebhook(rawPayload: any, signature?: string): CarrierWebhookPayload | null;
}
