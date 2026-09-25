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
    return reg;
  } catch {
    return null;
  }
}

// Subscribe to Web Push
export async function subscribeToPush(userId: string): Promise<boolean> {
  if (typeof window === 'undefined' || !('PushManager' in window)) return false;
  if (!VAPID_PUBLIC_KEY) return false;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    const reg = await registerServiceWorker();
    if (!reg) return false;

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

    // Save to Supabase
    const supabase = createClient();
    await supabase.from('push_subscriptions').upsert(
      {
        user_id: userId,
        endpoint: subJson.endpoint,
        p256dh: subJson.keys.p256dh,
        auth: subJson.keys.auth,
      },
      { onConflict: 'user_id,endpoint' }
    );

    return true;
  } catch {
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
