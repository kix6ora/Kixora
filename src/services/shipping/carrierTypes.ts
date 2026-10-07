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
  calculateRates(request: ShippingRateRequest): Promise<ShippingRateQuote[]>;
  generateLabel(request: ShippingLabelRequest): Promise<ShippingLabelResult>;
  getTracking(trackingNumber: string): Promise<CarrierTrackingResult>;
  parseWebhook(rawPayload: any, signature?: string): CarrierWebhookPayload | null;
}
