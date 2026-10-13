import React, { useState } from 'react';
import { useStore, formatPrice } from '../context/StoreContext';
import { calculateShipping, FREE_SHIPPING_THRESHOLD } from '../services/shipping/flatRate';
import { 
  X, 
  Trash2, 
  Plus, 
  Minus, 
  ArrowRight, 
  ShoppingBag, 
  Tag
} from 'lucide-react';
import { motion } from 'motion/react';
import { getOptimizedImageUrl } from '../lib/cloudinary';

export const CartDrawer: React.FC = () => {
  const { 
    cart, 
    isCartOpen, 
    setIsCartOpen, 
    setIsCheckoutOpen,
    removeFromCart, 
    updateCartQuantity,
    appliedPromo,
    applyPromoCode,
    removePromoCode
  } = useStore();

  const [promoInput, setPromoInput] = useState('');

  if (!isCartOpen) return null;

  const subtotal = cart.reduce((sum, item) => sum + item.sneaker.price * item.quantity, 0);
  const discount = appliedPromo ? (subtotal * appliedPromo.discountPercent) / 100 : 0;
  const subtotalAfterDiscount = subtotal - discount;
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const freeShippingThreshold = FREE_SHIPPING_THRESHOLD;
  const shippingFee = calculateShipping(subtotalAfterDiscount, itemCount);
  const total = subtotal - discount + shippingFee;
  const progressPercent = Math.min(100, (subtotalAfterDiscount / freeShippingThreshold) * 100);

  const handleApplyPromo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoInput.trim()) return;
    const res = applyPromoCode(promoInput);
    if (res.success) setPromoInput('');
  };

  const handleProceedCheckout = () => {
    setIsCheckoutOpen(true);
    setIsCartOpen(false);
  };

  return (
    <div id="cart-drawer-backdrop" className="fixed inset-0 z-50 overflow-hidden bg-black/80 backdrop-blur-sm">
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <motion.div
          id="cart-drawer-container"
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="w-screen max-w-md bg-[#141414] border-l border-[#282828] shadow-2xl flex flex-col justify-between text-[#F5F5F5]"
        >
          {/* Header */}
          <div className="p-6 border-b border-[#262626] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <ShoppingBag className="w-5 h-5 text-[#FF7A00]" />
              <h2 className="font-display font-black text-lg uppercase tracking-wider text-white">
                VAULT CART ({cart.reduce((s, i) => s + i.quantity, 0)})
              </h2>
            </div>

            <button
              onClick={() => setIsCartOpen(false)}
              className="p-2 rounded-lg text-[#888888] hover:text-white hover:bg-[#202020] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Free Shipping Progress Meter */}
          <div className="px-6 py-3 bg-[#1A1A1A] border-b border-[#262626] space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-[#888888]">
                {subtotalAfterDiscount > freeShippingThreshold ? (
                  <span className="text-[#10B981] font-bold">✓ Free Nationwide Shipping Unlocked!</span>
                ) : (
                  <span>Add {formatPrice(freeShippingThreshold - subtotalAfterDiscount)} for Free Shipping</span>
                )}
              </span>
              <span className="font-bold text-[#FF7A00]">{Math.round(progressPercent)}%</span>
            </div>
            <div className="w-full h-1.5 bg-[#2A2A2A] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#FF7A00] rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Cart Item List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-3 py-16">
                <div className="w-16 h-16 rounded-full bg-[#1C1C1C] flex items-center justify-center text-[#555555]">
                  <ShoppingBag className="w-8 h-8" />
                </div>
                <h3 className="font-display font-bold text-base text-white">Your Cart is Empty</h3>
                <p className="text-xs text-[#888888] max-w-xs">
                  Discover deadstock grails and rare drops in our catalog.
                </p>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="mt-2 px-6 py-2.5 bg-[#FF7A00] text-black font-extrabold text-xs uppercase tracking-wider rounded-lg"
                >
                  Shop Now
                </button>
              </div>
            ) : (
              cart.map(item => (
                <div
                  key={item.id}
                  className="p-4 rounded-xl bg-[#1A1A1A] border border-[#282828] flex gap-3 items-center"
                >
                  <img
                    src={getOptimizedImageUrl(item.sneaker.images[0] || item.sneaker.image, { width: 140, height: 140 })}
                    alt={item.sneaker.name}
                    referrerPolicy="no-referrer"
                    className="w-16 h-16 object-contain bg-[#121212] rounded-lg p-1 shrink-0"
                  />

                  <div className="flex-1 min-w-0">
                    <h4 className="font-display font-bold text-xs text-white truncate">
                      {item.sneaker.name}
                    </h4>
                    <div className="flex items-center gap-2 text-[10px] font-mono text-[#888888] mt-0.5">
                      <span>Size: US {item.selectedSize}</span>
                    </div>
                    <div className="font-mono text-xs font-bold text-white mt-1">
                      {formatPrice(item.sneaker.price)}
                    </div>
                  </div>

                  {/* Quantity Controls */}
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-1 bg-[#121212] border border-[#2E2E2E] rounded-md p-0.5">
                      <button
                        id="cart-item-dec-btn"
                        onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                        className="p-1 text-[#888888] hover:text-white"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span id="cart-item-qty-count" className="w-5 text-center font-mono text-xs font-bold text-white">
                        {item.quantity}
                      </span>
                      <button
                        id="cart-item-inc-btn"
                        onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                        className="p-1 text-[#888888] hover:text-white"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <button
                      id="cart-item-remove-btn"
                      onClick={() => removeFromCart(item.id)}
                      className="text-[10px] text-[#888888] hover:text-[#EF4444] transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer Checkout Summary */}
          {cart.length > 0 && (
            <div className="p-6 bg-[#161616] border-t border-[#262626] space-y-4">
              {/* Promo Code Input */}
              <div>
                {appliedPromo ? (
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#10B981]/15 border border-[#10B981]/30 text-xs">
                    <div 
                      id="cart-promo-applied-feedback"
                      className="flex items-center gap-2 text-[#10B981] font-mono font-bold"
                      aria-live="polite"
                    >
                      <Tag className="w-3.5 h-3.5" />
                      <span id="promo-applied-feedback-text" className="font-bold" data-promo={appliedPromo.code}>
                        Promo code applied: {appliedPromo.code} ({appliedPromo.discountPercent}% OFF)
                      </span>
                    </div>
                    <button
                      id="cart-remove-promo-btn"
                      onClick={removePromoCode}
                      className="text-xs text-[#888888] hover:text-white"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleApplyPromo} className="flex gap-2">
                    <input
                      id="cart-promo-input"
                      type="text"
                      value={promoInput}
                      onChange={e => setPromoInput(e.target.value)}
                      placeholder="Promo code (e.g. KIX10, VAULT20)"
                      className="flex-1 bg-[#1A1A1A] text-xs text-white placeholder-[#666666] px-3 py-2 rounded-lg border border-[#2C2C2C] focus:outline-none focus:border-[#FF7A00]"
                    />
                    <button
                      id="cart-apply-promo-btn"
                      type="button"
                      onClick={handleApplyPromo}
                      className="px-4 py-2 bg-[#262626] hover:bg-[#333333] text-white font-bold text-xs rounded-lg transition-colors"
                    >
                      Apply
                    </button>
                  </form>
                )}
              </div>

              {/* Subtotals */}
              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex justify-between text-[#888888]">
                  <span>Subtotal</span>
                  <span className="text-white font-bold">{formatPrice(subtotal)}</span>
                </div>
                {appliedPromo && (
                  <div className="flex justify-between text-[#10B981]">
                    <span>Promo Discount ({appliedPromo.discountPercent}%)</span>
                    <span>-{formatPrice(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-[#888888]">
                  <span>Shipping</span>
                  <span className="text-white">
                    {shippingFee === 0 ? <span className="text-[#10B981]">FREE</span> : formatPrice(shippingFee)}
                  </span>
                </div>
                <div className="flex justify-between text-base font-bold text-white pt-2 border-t border-[#262626]">
                  <span>Total</span>
                  <span className="text-[#FF7A00] font-black">{formatPrice(total)}</span>
                </div>
              </div>

              {/* Checkout Button */}
              <button
                id="cart-proceed-checkout-btn"
                type="button"
                onClick={handleProceedCheckout}
                className="w-full py-3.5 bg-[#FF7A00] hover:bg-[#E56E00] text-black font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-[#FF7A00]/25 flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
              >
                <span>PROCEED TO SECURE CHECKOUT</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};
