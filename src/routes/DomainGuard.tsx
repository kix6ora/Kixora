import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { getEnvConfig } from '../config/env';

export interface DomainInspectionResult {
  isAdminDomain: boolean;
  isCustomerDomain: boolean;
  hostname: string;
}

/**
 * Pure function to inspect current hostname and determine domain classification.
 */
export function inspectHostname(hostnameInput?: string, _searchParamsInput?: string, _metaEnvInput?: Record<string, any>): DomainInspectionResult {
  const hostname = (
    hostnameInput ??
    (typeof window !== 'undefined' ? window.location.hostname : 'kixora.com')
  ).toLowerCase();
  const searchParams = new URLSearchParams(
    _searchParamsInput ?? (typeof window !== 'undefined' ? window.location.search : '')
  );
  const metaEnv =
    _metaEnvInput ??
    ((typeof import.meta !== 'undefined' && (import.meta as any).env) || {});
  // Roadmap 0.3: VITE_PLAYWRIGHT_ADMIN + ?domain=admin is a test-only bypass and
  // must be dead in a production build regardless of how the flag got inlined.
  const isTestAdminRoute =
    !metaEnv.PROD &&
    metaEnv.VITE_PLAYWRIGHT_ADMIN === 'true' &&
    searchParams.get('domain') === 'admin';
  const { adminDomain } = getEnvConfig();
  let configuredAdminHostname: string;
  try {
    configuredAdminHostname = new URL(adminDomain).hostname.toLowerCase();
  } catch {
    configuredAdminHostname = 'admin.kixora.com';
  }

  const isAdmin = isTestAdminRoute || hostname === configuredAdminHostname || (
    hostname === 'admin.localhost' &&
    (typeof window === 'undefined' || window.location.protocol === 'http:')
  );

  return {
    isAdminDomain: isAdmin,
    isCustomerDomain: !isAdmin,
    hostname,
  };
}

export interface DomainGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onReturnToStore?: () => void;
}

/**
 * DomainGuard:
 * - If current view is 'admin' or path is '/admin' while on the customer domain (kixora.com),
 *   it hides the Admin UI and renders a 404 Vault Not Found.
 * - Ensures Admin Hub is strictly isolated to admin.kixora.com.
 */
export const DomainGuard: React.FC<DomainGuardProps> = ({
  children,
  fallback,
  onReturnToStore,
}) => {
  const { isAdminDomain } = inspectHostname();
  useAuth();

  // If on customer domain, Admin routes/views are strictly blocked (404/Inaccessible)
  if (!isAdminDomain) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div id="domain-guard-404" className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center bg-[#111111] text-white">
        <div className="w-16 h-16 rounded-2xl bg-[#1A1A1A] border border-[#282828] flex items-center justify-center mb-6 text-[#FF7A00]">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="font-display font-black text-3xl tracking-tight mb-2">404: Vault View Not Found</h1>
        <p className="text-xs text-[#888888] max-w-md mb-8">
          The requested administrative resource does not exist on this domain. Administrative management is restricted to authorized subdomains.
        </p>
        {onReturnToStore && (
          <button
            onClick={onReturnToStore}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#FF7A00] text-black font-extrabold text-xs rounded-xl shadow-lg hover:bg-[#FF8A1A] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Return to Kixora Storefront
          </button>
        )}
      </div>
    );
  }

  return <>{children}</>;
};

export default DomainGuard;
