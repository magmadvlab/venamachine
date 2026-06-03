import { createClient as createSupaClient } from "@supabase/supabase-js";

const REQUIRED_SUPABASE_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

function isConfigured(value?: string) {
  return Boolean(value && !value.startsWith("la-tua-"));
}

export function missingSupabaseEnv() {
  return REQUIRED_SUPABASE_ENV.filter((key) => !isConfigured(process.env[key]));
}

export function hasServiceConfig() {
  return missingSupabaseEnv().length === 0;
}

/**
 * Client server-side con service_role: usato solo nelle route API/azioni server.
 * NON importare in componenti client.
 */
export function createServiceClient() {
  if (!hasServiceConfig()) {
    throw new Error(`Configurazione Supabase incompleta: mancano ${missingSupabaseEnv().join(", ")}`);
  }

  return createSupaClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
