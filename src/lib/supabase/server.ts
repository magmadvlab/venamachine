import { createClient as createSupaClient } from "@supabase/supabase-js";

const REQUIRED_SERVER_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "RESEND_API_KEY",
  "MAIL_FROM",
  "NEXT_PUBLIC_APP_URL",
] as const;

export function missingServerEnv() {
  return REQUIRED_SERVER_ENV.filter((key) => !process.env[key]);
}

export function hasServiceConfig() {
  return missingServerEnv().length === 0;
}

/**
 * Client server-side con service_role: usato solo nelle route API/azioni server.
 * NON importare in componenti client.
 */
export function createServiceClient() {
  if (!hasServiceConfig()) {
    throw new Error(`Configurazione Vercel incompleta: mancano ${missingServerEnv().join(", ")}`);
  }

  return createSupaClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
