import { createServerSupabase, isAdminEmail } from "@/lib/supabase/auth-server";

/**
 * Operatore corrispondente all'utente loggato (collegato via auth_user_id).
 * Ritorna null se non c'è sessione o l'utente non è collegato a un operatore.
 */
export async function getSessionOperatore(db: any) {
  let user = null;
  try {
    const sb = createServerSupabase();
    const result = await sb.auth.getUser();
    user = result.data.user;
  } catch {
    return null;
  }
  if (!user) return null;

  // L'admin è solo gestione: non è un operatore, non va collegato né elencato.
  if (isAdminEmail(user.email)) return null;

  const { data, error } = await db
    .from("operatori")
    .select("id, nome, auth_user_id, attivo")
    .eq("auth_user_id", user.id)
    .eq("attivo", true)
    .limit(1);
  if (error) throw error;
  if (data?.[0]) return data[0];

  const metadataName = (user.user_metadata?.name as string | undefined)?.trim();
  const email = user.email?.trim().toLowerCase();
  const emailName = email?.split("@")[0];
  const candidateNames = Array.from(new Set([
    metadataName,
    email,
    emailName,
  ].filter((name): name is string => Boolean(name))));

  for (const nome of candidateNames) {
    const { data: existing, error: existingError } = await db
      .from("operatori")
      .select("id, nome, auth_user_id, attivo")
      .ilike("nome", nome)
      .eq("attivo", true)
      .is("auth_user_id", null)
      .limit(1)
      .maybeSingle();
    if (existingError) throw existingError;

    if (existing) {
      const { data: linked, error: linkError } = await db
        .from("operatori")
        .update({ auth_user_id: user.id })
        .eq("id", existing.id)
        .is("auth_user_id", null)
        .select("id, nome, auth_user_id, attivo")
        .maybeSingle();
      if (linkError) throw linkError;
      if (linked) return linked;
    }
  }

  // Auto-provisioning: ogni utente loggato viene collegato a un operatore.
  // Il fallback con suffisso evita blocchi quando il nome è già presente.
  const nomeBase = candidateNames[0] || "Operatore";
  const namesToCreate = Array.from(new Set([
    nomeBase,
    `${nomeBase}-${user.id.slice(0, 4)}`,
  ]));

  for (const nome of namesToCreate) {
    const { data: created, error: createError } = await db
      .from("operatori")
      .insert({ nome, auth_user_id: user.id })
      .select("id, nome, auth_user_id, attivo")
      .maybeSingle();
    if (created) return created;
    if (createError?.code !== "23505") throw createError;
  }

  return null;
}

export async function findOperatore(db: any, id?: string | null, nome?: string | null) {
  const cleanId = id?.trim();
  const cleanName = nome?.trim();
  if (!cleanId && !cleanName) return null;

  let query = db
    .from("operatori")
    .select("id, nome")
    .eq("attivo", true)
    .limit(1);

  if (cleanId) {
    query = query.eq("id", cleanId);
  } else {
    query = query.ilike("nome", cleanName ?? "");
  }

  const { data, error } = await query;
  if (error) throw error;

  return data?.[0] ?? null;
}

export async function createOperatore(db: any, nome?: string | null) {
  const cleanName = nome?.trim();
  if (!cleanName) throw new Error("Nome operatore obbligatorio");

  const existing = await findOperatore(db, null, cleanName);
  if (existing) return existing;

  const { data, error } = await db
    .from("operatori")
    .insert({ nome: cleanName })
    .select("id, nome")
    .single();

  if (error) throw error;
  return data;
}
