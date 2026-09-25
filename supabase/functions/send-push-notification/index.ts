// Supabase Edge Function: send-push-notification
// Triggered by the app to send Web Push to a user's subscriptions

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

// Minimal VAPID Web Push implementation using Web Crypto API
async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  subject: string
) {
  const endpoint = new URL(subscription.endpoint);
  const audience = `${endpoint.protocol}//${endpoint.host}`;

  // Build VAPID JWT
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

  // Import private key
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

  // Encrypt payload using Web Push encryption (RFC 8291)
  const payloadBytes = enc.encode(payload);

  // Decode subscription keys
  const p256dhBytes = Uint8Array.from(atob(subscription.p256dh.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
  const authBytes = Uint8Array.from(atob(subscription.auth.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

  // Import recipient public key
  const recipientPublicKey = await crypto.subtle.importKey(
    "raw",
    p256dhBytes,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  // Generate sender key pair
  const senderKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );

  // Derive shared secret
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: "ECDH", public: recipientPublicKey },
    senderKeyPair.privateKey,
    256
  );

  // Export sender public key
  const senderPublicKeyRaw = await crypto.subtle.exportKey("raw", senderKeyPair.publicKey);

  // Generate salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // HKDF for content encryption key and nonce
  const prk = await crypto.subtle.importKey("raw", sharedSecret, { name: "HKDF" }, false, ["deriveBits"]);

  // Build info strings per RFC 8291
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

  // Encrypt
  const aesKey = await crypto.subtle.importKey("raw", contentKey, { name: "AES-GCM" }, false, ["encrypt"]);

  // Pad payload
  const padded = new Uint8Array(payloadBytes.length + 2);
  padded.set(payloadBytes, 2);

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    aesKey,
    padded
  );

  // Build request
  const vapidPublicKeyBytes = Uint8Array.from(atob(vapidPublicKey.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

  const body = new Uint8Array(salt.length + 4 + 1 + vapidPublicKeyBytes.length + encrypted.byteLength);
  let offset = 0;
  body.set(salt, offset); offset += salt.length;
  // rs = 4096
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { userId, title, body, url, orderId } = await req.json();

    if (!userId || !title || !body) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
    const siteUrl = Deno.env.get("NEXT_PUBLIC_SITE_URL") || "https://sanaei1489.builtwithrocket.new";

    // Fetch user's push subscriptions
    const subsRes = await fetch(
      `${supabaseUrl}/rest/v1/push_subscriptions?user_id=eq.${userId}`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      }
    );

    const subscriptions = await subsRes.json();

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "No subscriptions found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.stringify({
      title,
      body,
      url: url || "/home-screen",
      orderId: orderId || null,
      tag: orderId ? `order-${orderId}` : "sanaei-notification",
    });

    let sent = 0;
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
          sent++;
        } else if (res.status === 410 || res.status === 404) {
          expired.push(sub.id);
        }
      } catch {
        // ignore individual send failures
      }
    }

    // Clean up expired subscriptions
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

    return new Response(JSON.stringify({ sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
