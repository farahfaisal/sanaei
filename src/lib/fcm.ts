'use client';

import { createClient } from '@/lib/supabase/client';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

declare global {
  interface Window {
    // Android WebView bridge (injected by native app)
    AndroidBridge?: {
      getFCMToken: () => string;
      requestNotificationPermission: () => void;
    };
    // iOS WebView bridge (injected by WKWebView via WKScriptMessageHandler)
    webkit?: {
      messageHandlers?: {
        fcmBridge?: {
          postMessage: (msg: object) => void;
        };
      };
    };
    // Callback invoked by native app after token is ready
    onFCMTokenReceived?: (token: string) => void;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Detect environment
// ─────────────────────────────────────────────────────────────────────────────

export function isAndroidWebView(): boolean {
  if (typeof window === 'undefined') return false;
  return !!window.AndroidBridge;
}

export function isIOSWebView(): boolean {
  if (typeof window === 'undefined') return false;
  return !!window.webkit?.messageHandlers?.fcmBridge;
}

export function isWebView(): boolean {
  return isAndroidWebView() || isIOSWebView();
}

// ─────────────────────────────────────────────────────────────────────────────
// Get FCM token via JS-Native bridge
// ─────────────────────────────────────────────────────────────────────────────

export async function getFCMTokenFromNative(): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  // Android: synchronous call
  if (isAndroidWebView()) {
    try {
      const token = window.AndroidBridge!.getFCMToken();
      return token || null;
    } catch {
      return null;
    }
  }

  // iOS: async via callback
  if (isIOSWebView()) {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(null), 5000);

      window.onFCMTokenReceived = (token: string) => {
        clearTimeout(timeout);
        window.onFCMTokenReceived = undefined;
        resolve(token || null);
      };

      try {
        window.webkit!.messageHandlers!.fcmBridge!.postMessage({ action: 'getToken' });
      } catch {
        clearTimeout(timeout);
        resolve(null);
      }
    });
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Request notification permission via native bridge
// ─────────────────────────────────────────────────────────────────────────────

export function requestNativeNotificationPermission(): void {
  if (typeof window === 'undefined') return;

  if (isAndroidWebView()) {
    try {
      window.AndroidBridge!.requestNotificationPermission();
    } catch {
      // ignore
    }
  } else if (isIOSWebView()) {
    try {
      window.webkit!.messageHandlers!.fcmBridge!.postMessage({ action: 'requestPermission' });
    } catch {
      // ignore
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Save FCM token to Supabase
// ─────────────────────────────────────────────────────────────────────────────

export async function saveFCMToken(userId: string, token: string): Promise<boolean> {
  try {
    const supabase = createClient();
    const platform = isAndroidWebView() ? 'android' : isIOSWebView() ? 'ios' : 'web';

    const { error } = await supabase.from('fcm_tokens').upsert(
      {
        user_id: userId,
        token,
        platform,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,token' }
    );

    return !error;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Remove FCM token on logout
// ─────────────────────────────────────────────────────────────────────────────

export async function removeFCMToken(userId: string): Promise<void> {
  try {
    const token = await getFCMTokenFromNative();
    if (!token) return;

    const supabase = createClient();
    await supabase
      .from('fcm_tokens')
      .delete()
      .eq('user_id', userId)
      .eq('token', token);
  } catch {
    // ignore
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main: register FCM for current user (call after login)
// ─────────────────────────────────────────────────────────────────────────────

export async function registerFCM(userId: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  // Request permission first (no-op if already granted)
  requestNativeNotificationPermission();

  // Get token from native bridge
  const token = await getFCMTokenFromNative();
  if (!token) return false;

  return saveFCMToken(userId, token);
}

// ─────────────────────────────────────────────────────────────────────────────
// Send FCM notification via Edge Function (server-side trigger)
// ─────────────────────────────────────────────────────────────────────────────

/** @deprecated Pushes are sent by the database; kept as a no-op for compatibility. */
export async function sendFCMToUser(
  _userId: string,
  _title: string,
  _body: string,
  _options?: { url?: string; orderId?: string }
): Promise<void> {
  return;
}
