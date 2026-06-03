import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

function isConfigured(value?: string) {
  return Boolean(value && !value.startsWith("la-tua-"));
}

/**
 * Client Supabase server-side basato sui cookie (anon key), per leggere la
 * sessione dell'operatore loggato in server component, route handler e azioni.
 * In un server component i cookie sono in sola lettura: il setAll è protetto.
 */
export function createServerSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!isConfigured(supabaseUrl) || !isConfigured(supabaseAnonKey)) {
    throw new Error("Configurazione Supabase Auth incompleta");
  }

  const cookieStore = cookies();
  return createServerClient(
    supabaseUrl!,
    supabaseAnonKey!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // chiamato da un server component: ignorabile, il refresh
            // della sessione lo gestisce il middleware.
          }
        },
      },
    },
  );
}

/** Utente loggato (o null) dalla sessione corrente. */
export async function getCurrentUser() {
  try {
    const supabase = createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
}

/** Email considerate admin (variabile ADMIN_EMAILS, separate da virgola). */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return adminEmails().includes(email.toLowerCase());
}
