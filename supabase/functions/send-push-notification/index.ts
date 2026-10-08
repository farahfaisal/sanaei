// Supabase Edge Function: send-push-notification
// Supports both Web Push (VAPID) and Firebase Cloud Messaging (FCM)
// FCM is used for WebView apps via JS-Native bridge
//
// SECURITY: only the database may call this function (Authorization: Bearer
// <service_role key>, sent by public.queue_push()). App users can't send pushes
// directly — events in the database (orders, quotes, chat…) trigger them.

declare const Deno: {
  serve: (handler: (req: Request) => Promise<Response>) => void;
  env: {
    get: (key: string) => string | undefined;
  };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─────────────────────────────────────────────────────────────────────────────
// FCM: Send via Firebase HTTP v1 API
// ─────────────────────────────────────────────────────────────────────────────

async function getGoogleAccessToken(serviceAccountJson: string): Promise<string> {
  const sa = JSON.parse(serviceAccountJson);
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const enc = new TextEncoder();
  const b64url = (str: string) =>
    btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

  const headerB64 = b64url(JSON.stringify(header));
  const payloadB64 = b64url(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;

  // Import RSA private key
  const pemBody = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const keyBytes = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    enc.encode(signingInput)
  );

  const sigB64 = b64url(String.fromCharCode(...new Uint8Array(sig)));
  const jwt = `${signingInput}.${sigB64}`;

  // Exchange JWT for access token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

async function sendFCMNotification(
  fcmToken: string,
  title: string,
  body: string,
  data: Record<string, string>,
  projectId: string,
  accessToken: string,
  tag?: string
): Promise<{ success: boolean; expired: boolean; error?: string }> {
  const message = {
    message: {
      token: fcmToken,
      notification: { title, body },
      data,
      android: {
        priority: "high",
        notification: {
          sound: "default",
          // Keep this id: the Android app creates the notification channel with it.
          channel_id: "sanaei_notifications",
          // Heads-up banner. No click_action: a tap opens the app, and the app
          // reads data.url to open the right screen.
          notification_priority: "PRIORITY_HIGH",
          default_vibrate_timings: true,
          ...(tag ? { tag } : {}),
        },
      },
      apns: {
        headers: {
          "apns-priority": "10",
          "apns-push-type": "alert",
          ...(tag ? { "apns-collapse-id": tag.slice(0, 64) } : {}),
        },
        payload: {
          aps: {
            sound: "default",
            badge: 1,
          },
        },
      },
    },
  };

  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(message),
    }
  );

  if (res.ok) return { success: true, expired: false };

  const errBody = await res.json().catch(() => ({}));
  const errCode = errBody?.error?.details?.[0]?.errorCode || "";
  const errMessage: string = errBody?.error?.message || `HTTP ${res.status}`;
  // Only drop the token when Firebase says the token itself is dead — not for
  // other errors (a payload problem must not wipe every phone's token).
  const expired =
    errCode === "UNREGISTERED" ||
    res.status === 404 ||
    (errCode === "INVALID_ARGUMENT" && /registration token/i.test(errMessage));

  return { success: false, expired, error: `${errCode || res.status}: ${errMessage}` };
}

// ─────────────────────────────────────────────────────────────────────────────
// Web Push — BEGIN (standard aes128gcm + VAPID; tested by decrypting the output)
// ─────────────────────────────────────────────────────────────────────────────

// Standard Web Push (RFC 8291 encryption "aes128gcm" + RFC 8292 VAPID).
// Works with Chrome/Edge/Firefox (Android + desktop) and Safari (iPhone
// home-screen apps, macOS). Delivered by the browser vendor's push service,
// so notifications arrive even when the site/app is closed.

const enc = new TextEncoder();

function b64urlToBytes(value: string): Uint8Array {
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

function bytesToB64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, bytes: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, bytes * 8);
  return new Uint8Array(bits);
}

/** VAPID JWT signed with the application server's private key (ES256). */
async function createVapidJwt(
  audience: string,
  subject: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  expiresInSeconds = 12 * 3600
): Promise<string> {
  const pub = b64urlToBytes(vapidPublicKey); // 65 bytes: 0x04 || X || Y
  const jwk: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    x: bytesToB64url(pub.slice(1, 33)),
    y: bytesToB64url(pub.slice(33, 65)),
    d: vapidPrivateKey,
    ext: true,
  };
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);

  const header = bytesToB64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = bytesToB64url(
    enc.encode(JSON.stringify({ aud: audience, exp: Math.floor(Date.now() / 1000) + expiresInSeconds, sub: subject }))
  );
  const input = `${header}.${claims}`;
  const signature = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(input))
  ); // raw r||s (64 bytes), as JWT ES256 requires
  return `${input}.${bytesToB64url(signature)}`;
}

/** Encrypts a payload for one subscription (RFC 8291, single record). */
async function encryptPayload(
  payload: Uint8Array,
  p256dh: string,
  authSecret: string,
  salt: Uint8Array = crypto.getRandomValues(new Uint8Array(16))
): Promise<Uint8Array> {
  const uaPublic = b64urlToBytes(p256dh);
  const auth = b64urlToBytes(authSecret);

  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const asKeys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]) as CryptoKeyPair;
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", asKeys.publicKey));
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, asKeys.privateKey, 256)
  );

  const keyInfo = concat(enc.encode("WebPush: info\0"), uaPublic, asPublic);
  const ikm = await hkdf(auth, ecdhSecret, keyInfo, 32);
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);

  const aesKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const plaintext = concat(payload, new Uint8Array([2])); // 0x02 = last record delimiter
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, plaintext));

  const recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, 4096);
  return concat(salt, recordSize, new Uint8Array([asPublic.length]), asPublic, ciphertext);
}

interface PushSubscriptionKeys {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Sends one notification. Returns the push service's HTTP status. */
async function sendWebPush(
  subscription: PushSubscriptionKeys,
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  subject: string,
  options: { ttlSeconds?: number; urgency?: "very-low" | "low" | "normal" | "high"; topic?: string } = {}
): Promise<Response> {
  const endpoint = new URL(subscription.endpoint);
  const jwt = await createVapidJwt(`${endpoint.protocol}//${endpoint.host}`, subject, vapidPublicKey, vapidPrivateKey);
  const body = await encryptPayload(enc.encode(payload), subscription.p256dh, subscription.auth);

  const headers: Record<string, string> = {
    "Content-Type": "application/octet-stream",
    "Content-Encoding": "aes128gcm",
    Authorization: `vapid t=${jwt}, k=${vapidPublicKey}`,
    TTL: String(options.ttlSeconds ?? 86400),
    Urgency: options.urgency ?? "high",
  };
  // Topic replaces an older undelivered notification with the same topic (max 32 url-safe chars).
  if (options.topic) headers.Topic = options.topic.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32);

  return fetch(subscription.endpoint, { method: "POST", headers, body });
}

// Web Push — END

// ─────────────────────────────────────────────────────────────────────────────
// Auth: accept only the project's service_role key
// ─────────────────────────────────────────────────────────────────────────────

function decodeJwtPart(part: string): Record<string, unknown> | null {
  try {
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4)));
  } catch {
    return null;
  }
}

async function verifyHs256(token: string, secret: string): Promise<boolean> {
  const [h, p, sig] = token.split(".");
  if (!h || !p || !sig) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const sigBytes = Uint8Array.from(atob(sig.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (sig.length % 4)) % 4)), (c) => c.charCodeAt(0));
  return crypto.subtle.verify("HMAC", key, sigBytes, new TextEncoder().encode(`${h}.${p}`));
}

/**
 * True when the request carries this project's service_role key.
 * 1. Exact match with the key Supabase injects into the function, or
 * 2. A service_role JWT for this project. Its signature is checked with
 *    SUPABASE_JWT_SECRET when available; otherwise we rely on the platform's
 *    "Verify JWT" check (keep it ON for this function).
 */
async function isServiceRoleRequest(bearer: string): Promise<boolean> {
  if (!bearer) return false;
  const envKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (envKey && bearer === envKey) return true;

  const parts = bearer.split(".");
  if (parts.length !== 3) return false;
  const payload = decodeJwtPart(parts[1]);
  if (!payload || payload.role !== "service_role") return false;

  const projectRef = (Deno.env.get("SUPABASE_URL") || "").match(/https:\/\/([^.]+)\./)?.[1];
  if (projectRef && payload.ref && payload.ref !== projectRef) return false;
  if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) return false;

  const jwtSecret = Deno.env.get("SUPABASE_JWT_SECRET") || Deno.env.get("JWT_SECRET") || "";
  if (jwtSecret) return verifyHs256(bearer, jwtSecret);
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Only the database (service role) may send pushes.
  const bearer = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!(await isServiceRoleRequest(bearer))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { userId, title, body, url, orderId, tag } = await req.json();

    if (!userId || !title || !body) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const siteUrl = Deno.env.get("NEXT_PUBLIC_SITE_URL") || "https://sanaei1489.builtwithrocket.new";

    // FCM credentials
    const fcmServiceAccountJson = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON") || "";
    const fcmProjectId = Deno.env.get("FCM_PROJECT_ID") || "";

    // VAPID credentials
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") || "";
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") || "";

    let totalSent = 0;
    const fcmErrors: string[] = [];

    // ── FCM path (WebView / native apps) ──────────────────────────────────────
    if (fcmServiceAccountJson && fcmProjectId) {
      const fcmRes = await fetch(
        `${supabaseUrl}/rest/v1/fcm_tokens?user_id=eq.${userId}`,
        {
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
          },
        }
      );

      const fcmTokens: { id: string; token: string }[] = await fcmRes.json().catch(() => []);

      if (fcmTokens && fcmTokens.length > 0) {
        let accessToken: string;
        try {
          accessToken = await getGoogleAccessToken(fcmServiceAccountJson);
        } catch (e) {
          accessToken = "";
          fcmErrors.push(`Google sign-in failed (check FCM_SERVICE_ACCOUNT_JSON): ${String(e)}`);
        }
        if (!accessToken && fcmErrors.length === 0) {
          fcmErrors.push("Google sign-in failed (check FCM_SERVICE_ACCOUNT_JSON)");
        }

        if (accessToken) {
          const expiredFcmIds: string[] = [];
          const notifData: Record<string, string> = {
            url: url || "/",
            orderId: orderId || "",
            tag: tag || "",
          };

          for (const row of fcmTokens) {
            const result = await sendFCMNotification(
              row.token,
              title,
              body,
              notifData,
              fcmProjectId,
              accessToken,
              tag || undefined
            ).catch((e) => ({ success: false, expired: false, error: String(e) }));

            if (result.success) {
              totalSent++;
            } else {
              if (result.expired) expiredFcmIds.push(row.id);
              if (result.error) fcmErrors.push(result.error);
            }
          }

          // Remove expired FCM tokens
          if (expiredFcmIds.length > 0) {
            await fetch(
              `${supabaseUrl}/rest/v1/fcm_tokens?id=in.(${expiredFcmIds.join(",")})`,
              {
                method: "DELETE",
                headers: {
                  apikey: serviceRoleKey,
                  Authorization: `Bearer ${serviceRoleKey}`,
                },
              }
            );
          }
        }
      }
    }

    // ── Web Push path (browser / PWA) ─────────────────────────────────────────
    if (vapidPublicKey && vapidPrivateKey) {
      const subsRes = await fetch(
        `${supabaseUrl}/rest/v1/push_subscriptions?user_id=eq.${userId}`,
        {
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
          },
        }
      );

      const subscriptions: { id: string; endpoint: string; p256dh: string; auth: string }[] =
        await subsRes.json().catch(() => []);

      if (subscriptions && subscriptions.length > 0) {
        const payload = JSON.stringify({
          title,
          body,
          url: url || "/",
          orderId: orderId || null,
          tag: tag || (orderId ? `order-${orderId}` : "herafi-notification"),
        });

        const expired: string[] = [];

        for (const sub of subscriptions) {
          try {
            const res = await sendWebPush(
              { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
              payload,
              vapidPublicKey,
              vapidPrivateKey,
              `mailto:admin@${new URL(siteUrl).hostname}`,
              { urgency: "high", ttlSeconds: 86400, topic: tag || undefined }
            );

            if (res.status === 201 || res.status === 200 || res.status === 202) {
              totalSent++;
            } else if (res.status === 410 || res.status === 404) {
              expired.push(sub.id);
            }
          } catch {
            // ignore individual send failures
          }
        }

        // Clean up expired Web Push subscriptions
        if (expired.length > 0) {
          await fetch(
            `${supabaseUrl}/rest/v1/push_subscriptions?id=in.(${expired.join(",")})`,
            {
              method: "DELETE",
              headers: {
                apikey: serviceRoleKey,
                Authorization: `Bearer ${serviceRoleKey}`,
              },
            }
          );
        }
      }
    }

    return new Response(JSON.stringify({
      sent: totalSent,
      fcmConfigured: !!(fcmServiceAccountJson && fcmProjectId),
      ...(fcmErrors.length ? { fcmErrors: fcmErrors.slice(0, 3) } : {}),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
