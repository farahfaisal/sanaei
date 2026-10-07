/**
 * Single source of truth for user roles and which routes each role may access.
 * Used by both the middleware (server) and the UI (client).
 */

export type UserRole = 'customer' | 'craftsman' | 'admin';

/** Roles a person can choose for themselves when signing up. */
export type SelfServiceRole = Exclude<UserRole, 'admin'>;

export const SELF_SERVICE_ROLES: readonly SelfServiceRole[] = ['customer', 'craftsman'] as const;

export const ROLE_LABELS: Record<UserRole, string> = {
  customer: 'زبون',
  craftsman: 'حِرَفي',
  admin: 'مدير',
};

/** Landing page for each role after login. */
export const ROLE_HOME: Record<UserRole, string> = {
  customer: '/home-screen',
  craftsman: '/wallet-earnings-dashboard',
  admin: '/home-screen',
};

export const LOGIN_PATH = '/phone-login-otp-verification';

/**
 * Routes restricted to specific roles. Any route not listed here is public.
 * Matching is by path prefix.
 */
const PROTECTED_ROUTES: ReadonlyArray<{ prefix: string; roles: readonly UserRole[] }> = [
  { prefix: '/home-screen', roles: ['customer', 'admin'] },
  { prefix: '/payment-screen', roles: ['customer', 'admin'] },
  { prefix: '/wallet-earnings-dashboard', roles: ['craftsman', 'admin'] },
];

export function getAllowedRoles(pathname: string): readonly UserRole[] | null {
  const match = PROTECTED_ROUTES.find(
    ({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
  return match ? match.roles : null;
}

export function isSelfServiceRole(value: unknown): value is SelfServiceRole {
  return typeof value === 'string' && (SELF_SERVICE_ROLES as readonly string[]).includes(value);
}

export function isUserRole(value: unknown): value is UserRole {
  return value === 'admin' || isSelfServiceRole(value);
}

/** Message shown when someone tries to sign in under the wrong account type. */
export function roleMismatchMessage(actual: UserRole): string {
  return `هذا الرقم مسجَّل كحساب «${ROLE_LABELS[actual]}». اختر «${ROLE_LABELS[actual]}» لتسجيل الدخول، أو استخدم رقمًا آخر لإنشاء حساب جديد.`;
}
