import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Client Supabase server-side basato sui cookie (anon key), per leggere la
 * sessione dell'operatore loggato in server component, route handler e azioni.
 * In un server component i cookie sono in sola lettura: il setAll è protetto.
 */
export function createServerSupabase() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
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
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
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
