#!/usr/bin/env node

const required = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
];

for (const key of required) {
  if (!process.env[key]) {
    console.error(`[load-test] Missing env var: ${key}`);
    process.exit(1);
  }
}

const supabaseUrl = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const endpoint = `${supabaseUrl}/functions/v1/auth-security`;

const attempts = Number(process.env.AUTH_LOAD_ATTEMPTS || 12);
const sessionId = `load-test-${Date.now()}`;
const email = "invalid-load-test@habitae.local";

async function invoke(payload) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

(async () => {
  console.log(`[load-test] Running ${attempts} invalid attempts with session ${sessionId}`);

  for (let i = 1; i <= attempts; i += 1) {
    const response = await invoke({
      action: "record_attempt",
      email,
      sessionId,
      success: false,
      reason: "load_test_invalid_credentials",
    });

    console.log(`[attempt ${i}] status=${response.status} body=${JSON.stringify(response.data)}`);
  }

  const statusResult = await invoke({
    action: "get_status",
    email,
    sessionId,
  });

  console.log(`[status] ${JSON.stringify(statusResult.data)}`);
})();
