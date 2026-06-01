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
