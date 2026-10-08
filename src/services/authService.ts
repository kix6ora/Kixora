import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { isSupabaseAuthEnabled } from '../config/features';
import {
  AuthUser,
  AuthSession,
  UserRole,
  SignUpCustomerParams,
  SignInCredentials,
} from '../types/auth';
import { extractRoleFromUser, extractRoleFromAppMetadata } from '../utils/roleUtils';
import { getPublicSiteUrl } from '../config/env';

const MOCK_STORAGE_KEY = 'kixora_auth_session';
let inMemorySession: AuthSession | null = null;
const authListeners = new Set<(session: AuthSession | null) => void>();

/**
 * D-04: the persisted mock session must never authenticate a production build.
 * Local dev and the Playwright mock mode (NODE_ENV=test / VITE_PLAYWRIGHT_ADMIN)
 * keep using localStorage as before.
 */
function isMockAuthSessionAllowed(): boolean {
  const metaEnv = (typeof import.meta !== 'undefined' && (import.meta as any)?.env) || {};
  const procEnv = (typeof process !== 'undefined' && process.env) || {};
  if (metaEnv.VITE_PLAYWRIGHT_ADMIN === 'true' || procEnv.VITE_PLAYWRIGHT_ADMIN === 'true') {
    return true;
  }
  // D-04 override: explicit production-auth enforcement always wins over the
  // test-mode early return below. Accept string 'true' as well as boolean true
  // for PROD because vi.stubEnv stores strings, and accept process.env because
  // Vite may statically inline import.meta.env under Vitest.
  const forceProductionAuth =
    metaEnv.VITE_FORCE_PRODUCTION_AUTH === 'true' ||
    procEnv.VITE_FORCE_PRODUCTION_AUTH === 'true';
  const prodFlag =
    metaEnv.PROD === true ||
    (metaEnv.PROD as unknown as string) === 'true' ||
    procEnv.PROD === 'true';
  if (forceProductionAuth || prodFlag) {
    return false;
  }
  if (metaEnv.MODE === 'test' || procEnv.NODE_ENV === 'test') {
    return true;
  }
  const isProduction = metaEnv.PROD === true || procEnv.NODE_ENV === 'production';
  return !isProduction;
}

/**
 * Removes the persisted mock session if the current build must not trust it.
 * Returns true when the mock session may still be used.
 */
function guardMockAuthStorage(): boolean {
  if (isMockAuthSessionAllowed()) return true;
  inMemorySession = null;
  try {
    localStorage.removeItem(MOCK_STORAGE_KEY);
  } catch {
    // Storage unavailable
  }
  return false;
}

function notifyAuthListeners(session: AuthSession | null) {
  authListeners.forEach(cb => {
    try {
      cb(session);
    } catch (e) {
      console.error('Error in auth listener:', e);
    }
  });
}

function sanitizeAuthError(errorMessage?: string): string {
  if (!errorMessage) return 'Authentication failed. Please try again.';
  const lower = errorMessage.toLowerCase();
  if (lower.includes('invalid login credentials') || lower.includes('invalid credentials') || lower.includes('invalid_grant')) {
    return 'Invalid email or password. Please verify your credentials.';
  }
  if (lower.includes('user already registered') || lower.includes('already exists') || lower.includes('unique constraint')) {
    return 'An account with this email address already exists. Please sign in instead.';
  }
  if (lower.includes('password') && (lower.includes('least') || lower.includes('short') || lower.includes('length'))) {
    return 'Password must be at least 6 characters long.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Please check your email to confirm your account before signing in.';
  }
  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  return errorMessage;
}

// Helper to map Supabase User to AuthUser
function mapSupabaseUserToAuthUser(sbUser: any): AuthUser {
  const role: UserRole = extractRoleFromAppMetadata(sbUser.app_metadata);
  return {
    id: sbUser.id,
    email: sbUser.email || '',
    role,
    fullName: sbUser.user_metadata?.full_name || sbUser.user_metadata?.fullName || '',
    phone: sbUser.user_metadata?.phone || '',
    appMetadata: sbUser.app_metadata || {},
    userMetadata: sbUser.user_metadata || {},
    createdAt: sbUser.created_at,
  };
}

// Helper to map Supabase Session to AuthSession
function mapSupabaseSessionToAuthSession(sbSession: any): AuthSession | null {
  if (!sbSession) return null;
  return {
    user: sbSession.user ? mapSupabaseUserToAuthUser(sbSession.user) : null,
    accessToken: sbSession.access_token || null,
    refreshToken: sbSession.refresh_token || null,
    expiresAt: sbSession.expires_at || null,
  };
}

export const authService = {
  /**
   * Signs up a standard customer.
   * Client-provided metadata CANNOT grant admin privileges.
   */
  async signUpCustomer(params: SignUpCustomerParams): Promise<{ user: AuthUser | null; session: AuthSession | null; error?: string }> {
    const { email, password, fullName, phone } = params;

    if (!email || !password) {
      return { user: null, session: null, error: 'Email and password are required.' };
    }

    if (password.length < 6) {
      return { user: null, session: null, error: 'Password must be at least 6 characters long.' };
    }

    if (isSupabaseAuthEnabled() && isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: getPublicSiteUrl(),
            data: {
              full_name: fullName,
              phone: phone || '',
              // Explicitly note: any role passed here is in user_metadata and NOT trusted by RLS or app_metadata
            },
          },
        });

        if (error) {
          console.error('[authService.signUpCustomer] Supabase signup error:', error.message);
          return { user: null, session: null, error: sanitizeAuthError(error.message) };
        }

        const authUser = data.user ? mapSupabaseUserToAuthUser(data.user) : null;
        const authSession = data.session ? mapSupabaseSessionToAuthSession(data.session) : null;
        return { user: authUser, session: authSession };
      } catch (err: any) {
        console.error('[authService.signUpCustomer] Unexpected signup error:', err);
        return { user: null, session: null, error: sanitizeAuthError(err.message) };
      }
    }

    // Mock fallback mode
    const mockUser: AuthUser = {
      id: `usr_${Date.now()}`,
      email,
      role: 'customer', // Always customer
      fullName,
      phone,
      appMetadata: { role: 'customer' },
      userMetadata: { full_name: fullName, phone },
      createdAt: new Date().toISOString(),
    };

    const mockSession: AuthSession = {
      user: mockUser,
      accessToken: `mock_jwt_${Date.now()}`,
      expiresAt: Math.floor(Date.now() / 1000) + 86400,
    };

    inMemorySession = mockSession;
    try {
      localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(mockSession));
    } catch {
      // Storage unavailable
    }

    notifyAuthListeners(mockSession);
    return { user: mockUser, session: mockSession };
  },

  /**
   * Signs in a user with email and password.
   */
  async signIn(credentials: SignInCredentials): Promise<{ user: AuthUser | null; session: AuthSession | null; error?: string }> {
    const { email, password } = credentials;

    if (!email || !password) {
      return { user: null, session: null, error: 'Email and password are required.' };
    }

    if (isSupabaseAuthEnabled() && isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          console.error('[authService.signIn] Supabase sign in error:', error.message);
          return { user: null, session: null, error: sanitizeAuthError(error.message) };
        }

        const authUser = data.user ? mapSupabaseUserToAuthUser(data.user) : null;
        const authSession = data.session ? mapSupabaseSessionToAuthSession(data.session) : null;
        return { user: authUser, session: authSession };
      } catch (err: any) {
        console.error('[authService.signIn] Unexpected sign in error:', err);
        return { user: null, session: null, error: sanitizeAuthError(err.message) };
      }
    }

    const isProduction = (typeof import.meta !== 'undefined' && (import.meta as any).env?.PROD) ||
      (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production');

    if (isProduction) {
      return { user: null, session: null, error: 'Authentication service unavailable. Please try again later.' };
    }

    // Local mock fallback: customer-only. Email content MUST NOT grant privileges.
    const role: UserRole = 'customer';

    const mockUser: AuthUser = {
      id: `user-${Date.now()}`,
      email,
      role,
      fullName: 'Kixora Collector',
      appMetadata: { role },
      userMetadata: { full_name: 'Kixora Collector' },
      createdAt: new Date().toISOString(),
    };

    const mockSession: AuthSession = {
      user: mockUser,
      accessToken: `mock_jwt_${Date.now()}`,
      expiresAt: Math.floor(Date.now() / 1000) + 86400,
    };

    inMemorySession = mockSession;
    try {
      localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(mockSession));
    } catch {
      // Storage unavailable
    }

    notifyAuthListeners(mockSession);
    return { user: mockUser, session: mockSession };
  },

  /**
   * Signs out the current user and clears session state.
   */
  async signOut(): Promise<{ error?: string }> {
    inMemorySession = null;
    if (isSupabaseAuthEnabled() && isSupabaseConfigured()) {
      try {
        const { error } = await supabase.auth.signOut();
        if (error) {
          console.error('[authService.signOut] Supabase signOut error:', error.message);
          return { error: sanitizeAuthError(error.message) };
        }
      } catch (err: any) {
        console.error('[authService.signOut] Unexpected error:', err);
        return { error: sanitizeAuthError(err.message) };
      }
    }

    try {
      localStorage.removeItem(MOCK_STORAGE_KEY);
    } catch {
      // Storage unavailable
    }

    notifyAuthListeners(null);
    return {};
  },

  /**
   * Retrieves current active session.
   */
  async getSession(): Promise<AuthSession | null> {
    if (isSupabaseAuthEnabled() && isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error || !data.session) {
          return null;
        }
        return mapSupabaseSessionToAuthSession(data.session);
      } catch (err) {
        console.error('[authService.getSession] Error:', err);
        return null;
      }
    }

    // Mock fallback — D-04: a forged localStorage session must never be
    // returned from a production build.
    if (!guardMockAuthStorage()) {
      return inMemorySession;
    }
    try {
      const stored = localStorage.getItem(MOCK_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        inMemorySession = parsed as AuthSession;
        return inMemorySession;
      }
    } catch {
      // Storage unavailable
    }

    return inMemorySession;
  },

  /**
   * Retrieves current active user.
   */
  async getCurrentUser(): Promise<AuthUser | null> {
    const session = await this.getSession();
    return session?.user || null;
  },

  /**
   * Extracts user role using strict app_metadata validation.
   */
  getUserRole(userOrSession?: AuthUser | AuthSession | null): UserRole {
    if (!userOrSession) return 'anon';
    if ('user' in userOrSession) {
      return extractRoleFromUser(userOrSession.user);
    }
    return extractRoleFromUser(userOrSession);
  },

  /**
   * Subscribes to auth state changes.
   */
  onAuthStateChange(callback: (session: AuthSession | null) => void): () => void {
    if (isSupabaseAuthEnabled() && isSupabaseConfigured()) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        callback(mapSupabaseSessionToAuthSession(session));
      });

      return () => {
        subscription.unsubscribe();
      };
    }

    // In-memory + storage listener fallback for mock mode
    authListeners.add(callback);

    const handler = (e: StorageEvent) => {
      if (e.key === MOCK_STORAGE_KEY) {
        // D-04: ignore and remove persisted sessions in production builds.
        if (!guardMockAuthStorage()) {
          callback(null);
          return;
        }
        if (e.newValue) {
          try {
            callback(JSON.parse(e.newValue));
          } catch {
            callback(null);
          }
        } else {
          callback(null);
        }
      }
    };

    window.addEventListener('storage', handler);
    return () => {
      authListeners.delete(callback);
      window.removeEventListener('storage', handler);
    };
  },

  /**
   * Refreshes the active session.
   */
  async refreshSession(): Promise<AuthSession | null> {
    if (isSupabaseAuthEnabled() && isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase.auth.refreshSession();
        if (error || !data.session) return null;
        return mapSupabaseSessionToAuthSession(data.session);
      } catch {
        return null;
      }
    }

    return this.getSession();
  },
};
