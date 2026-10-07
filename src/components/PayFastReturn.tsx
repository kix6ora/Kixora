import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Clock, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useStore } from '../context/StoreContext';

type ReturnStatus = 'waiting' | 'paid' | 'timeout' | 'error';

function replaceReturnQuery(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete('order');
  url.searchParams.delete('cancel');
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

export const PayFastReturn: React.FC = () => {
  const { clearCart, removePromoCode, setIsCheckoutOpen } = useStore();
  const cartActions = useRef({ clearCart, removePromoCode });
  const [orderCode, setOrderCode] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    return params.get('cancel') === 'true' ? null : params.get('order');
  });
  const [status, setStatus] = useState<ReturnStatus>('waiting');
  const [errorMessage, setErrorMessage] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    cartActions.current = { clearCart, removePromoCode };
  }, [clearCart, removePromoCode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('cancel') === 'true') {
      replaceReturnQuery();
      setOrderCode(null);
      setIsCheckoutOpen(true);
    }
  }, [setIsCheckoutOpen]);

  useEffect(() => {
    if (!orderCode) return;
    let active = true;

    const pollOrder = async () => {
      try {
        const guestToken = sessionStorage.getItem(`kixora_payfast_guest_${orderCode}`);
        const { data: { session } } = await supabase.auth.getSession();
        if (!guestToken && !session?.access_token) {
          if (active) {
            setStatus('error');
            setErrorMessage('This order cannot be verified in the current browser session.');
          }
          return;
        }

        const csrfResponse = await fetch('/api/csrf', { credentials: 'same-origin' });
        const csrfPayload = await csrfResponse.json();
        if (!csrfResponse.ok || typeof csrfPayload.csrfToken !== 'string') {
          throw new Error('Unable to secure the order status request.');
        }

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'csrf-token': csrfPayload.csrfToken,
        };
        if (session?.access_token) {
          headers.Authorization = `Bearer ${session.access_token}`;
        }

        const startedAt = Date.now();
        while (active && Date.now() - startedAt < 120000) {
          const response = await fetch('/api/payments/payfast/status', {
            method: 'POST',
            credentials: 'same-origin',
            headers,
            body: JSON.stringify({ orderCode, guestAccessToken: guestToken }),
          });

          if (response.ok) {
            const order = await response.json();
            if (order.paymentStatus === 'paid') {
              if (active) {
                setStatus('paid');
                if (session?.access_token) {
                  sessionStorage.setItem('kixora_payfast_cart_cleared', 'true');
                }
                cartActions.current.clearCart();
                cartActions.current.removePromoCode();
                sessionStorage.removeItem(`kixora_payfast_guest_${orderCode}`);
                const pending = sessionStorage.getItem('kixora_payfast_pending_order');
                if (pending) {
                  try {
                    if (JSON.parse(pending).orderCode === orderCode) {
                      sessionStorage.removeItem('kixora_payfast_pending_order');
                    }
                  } catch {
                    sessionStorage.removeItem('kixora_payfast_pending_order');
                  }
                }
                replaceReturnQuery();
              }
              return;
            }
          } else if (response.status === 403 || response.status === 404) {
            const body = await response.json();
            throw new Error(body.error || 'Unable to verify this order.');
          }

          await new Promise(resolve => window.setTimeout(resolve, 2000));
        }

        if (active) setStatus('timeout');
      } catch (error) {
        if (active) {
          setStatus('error');
          setErrorMessage(error instanceof Error ? error.message : 'Unable to verify this order.');
        }
      }
    };

    setStatus('waiting');
    setErrorMessage('');
    void pollOrder();
    return () => {
      active = false;
    };
  }, [orderCode, retry]);

  if (!orderCode) return null;

  const isPaid = status === 'paid';
  const heading = isPaid
    ? 'Payment Confirmed'
    : status === 'timeout'
      ? 'Payment Is Still Processing'
      : status === 'error'
        ? 'Unable to Verify Payment'
        : 'Confirming Your Payment';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4">
      <section
        role="status"
        aria-live="polite"
        className="w-full max-w-lg space-y-5 rounded-3xl border border-[#282828] bg-[#141414] p-8 text-center text-white shadow-2xl"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1F1F1F] text-[#FF7A00]">
          {isPaid ? <CheckCircle2 className="h-7 w-7" /> : <Clock className="h-7 w-7" />}
        </div>
        <div>
          <h1 className="font-display text-2xl font-black">{heading}</h1>
          <p className="mt-2 text-sm text-[#AAAAAA]">
            Order <span className="font-mono text-white">{orderCode}</span>
          </p>
          <p className="mt-2 text-sm text-[#888888]">
            {isPaid
              ? 'Your payment has been verified and your order is confirmed.'
              : status === 'timeout'
                ? 'We have not received confirmation yet. You can check again or return to the store.'
                : status === 'error'
                  ? errorMessage
                  : 'We are waiting for PayFast to confirm your payment.'}
          </p>
        </div>
        {status === 'timeout' && (
          <button
            onClick={() => setRetry(value => value + 1)}
            className="rounded-xl bg-[#FF7A00] px-6 py-3 text-xs font-extrabold uppercase text-black"
          >
            Check Again
          </button>
        )}
        {status !== 'waiting' && (
          <button
            aria-label="Close payment confirmation"
            onClick={() => {
              replaceReturnQuery();
              setOrderCode(null);
            }}
            className="absolute right-6 top-6 rounded-lg p-2 text-[#888888] hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </section>
    </div>
  );
};
