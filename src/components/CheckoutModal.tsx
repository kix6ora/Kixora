import React, { useState } from 'react';
import { useStore, formatPrice } from '../context/StoreContext';
import { paymentService } from '../services/paymentService';
import { getEnvConfig } from '../config/env';
import { supabase } from '../lib/supabase';
import { 
  X, 
  CheckCircle2, 
  Lock, 
  ArrowRight, 
  ArrowLeft,
  AlertCircle
} from 'lucide-react';
import { motion } from 'motion/react';
import { getOptimizedImageUrl } from '../lib/cloudinary';
import { submitPayFastForm } from '../utils/payfastForm';

export const CheckoutModal: React.FC = () => {
  const { 
    cart, 
    isCheckoutOpen, 
    setIsCheckoutOpen, 
    appliedPromo, 
    placeOrder,
    setCurrentView,
    setTrackingOrder
  } = useStore();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [placedOrder, setPlacedOrder] = useState<any>(null);

  // Form State
  const [formData, setFormData] = useState({
    fullName: 'Lerato Modise',
    email: 'lerato.m@culture.co.za',
    phone: '+27 82 555 0192',
    street: '142 Sandton Drive, Suite 402',
    city: 'Johannesburg',
    state: 'Gauteng',
    zip: '2196',
    country: 'South Africa'
  });

  const [shippingMethod, setShippingMethod] = useState('Express Vault Courier (1-2 Days)');
  const [paymentMethod, setPaymentMethod] = useState('Credit / Debit Card (3D Secure)');

  if (!isCheckoutOpen) return null;

  const subtotal = cart.reduce((sum, item) => sum + item.sneaker.price * item.quantity, 0);
  const discount = appliedPromo ? (subtotal * appliedPromo.discountPercent) / 100 : 0;
  const shippingFee = subtotal >= 2000 ? 0 : 150;
  const total = subtotal - discount + shippingFee;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCompleteOrder = async () => {
    setIsSubmitting(true);
    setPaymentError(null);

    try {
      if (getEnvConfig().paymentProviderMode === 'payfast') {
        const cartFingerprint = JSON.stringify(
          cart.map(item => [item.sneaker.id, item.selectedSize, item.quantity])
        );
        const pendingKey = 'kixora_payfast_pending_order';
        let pendingOrder: { orderCode: string; guestAccessToken?: string; cartFingerprint: string } | null = null;
        const pendingValue = sessionStorage.getItem(pendingKey);
        if (pendingValue) {
          try {
            const parsed = JSON.parse(pendingValue);
            if (parsed.cartFingerprint === cartFingerprint && typeof parsed.orderCode === 'string') {
              pendingOrder = parsed;
            } else {
              sessionStorage.removeItem(pendingKey);
            }
          } catch {
            sessionStorage.removeItem(pendingKey);
          }
        }

        let orderCode = pendingOrder?.orderCode;
        let guestAccessToken = pendingOrder?.guestAccessToken;
        if (!orderCode) {
          const newOrder = await placeOrder(formData, paymentMethod, shippingMethod, undefined, true);
          orderCode = newOrder.id;
          guestAccessToken = newOrder.guestAccessToken;
          sessionStorage.setItem(pendingKey, JSON.stringify({
            orderCode,
            guestAccessToken,
            cartFingerprint,
          }));
        }
        if (guestAccessToken) {
          sessionStorage.setItem(`kixora_payfast_guest_${orderCode}`, guestAccessToken);
        }

        const csrfResponse = await fetch('/api/csrf', { credentials: 'same-origin' });
        const csrfPayload = await csrfResponse.json();
        if (!csrfResponse.ok || typeof csrfPayload.csrfToken !== 'string') {
          throw new Error('Unable to secure the PayFast checkout request.');
        }

        const { data: { session } } = await supabase.auth.getSession();
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'csrf-token': csrfPayload.csrfToken,
        };
        if (session?.access_token) {
          headers.Authorization = `Bearer ${session.access_token}`;
        }

        const initiateResponse = await fetch('/api/payments/payfast/initiate', {
          method: 'POST',
          credentials: 'same-origin',
          headers,
          body: JSON.stringify({ orderCode, guestAccessToken }),
        });
        const initiatePayload: unknown = await initiateResponse.json();
        if (!initiateResponse.ok) {
          const errorMessage = typeof initiatePayload === 'object'
            && initiatePayload !== null
            && 'error' in initiatePayload
            && typeof initiatePayload.error === 'string'
            ? initiatePayload.error
            : 'Unable to initialize PayFast checkout.';
          throw new Error(errorMessage);
        }
        if (
          typeof initiatePayload !== 'object'
          || initiatePayload === null
          || !('processUrl' in initiatePayload)
          || !('fields' in initiatePayload)
        ) {
          throw new Error('PayFast returned an invalid checkout response.');
        }

        submitPayFastForm(initiatePayload.processUrl, initiatePayload.fields);
        return;
      }

      // 1. Initialize or prepare payment intent via payment service
      const tempOrderCode = `KXO-${Math.floor(1000 + Math.random() * 9000)}`;
      const paymentIntentRes = await paymentService.initializePayment({
        amount: total,
        currency: 'ZAR',
        orderCode: tempOrderCode,
        customerEmail: formData.email,
        customerName: formData.fullName,
        metadata: {
          shippingMethod,
          paymentMethod
        }
      });

      if (!paymentIntentRes.success) {
        setPaymentError(paymentIntentRes.error || 'Payment gateway initialization failed. Please retry.');
        setIsSubmitting(false);
        return;
      }

      const intentId = paymentIntentRes.paymentIntentId || `pi_kxo_${Date.now()}`;

      // 2. Finalize atomic order placement
      const newOrder = await placeOrder(formData, paymentMethod, shippingMethod, intentId);
      if (newOrder) {
        setPlacedOrder(newOrder);
        setStep(4 as any);
      }
    } catch (err: unknown) {
      console.warn('[CheckoutModal.handleCompleteOrder] Order failed:', err);
      setPaymentError(
        err instanceof Error
          ? err.message
          : typeof err === 'string'
            ? err
            : 'Payment authorization was unsuccessful. Please retry payment.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="checkout-modal-backdrop" className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-3xl bg-[#141414] border border-[#282828] rounded-3xl overflow-hidden shadow-2xl text-[#F5F5F5] my-auto"
      >
        {/* Header */}
        <div className="p-6 border-b border-[#262626] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="font-display font-black text-xl text-white">
              <span>KI</span>
              <span className="text-[#FF7A00]">X</span>
              <span>ORA</span>
            </div>
            <span className="text-xs font-mono uppercase tracking-wider text-[#888888]">
              • Secure Vault Checkout
            </span>
          </div>

          <button
            onClick={() => setIsCheckoutOpen(false)}
            className="p-2 rounded-lg text-[#888888] hover:text-white hover:bg-[#202020] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="grid grid-cols-3 border-b border-[#262626] text-xs font-mono">
          <div className={`p-3 text-center border-r border-[#262626] flex items-center justify-center gap-2 ${step >= 1 ? 'text-[#FF7A00] font-bold bg-[#181818]' : 'text-[#666666]'}`}>
            <span>1. Shipping</span>
          </div>
          <div className={`p-3 text-center border-r border-[#262626] flex items-center justify-center gap-2 ${step >= 2 ? 'text-[#FF7A00] font-bold bg-[#181818]' : 'text-[#666666]'}`}>
            <span>2. Payment</span>
          </div>
          <div className={`p-3 text-center flex items-center justify-center gap-2 ${step >= 3 ? 'text-[#FF7A00] font-bold bg-[#181818]' : 'text-[#666666]'}`}>
            <span>3. Review</span>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="p-6 sm:p-8">
          {step === 1 && (
            <div className="space-y-6">
              <h3 className="font-display font-bold text-base text-white">Shipping Address & Contact</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-sans">
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[11px] font-mono text-[#888888] uppercase">Full Name</label>
                  <input
                    id="checkout-fullname"
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    className="w-full bg-[#1C1C1C] border border-[#2C2C2C] rounded-lg px-3.5 py-2.5 text-white focus:outline-none focus:border-[#FF7A00]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-[#888888] uppercase">Email Address</label>
                  <input
                    id="checkout-email"
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full bg-[#1C1C1C] border border-[#2C2C2C] rounded-lg px-3.5 py-2.5 text-white focus:outline-none focus:border-[#FF7A00]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-[#888888] uppercase">Phone Number</label>
                  <input
                    id="checkout-phone"
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full bg-[#1C1C1C] border border-[#2C2C2C] rounded-lg px-3.5 py-2.5 text-white focus:outline-none focus:border-[#FF7A00]"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[11px] font-mono text-[#888888] uppercase">Street Address</label>
                  <input
                    id="checkout-street"
                    type="text"
                    name="street"
                    value={formData.street}
                    onChange={handleInputChange}
                    className="w-full bg-[#1C1C1C] border border-[#2C2C2C] rounded-lg px-3.5 py-2.5 text-white focus:outline-none focus:border-[#FF7A00]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-[#888888] uppercase">City</label>
                  <input
                    id="checkout-city"
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    className="w-full bg-[#1C1C1C] border border-[#2C2C2C] rounded-lg px-3.5 py-2.5 text-white focus:outline-none focus:border-[#FF7A00]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-[#888888] uppercase">Postal Code</label>
                  <input
                    id="checkout-zip"
                    type="text"
                    name="zip"
                    value={formData.zip}
                    onChange={handleInputChange}
                    className="w-full bg-[#1C1C1C] border border-[#2C2C2C] rounded-lg px-3.5 py-2.5 text-white focus:outline-none focus:border-[#FF7A00]"
                  />
                </div>
              </div>

              {/* Shipping Delivery Tiers */}
              <div className="space-y-3 pt-2">
                <label className="text-[11px] font-mono text-[#888888] uppercase font-bold">Delivery Tier</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { id: 'Express Vault Courier (1-2 Days)', price: 'FREE', sub: 'Priority Courier with NFC tag' },
                    { id: 'Same-Day Vault Dispatch', price: 'R250.00', sub: 'Dispatched immediately by armored courier' }
                  ].map(method => (
                    <div
                      key={method.id}
                      onClick={() => setShippingMethod(method.id)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                        shippingMethod === method.id
                          ? 'bg-[#1F1F1F] border-[#FF7A00] shadow-md shadow-[#FF7A00]/20'
                          : 'bg-[#181818] border-[#2A2A2A] hover:border-[#444444]'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold text-xs">
                        <span className="text-white">{method.id}</span>
                        <span className="text-[#FF7A00] font-mono">{method.price}</span>
                      </div>
                      <p className="text-[10px] text-[#777777] mt-1">{method.sub}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <h3 className="font-display font-bold text-base text-white">2. SECURE PAYMENT METHOD</h3>

              <div className="space-y-3">
                {[
                  { id: 'PayFast Secure Checkout', desc: 'Card, wallet, and EFT checkout powered by PayFast' },
                  { id: 'PayFast Instant EFT', desc: 'Fast zero-fee bank transfer for SA customers' }
                ].map(opt => (
                  <div
                    key={opt.id}
                    onClick={() => setPaymentMethod(opt.id)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                      paymentMethod === opt.id
                        ? 'bg-[#1F1F1F] border-[#FF7A00] shadow-md shadow-[#FF7A00]/20'
                        : 'bg-[#181818] border-[#2A2A2A] hover:border-[#444444]'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-xs text-white">{opt.id}</div>
                      <div className="text-[10px] text-[#888888]">{opt.desc}</div>
                    </div>
                    {paymentMethod === opt.id && <CheckCircle2 className="w-4 h-4 text-[#FF7A00]" />}
                  </div>
                ))}
              </div>

              {/* Card Form Mockup / Gateway Status */}
              <div className="p-4 rounded-xl bg-[#1A1A1A] border border-[#282828] space-y-3 text-xs">
                <div className="flex items-center gap-2 text-xs font-bold text-[#888888] uppercase font-mono">
                  <Lock className="w-3.5 h-3.5 text-[#10B981]" />
                  <span>256-Bit Encrypted Vault Gateway</span>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-[#777777]">Card Number</label>
                  <input
                    type="text"
                    defaultValue="•••• •••• •••• 4242"
                    disabled
                    className="w-full bg-[#141414] border border-[#2A2A2A] rounded-lg px-3 py-2 text-white font-mono"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 font-mono">
                  <div>
                    <label className="text-[10px] text-[#777777]">Expiry</label>
                    <input
                      type="text"
                      defaultValue="08/29"
                      disabled
                      className="w-full bg-[#141414] border border-[#2A2A2A] rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#777777]">CVV</label>
                    <input
                      type="password"
                      defaultValue="888"
                      disabled
                      className="w-full bg-[#141414] border border-[#2A2A2A] rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <h3 className="font-display font-bold text-base text-white">3. REVIEW & AUTHORIZATION</h3>

              {paymentError && (
                <div className="p-4 bg-red-950/40 border border-red-800/60 rounded-xl flex items-start gap-3 text-xs text-red-200">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-bold">Payment Error</p>
                    <p className="text-[11px] text-red-300/90 mt-0.5">{paymentError}</p>
                  </div>
                  <button
                    onClick={() => setPaymentError(null)}
                    className="text-red-400 hover:text-red-200 p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Items List */}
              <div className="space-y-2 max-h-44 overflow-y-auto">
                {cart.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-[#1A1A1A] rounded-xl text-xs">
                    <div className="flex items-center gap-3">
                      <img 
                        src={getOptimizedImageUrl(item.sneaker.images[0] || item.sneaker.image, { width: 100, height: 100 })} 
                        alt={item.sneaker.name} 
                        referrerPolicy="no-referrer"
                        className="w-10 h-10 object-contain rounded bg-[#111111]" 
                      />
                      <div>
                        <div className="font-bold text-white truncate max-w-xs">{item.sneaker.name}</div>
                        <div className="text-[10px] text-[#888888] font-mono">Size US {item.selectedSize} × {item.quantity}</div>
                      </div>
                    </div>
                    <span className="font-mono font-bold text-white">{formatPrice(item.sneaker.price * item.quantity)}</span>
                  </div>
                ))}
              </div>

              {/* Delivery Details confirmation */}
              <div className="p-4 rounded-xl bg-[#1A1A1A] border border-[#282828] text-xs font-mono space-y-1 text-[#888888]">
                <div className="text-white font-bold mb-1">Deliver To:</div>
                <div>{formData.fullName} • {formData.phone}</div>
                <div>{formData.street}, {formData.city}, {formData.zip}</div>
                <div className="text-[#FF7A00] pt-1 font-semibold">{shippingMethod}</div>
              </div>

              {/* Totals */}
              <div className="p-4 rounded-xl bg-[#161616] border border-[#262626] space-y-1.5 text-xs font-mono">
                <div className="flex justify-between text-[#888888]">
                  <span>Subtotal</span>
                  <span className="text-white">{formatPrice(subtotal)}</span>
                </div>
                {appliedPromo && (
                  <div className="flex justify-between text-[#10B981]">
                    <span>Promo Code ({appliedPromo.code})</span>
                    <span>-{formatPrice(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-[#888888]">
                  <span>Shipping</span>
                  <span className="text-white">{shippingFee === 0 ? 'FREE' : formatPrice(shippingFee)}</span>
                </div>
                <div className="flex justify-between text-base font-bold text-white pt-2 border-t border-[#262626]">
                  <span>Total Amount</span>
                  <span className="text-[#FF7A00] font-black">{formatPrice(total)}</span>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="flex flex-col items-center justify-center p-10 space-y-6 text-center animate-in zoom-in-95 duration-500">
              <CheckCircle2 className="w-16 h-16 text-[#10B981]" />
              <div>
                <h3 className="font-display font-black text-2xl text-white">Order Confirmed & in Vault Authentication</h3>
                <p className="text-[#888888] font-mono mt-2">Tracking #: {placedOrder?.trackingNumber}</p>
              </div>
              <button
                id="checkout-track-order-btn"
                onClick={() => {
                  setTrackingOrder(placedOrder);
                  setCurrentView('tracking');
                  setIsCheckoutOpen(false);
                }}
                className="mt-4 px-8 py-3 bg-[#FF7A00] hover:bg-[#E56E00] text-black font-extrabold text-xs uppercase tracking-wider rounded-lg shadow-lg shadow-[#FF7A00]/30 transition-all hover:scale-[1.01]"
              >
                Track Your Grail
              </button>
            </div>
          )}
        </div>

        {/* Footer Navigation Buttons */}
        {step < 4 && (
          <div className="p-6 bg-[#161616] border-t border-[#262626] flex items-center justify-between">
            {step > 1 ? (
              <button
                onClick={() => {
                  setPaymentError(null);
                  setStep((step - 1) as any);
                }}
                className="px-5 py-2.5 bg-[#222222] hover:bg-[#2A2A2A] text-white font-bold text-xs uppercase tracking-wider rounded-lg flex items-center gap-2"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            ) : <div />}
            {step < 3 ? (
              <button
                id={step === 1 ? "checkout-step1-continue-btn" : "checkout-step2-continue-btn"}
                onClick={() => setStep((step + 1) as any)}
                className="px-6 py-2.5 bg-[#FF7A00] hover:bg-[#E56E00] text-black font-extrabold text-xs uppercase tracking-wider rounded-lg flex items-center gap-2 shadow-lg shadow-[#FF7A00]/25"
              >
                <span>{step === 1 ? "Continue to Payment" : "Review Order"}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                id="checkout-confirm-pay-btn"
                onClick={handleCompleteOrder}
                disabled={isSubmitting}
                className="px-8 py-3 bg-[#FF7A00] hover:bg-[#E56E00] text-black font-extrabold text-xs uppercase tracking-wider rounded-lg flex items-center gap-2 shadow-lg shadow-[#FF7A00]/30 transition-colors"
              >
                {isSubmitting ? (
                  <span>Securing Order in Vault...</span>
                ) : (
                  <>
                    <span>CONFIRM & PLACE ORDER ({formatPrice(total)})</span>
                    <CheckCircle2 className="w-4 h-4" />
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
};
