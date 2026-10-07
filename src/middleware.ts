import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getAllowedRoles, isUserRole, LOGIN_PATH, ROLE_HOME, type UserRole } from '@/lib/auth/roles';

function getProjectRef(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  return url.match(/https:\/\/([^.]+)\./)?.[1] ?? '';
}

/** Supports environments where auth cookies can't be set (token sent as a header instead). */
function injectTokenFromHeader(request: NextRequest): void {
  const token = request.headers.get('x-sb-token');
  if (!token) return;
  const hasCookie = request.cookies.getAll().some((c) => c.name.includes('auth-token'));
  if (hasCookie) return;
  request.cookies.set(`sb-${getProjectRef()}-auth-token`, token);
}

function redirectTo(request: NextRequest, pathname: string, params?: Record<string, string>) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = '';
  Object.entries(params ?? {}).forEach(([key, value]) => url.searchParams.set(key, value));
  return NextResponse.redirect(url);
}

export async function middleware(request: NextRequest) {
  injectTokenFromHeader(request);
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const allowedRoles = getAllowedRoles(pathname);
  const isLoginPage = pathname === LOGIN_PATH;

  // Public page and nobody signed in: nothing to check.
  if (!allowedRoles && !(isLoginPage && user)) return response;

  if (!user) {
    // Protected page: send to login, pre-selecting the role this page belongs to.
    const role = allowedRoles?.find((r) => r !== 'admin');
    return redirectTo(request, LOGIN_PATH, role ? { role, next: pathname } : { next: pathname });
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const rawRole: unknown = profile?.role;
  const role: UserRole | null = isUserRole(rawRole) ? rawRole : null;

  // Signed in but no valid profile: let the login page handle it.
  if (!role) {
    return isLoginPage ? response : redirectTo(request, LOGIN_PATH);
  }

  // Already signed in: skip the login page.
  if (isLoginPage) return redirectTo(request, ROLE_HOME[role]);

  // Wrong account type for this page: go to this account's own home.
  if (allowedRoles && !allowedRoles.includes(role)) {
    return redirectTo(request, ROLE_HOME[role]);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
