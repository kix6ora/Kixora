import React from 'react';
import ReactDOM from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import App from './App';
import { StoreProvider } from './context/StoreContext';
import { getPublicSiteUrl } from './config/env';
import { registerServiceWorker } from './pwa/registerServiceWorker';
import { initSentry } from './lib/sentryBrowser';
import './index.css';

initSentry();
if (import.meta.env.PROD) getPublicSiteUrl();
if (import.meta.env.PROD) void registerServiceWorker();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HelmetProvider>
      <StoreProvider>
        <App />
      </StoreProvider>
    </HelmetProvider>
  </React.StrictMode>,
);
