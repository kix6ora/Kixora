export async function registerServiceWorker(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') return;
  if (!('serviceWorker' in navigator)) return;

  const registration = await navigator.serviceWorker.register('/sw.js');
  if (registration.waiting) {
    registration.waiting.postMessage('SKIP_WAITING');
  }
}
