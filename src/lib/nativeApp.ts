'use client';

/**
 * Bridge to the حِرَفي Android / iOS app (Capacitor).
 *
 * The app opens the published site, and Capacitor injects `window.Capacitor`
 * into it. Native plugins are reached through that object, so the website
 * needs no extra packages and keeps working unchanged in a normal browser.
 *
 * Push inside the app always goes through Firebase Cloud Messaging: the
 * operating system shows the notification even when the app is closed, and
 * tapping it opens the right screen.
 */

import { createClient } from '@/lib/supabase/client';

export type NativePlatform = 'android' | 'ios' | 'web';

/** Must match the channel id the push function sends to. */
export const NOTIFICATION_CHANNEL_ID = 'sanaei_notifications';

type Listener = { remove: () => Promise<void> };

interface FirebaseMessagingPlugin {
  checkPermissions(): Promise<{ receive: string }>;
  requestPermissions(): Promise<{ receive: string }>;
  getToken(): Promise<{ token: string }>;
  deleteToken(): Promise<void>;
  createChannel(options: Record<string, unknown>): Promise<void>;
  removeAllDeliveredNotifications?(): Promise<void>;
  addListener(event: 'tokenReceived', cb: (e: { token: string }) => void): Promise<Listener>;
  addListener(event: 'notificationReceived', cb: (e: { notification: NativeNotification }) => void): Promise<Listener>;
  addListener(
    event: 'notificationActionPerformed',
    cb: (e: { actionId: string; notification: NativeNotification }) => void
  ): Promise<Listener>;
}

interface NativeNotification {
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
}

interface AppPlugin {
  addListener(event: 'backButton', cb: (e: { canGoBack: boolean }) => void): Promise<Listener>;
  addListener(event: 'resume', cb: () => void): Promise<Listener>;
  minimizeApp?(): Promise<void>;
  exitApp(): Promise<void>;
}

function capacitor(): any {
  if (typeof window === 'undefined') return null;
  return (window as any).Capacitor ?? null;
}

export function isNativeApp(): boolean {
  const cap = capacitor();
  try {
    return !!cap?.isNativePlatform?.();
  } catch {
    return false;
  }
}

export function nativePlatform(): NativePlatform {
  const p = capacitor()?.getPlatform?.();
  return p === 'android' || p === 'ios' ? p : 'web';
}

const pluginCache: Record<string, any> = {};

function plugin<T>(name: string): T | null {
  if (!isNativeApp()) return null;
  if (pluginCache[name]) return pluginCache[name] as T;
  const cap = capacitor();
  if (!cap?.isPluginAvailable?.(name)) return null;
  const instance = cap.Plugins?.[name] ?? cap.registerPlugin?.(name);
  if (instance) pluginCache[name] = instance;
  return (instance ?? null) as T | null;
}

// ── Tokens ───────────────────────────────────────────────────────────────

const TOKEN_KEY = 'herafi.fcm.token';

function rememberToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
}

function rememberedToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

async function saveToken(token: string) {
  const supabase = createClient();
  // The RPC moves the token to the signed-in account, so a phone that switched
  // accounts stops receiving the previous account's notifications.
  const { error } = await supabase.rpc('register_fcm_token', {
    p_token: token,
    p_platform: nativePlatform(),
  });
  if (error) {
    // Fallback for databases that don't have the RPC yet.
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      await supabase.from('fcm_tokens').upsert(
        { user_id: data.user.id, token, platform: nativePlatform(), updated_at: new Date().toISOString() },
        { onConflict: 'user_id,token' }
      );
    }
  }
  rememberToken(token);
}

let tokenListenerAdded = false;

/**
 * Ask for notification permission (once) and register this phone for the
 * signed-in user. Returns true when the phone will receive notifications.
 */
export async function registerNativePush(): Promise<boolean> {
  const messaging = plugin<FirebaseMessagingPlugin>('FirebaseMessaging');
  if (!messaging) return false;

  try {
    let { receive } = await messaging.checkPermissions();
    if (receive === 'prompt' || receive === 'prompt-with-rationale') {
      ({ receive } = await messaging.requestPermissions());
    }
    if (receive !== 'granted') return false;

    if (!tokenListenerAdded) {
      tokenListenerAdded = true;
      await messaging.addListener('tokenReceived', ({ token }) => {
        if (token) saveToken(token).catch(() => {});
      });
    }

    const { token } = await messaging.getToken();
    if (!token) return false;
    await saveToken(token);
    return true;
  } catch (err) {
    console.warn('Native push registration failed:', err);
    return false;
  }
}

export async function nativePushPermission(): Promise<'granted' | 'denied' | 'prompt' | 'unavailable'> {
  const messaging = plugin<FirebaseMessagingPlugin>('FirebaseMessaging');
  if (!messaging) return 'unavailable';
  try {
    const { receive } = await messaging.checkPermissions();
    if (receive === 'granted' || receive === 'denied') return receive;
    return 'prompt';
  } catch {
    return 'unavailable';
  }
}

/** On sign-out: stop sending this account's notifications to this phone. */
export async function unregisterNativePush(): Promise<void> {
  const token = rememberedToken();
  if (!token) return;
  try {
    await createClient().rpc('unregister_fcm_token', { p_token: token });
  } catch {
    /* ignore */
  }
  rememberToken(null);
}

// ── App start ────────────────────────────────────────────────────────────

let started = false;

/**
 * One-time native setup when the site loads inside the app: notification
 * channel, notification taps, and the Android back button.
 */
export async function startNativeApp(navigate: (url: string) => void): Promise<void> {
  if (started || !isNativeApp()) return;
  started = true;
  document.documentElement.classList.add('native-app', `native-${nativePlatform()}`);

  const messaging = plugin<FirebaseMessagingPlugin>('FirebaseMessaging');
  if (messaging) {
    if (nativePlatform() === 'android') {
      // High importance = heads-up banner with sound, like WhatsApp.
      await messaging
        .createChannel({
          id: NOTIFICATION_CHANNEL_ID,
          name: 'إشعارات حِرَفي',
          description: 'الطلبات والرسائل وعروض الأسعار',
          importance: 5,
          visibility: 1,
          vibration: true,
          lights: true,
          lightColor: '#2a724d',
        })
        .catch(() => {});
    }

    await messaging
      .addListener('notificationActionPerformed', ({ notification }) => {
        const url = notification?.data?.url;
        if (typeof url === 'string' && url.startsWith('/')) navigate(url);
      })
      .catch(() => {});
  }

  const app = plugin<AppPlugin>('App');
  if (app && nativePlatform() === 'android') {
    await app
      .addListener('backButton', ({ canGoBack }) => {
        if (canGoBack && window.history.length > 1) {
          window.history.back();
        } else if (app.minimizeApp) {
          app.minimizeApp();
        } else {
          app.exitApp();
        }
      })
      .catch(() => {});
  }
}
