// Supabase Auth "Send SMS" hook -> HTD SMS gateway (Palestine).
// Supabase generates the OTP and calls this function instead of sending the SMS itself.
// Docs: https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook
//
// Required secrets (supabase secrets set ...):
//   SEND_SMS_HOOK_SECRET  - "v1,whsec_..." issued by the Auth Hook settings
//   HTD_API_ID            - API ID from the HTD "My Account" page
//   HTD_SENDER            - approved sender name (e.g. Khadmatcom)

import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0';

const HTD_SEND_URL = 'https://sms.HTD.ps/API/SendSMS.aspx';

interface SendSmsHookPayload {
  user: { id: string; phone?: string };
  sms: { otp: string };
}

// HTD expects MSISDN in international format without "+", e.g. 970599123456.
function toHtdMsisdn(phone: string): string {
  return phone.replace(/\D/g, '');
}

function buildMessage(otp: string): string {
  return `رمز التحقق الخاص بك هو: ${otp}`;
}

async function sendViaHtd(to: string, text: string): Promise<void> {
  const apiId = Deno.env.get('HTD_API_ID');
  const sender = Deno.env.get('HTD_SENDER');
  if (!apiId || !sender) throw new Error('HTD_API_ID or HTD_SENDER is not configured');

  // SendSMS.aspx accepts POST form data; mode=0 = single destination, simple response.
  const body = new URLSearchParams({
    id: apiId,
    sender,
    to,
    msg: text,
    mode: '0',
  });

  const res = await fetch(HTD_SEND_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const reply = (await res.text()).trim();

  // Per HTD docs, a successful submission replies "Message Sent Successfully".
  // Any other reply (e.g. "Insufficient Credit", "IP Not Allowed", "Sender Not Allowed") is a failure.
  if (!res.ok || !reply.toLowerCase().includes('message sent successfully')) {
    throw new Error(`HTD rejected SMS: ${reply || res.status}`);
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const hookSecret = Deno.env.get('SEND_SMS_HOOK_SECRET');
  if (!hookSecret) {
    console.error('SEND_SMS_HOOK_SECRET is not set');
    return new Response(JSON.stringify({ error: { http_code: 500, message: 'Server misconfigured' } }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Verify Standard Webhooks signature so only Supabase Auth can trigger this function.
  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);
  let event: SendSmsHookPayload;
  try {
    const wh = new Webhook(hookSecret);
    event = wh.verify(payload, headers) as SendSmsHookPayload;
  } catch (err) {
    console.error('Webhook signature verification failed', err);
    return new Response(JSON.stringify({ error: { http_code: 401, message: 'Invalid signature' } }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const phone = event.user?.phone;
  const otp = event.sms?.otp;
  if (!phone || !otp) {
    return new Response(JSON.stringify({ error: { http_code: 400, message: 'Missing phone or otp' } }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    await sendViaHtd(toHtdMsisdn(phone), buildMessage(otp));
    // Empty object tells Supabase the SMS was handled by the hook.
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Failed to send OTP via HTD', err);
    return new Response(
      JSON.stringify({ error: { http_code: 502, message: 'Failed to send SMS' } }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    );
  }
});
