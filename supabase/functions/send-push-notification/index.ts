// Supabase Edge Function: send-push-notification
// Supports both Web Push (VAPID) and Firebase Cloud Messaging (FCM)
// FCM is used for WebView apps via JS-Native bridge

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
  accessToken: string
): Promise<{ success: boolean; expired: boolean }> {
  const message = {
    message: {
      token: fcmToken,
      notification: { title, body },
      data,
      android: {
        priority: "high",
        notification: {
          sound: "default",
          channel_id: "sanaei_notifications",
          click_action: "FLUTTER_NOTIFICATION_CLICK",
        },
      },
      apns: {
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
  const expired =
    errCode === "UNREGISTERED" ||
    errCode === "INVALID_ARGUMENT" ||
    res.status === 404;

  return { success: false, expired };
}

// ─────────────────────────────────────────────────────────────────────────────
// Web Push (VAPID) — existing implementation
// ─────────────────────────────────────────────────────────────────────────────

async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  subject: string
) {
  const endpoint = new URL(subscription.endpoint);
  const audience = `${endpoint.protocol}//${endpoint.host}`;

  const header = { typ: "JWT", alg: "ES256" };
  const claims = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: subject,
  };

  const b64url = (buf: ArrayBuffer) =>
    btoa(String.fromCharCode(...new Uint8Array(buf)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");

  const enc = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  const claimsB64 = btoa(JSON.stringify(claims)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  const signingInput = `${headerB64}.${claimsB64}`;

  const privKeyBytes = Uint8Array.from(atob(vapidPrivateKey.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
  const privKey = await crypto.subtle.importKey(
    "raw",
    privKeyBytes,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privKey,
    enc.encode(signingInput)
  );

  const jwt = `${signingInput}.${b64url(sig)}`;

  const payloadBytes = enc.encode(payload);
  const p256dhBytes = Uint8Array.from(atob(subscription.p256dh.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
  const authBytes = Uint8Array.from(atob(subscription.auth.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

  const recipientPublicKey = await crypto.subtle.importKey(
    "raw",
    p256dhBytes,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  const senderKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );

  const sharedSecret = await crypto.subtle.deriveBits(
    { name: "ECDH", public: recipientPublicKey },
    senderKeyPair.privateKey,
    256
  );

  const senderPublicKeyRaw = await crypto.subtle.exportKey("raw", senderKeyPair.publicKey);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await crypto.subtle.importKey("raw", sharedSecret, { name: "HKDF" }, false, ["deriveBits"]);

  const authInfo = enc.encode("Content-Encoding: auth\0");
  const keyInfo = buildInfo("aesgcm", p256dhBytes, new Uint8Array(senderPublicKeyRaw));
  const nonceInfo = buildInfo("nonce", p256dhBytes, new Uint8Array(senderPublicKeyRaw));

  const ikm = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: authBytes, info: authInfo },
    prk,
    256
  );

  const ikmKey = await crypto.subtle.importKey("raw", ikm, { name: "HKDF" }, false, ["deriveBits"]);

  const contentKey = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info: keyInfo },
    ikmKey,
    128
  );

  const nonce = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info: nonceInfo },
    ikmKey,
    96
  );

  const aesKey = await crypto.subtle.importKey("raw", contentKey, { name: "AES-GCM" }, false, ["encrypt"]);

  const padded = new Uint8Array(payloadBytes.length + 2);
  padded.set(payloadBytes, 2);

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    aesKey,
    padded
  );

  const vapidPublicKeyBytes = Uint8Array.from(atob(vapidPublicKey.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

  const body = new Uint8Array(salt.length + 4 + 1 + vapidPublicKeyBytes.length + encrypted.byteLength);
  let offset = 0;
  body.set(salt, offset); offset += salt.length;
  body[offset++] = 0; body[offset++] = 0; body[offset++] = 16; body[offset++] = 0;
  body[offset++] = vapidPublicKeyBytes.length;
  body.set(vapidPublicKeyBytes, offset); offset += vapidPublicKeyBytes.length;
  body.set(new Uint8Array(encrypted), offset);

  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aesgcm",
      "Encryption": `salt=${b64url(salt.buffer)}`,
      "Crypto-Key": `dh=${b64url(senderPublicKeyRaw)};p256ecdsa=${vapidPublicKey}`,
      "Authorization": `vapid t=${jwt},k=${vapidPublicKey}`,
      "TTL": "86400",
    },
    body,
  });

  return response;
}

function buildInfo(type: string, clientPublicKey: Uint8Array, serverPublicKey: Uint8Array): Uint8Array {
  const enc = new TextEncoder();
  const typeBytes = enc.encode(`Content-Encoding: ${type}\0P-256\0`);
  const info = new Uint8Array(typeBytes.length + 2 + clientPublicKey.length + 2 + serverPublicKey.length);
  let offset = 0;
  info.set(typeBytes, offset); offset += typeBytes.length;
  info[offset++] = 0; info[offset++] = clientPublicKey.length;
  info.set(clientPublicKey, offset); offset += clientPublicKey.length;
  info[offset++] = 0; info[offset++] = serverPublicKey.length;
  info.set(serverPublicKey, offset);
  return info;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { userId, title, body, url, orderId, channel } = await req.json();

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
        } catch {
          accessToken = "";
        }

        if (accessToken) {
          const expiredFcmIds: string[] = [];
          const notifData: Record<string, string> = {
            url: url || "/home-screen",
            orderId: orderId || "",
          };

          for (const row of fcmTokens) {
            const result = await sendFCMNotification(
              row.token,
              title,
              body,
              notifData,
              fcmProjectId,
              accessToken
            ).catch(() => ({ success: false, expired: false }));

            if (result.success) {
              totalSent++;
            } else if (result.expired) {
              expiredFcmIds.push(row.id);
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
          url: url || "/home-screen",
          orderId: orderId || null,
          tag: orderId ? `order-${orderId}` : "sanaei-notification",
        });

        const expired: string[] = [];

        for (const sub of subscriptions) {
          try {
            const res = await sendWebPush(
              { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
              payload,
              vapidPublicKey,
              vapidPrivateKey,
              `mailto:admin@${new URL(siteUrl).hostname}`
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

    return new Response(JSON.stringify({ sent: totalSent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
