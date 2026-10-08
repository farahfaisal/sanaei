import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { ADMIN_HOME, ADMIN_LOGIN_PATH, isAdminRole, isProtectedAdminPath } from '@/lib/auth/admin';

function getProjectRef(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  return url.match(/https:\/\/([^.]+)\./)?.[1] ?? '';
}

function injectTokenFromHeader(request: NextRequest): void {
  const token = request.headers.get('x-sb-token');
  if (!token) return;
  const hasCookie = request.cookies.getAll().some((c) => c.name.includes('auth-token'));
  if (hasCookie) return;
  request.cookies.set(`sb-${getProjectRef()}-auth-token`, token);
}

function redirectTo(request: NextRequest, pathname: string, params: Record<string, string> = {}) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = '';
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return NextResponse.redirect(url);
}

export async function middleware(request: NextRequest) {
  injectTokenFromHeader(request);
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ── Admin dashboard: admins only ─────────────────────────────
  const { pathname, search } = request.nextUrl;
  const isAdminLogin = pathname === ADMIN_LOGIN_PATH;

  if (isProtectedAdminPath(pathname) || (isAdminLogin && user)) {
    let isAdmin = false;
    if (user) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role, is_active')
        .eq('id', user.id)
        .maybeSingle();
      isAdmin = isAdminRole(profile?.role) && profile?.is_active !== false;
    }

    if (isAdminLogin) {
      // Already an admin: skip the login form.
      if (isAdmin) return redirectTo(request, ADMIN_HOME);
    } else if (!isAdmin) {
      const params: Record<string, string> = { next: `${pathname}${search}` };
      if (user) params.reason = 'not_admin';
      return redirectTo(request, ADMIN_LOGIN_PATH, params);
    }
  }

  return supabaseResponse;
}

// Only the admin dashboard needs a server-side check. Running this on every
// page made each navigation wait for a round-trip to Supabase first; the app's
// screens check the session in the browser instead.
export const config = {
  matcher: ['/dashboard', '/dashboard/:path*'],
};
