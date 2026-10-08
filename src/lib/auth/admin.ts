/** Shared rules for the admin dashboard (used by the middleware and the UI). */

export const ADMIN_HOME = '/dashboard';
export const ADMIN_LOGIN_PATH = '/dashboard/login';

export function isAdminRole(role: unknown): boolean {
  return role === 'admin';
}

/** Every dashboard page except the login page itself needs an admin. */
export function isProtectedAdminPath(pathname: string): boolean {
  if (pathname === ADMIN_LOGIN_PATH || pathname.startsWith(`${ADMIN_LOGIN_PATH}/`)) return false;
  return pathname === ADMIN_HOME || pathname.startsWith(`${ADMIN_HOME}/`);
}

/** Only follow `next` when it points back into the dashboard (never to another site). */
export function safeAdminRedirect(next: string | null | undefined): string {
  if (next && next.startsWith(`${ADMIN_HOME}`) && !next.startsWith('//') && isProtectedAdminPath(next.split('?')[0])) {
    return next;
  }
  return ADMIN_HOME;
}
