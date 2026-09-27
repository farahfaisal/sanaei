'use client';

import { createClient } from '@/lib/supabase/client';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

// Convert VAPID public key from base64url to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Register service worker
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    // Wait for the service worker to be ready
    await navigator.serviceWorker.ready;
    return reg;
  } catch (err) {
    console.error('[Push] Service worker registration failed:', err);
    return null;
  }
}

// Request notification permission explicitly
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined') return 'denied';
  if (!('Notification' in window)) return 'denied';

  // Already granted or denied
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';

  try {
    // Use promise-based API with callback fallback for older browsers
    const permission = await new Promise<NotificationPermission>((resolve) => {
      const result = Notification.requestPermission((perm) => resolve(perm));
      // Modern browsers return a promise
      if (result && typeof result.then === 'function') {
        result.then(resolve).catch(() => resolve('denied'));
      }
    });
    return permission;
  } catch {
    return 'denied';
  }
}

// Subscribe to Web Push
export async function subscribeToPush(userId: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!('PushManager' in window)) {
    console.warn('[Push] PushManager not supported in this browser');
    return false;
  }
  if (!('Notification' in window)) {
    console.warn('[Push] Notifications not supported in this browser');
    return false;
  }
  if (!VAPID_PUBLIC_KEY) {
    console.warn('[Push] VAPID public key is missing');
    return false;
  }

  try {
    const permission = await requestNotificationPermission();
    if (permission !== 'granted') {
      console.warn('[Push] Notification permission not granted:', permission);
      return false;
    }

    const reg = await registerServiceWorker();
    if (!reg) {
      console.warn('[Push] Could not register service worker');
      return false;
    }

    // Check existing subscription
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    const subJson = sub.toJSON() as {
      endpoint: string;
      keys: { p256dh: string; auth: string };
    };

    if (!subJson.keys?.p256dh || !subJson.keys?.auth) {
      console.warn('[Push] Subscription keys missing');
      return false;
    }

    // Save to Supabase
    const supabase = createClient();
    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: userId,
        endpoint: subJson.endpoint,
        p256dh: subJson.keys.p256dh,
        auth: subJson.keys.auth,
      },
      { onConflict: 'user_id,endpoint' }
    );

    if (error) {
      console.error('[Push] Failed to save subscription:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[Push] subscribeToPush error:', err);
    return false;
  }
}

// Unsubscribe from Web Push
export async function unsubscribeFromPush(userId: string): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    if (!reg) return;
    let sub = await reg.pushManager.getSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      const supabase = createClient();
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', userId)
        .eq('endpoint', endpoint);
    }
  } catch {
    // ignore
  }
}

// Check if push is currently subscribed
export async function isPushSubscribed(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    if (!reg) return false;
    let sub = await reg.pushManager.getSubscription();
    return !!sub;
  } catch {
    return false;
  }
}

// Get current notification permission status
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined') return 'unsupported';
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

// Send push notification via Edge Function (server-side trigger)
export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  options?: { url?: string; orderId?: string }
): Promise<void> {
  try {
    const supabase = createClient();
    await supabase.functions.invoke('send-push-notification', {
      body: { userId, title, body, ...options },
    });
  } catch {
    // ignore
  }
}
