'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

// Screens that must stay reachable while the account is incomplete.
const OPEN_PATHS = ['/register', '/phone-login-otp-verification', '/onboarding-role-selection', '/splash', '/dashboard'];

/**
 * Sends a signed-in user to "complete your account" when it is missing the
 * basics: a name, and for craftsmen a specialty. Without these a craftsman
 * never appears in the craftsmen lists.
 */
export default function ProfileCompletionGate() {
  const { user, profile, loading } = useAuth();
  const pathname = usePathname() || '/';
  const router = useRouter();
  const [craftsmanReady, setCraftsmanReady] = useState<boolean | null>(null);
  const [version, setVersion] = useState(0);

  // Right after the completion form saves, the new profile takes a moment to
  // reload: pause the check briefly so the user isn't sent back to the form.
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onSaved = () => {
      setPaused(true);
      setCraftsmanReady(null);
      setVersion((v) => v + 1);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setPaused(false), 6000);
    };
    window.addEventListener('herafi:profile-updated', onSaved);
    return () => {
      window.removeEventListener('herafi:profile-updated', onSaved);
      if (timer) clearTimeout(timer);
    };
  }, []);

  const role = profile?.role;

  useEffect(() => {
    if (!user || role !== 'craftsman') {
      setCraftsmanReady(null);
      return;
    }
    let cancelled = false;
    createClient()
      .from('craftsman_profiles')
      .select('specialty')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        // On a read error don't block the user; only a confirmed gap counts.
        setCraftsmanReady(error ? true : !!data?.specialty?.trim());
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, role, profile?.full_name, version]);

  useEffect(() => {
    if (paused || loading || !user || !profile) return;
    if (role !== 'customer' && role !== 'craftsman') return;
    if (pathname === '/' || OPEN_PATHS.some((p) => pathname.startsWith(p))) return;

    const missingName = !profile.full_name || profile.full_name.trim().length < 2;
    const missingCraft = role === 'craftsman' && craftsmanReady === false;
    if (role === 'craftsman' && craftsmanReady === null && !missingName) return; // still checking

    if (missingName || missingCraft) {
      router.replace(`/register?complete=1&role=${role}`);
    }
  }, [paused, loading, user, profile, role, craftsmanReady, pathname, router]);

  return null;
}
