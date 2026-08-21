import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { getCurrentUser } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";

export default async function ImpostazioniPasswordPage({
  searchParams,
}: {
  searchParams: { forced?: string };
}) {
  const user = await getCurrentUser();
  const forced = searchParams.forced === "1" || Boolean(user?.user_metadata?.must_change_password);

  return (
    <main className="mx-auto max-w-sm px-4 pb-24 pt-8">
      <header className="mb-5">
        <p className="text-sm font-semibold text-arancio">Account</p>
        <h1 className="font-display text-2xl font-bold text-coffee-50">Cambia password</h1>
      </header>
      <ChangePasswordForm forced={forced} />
    </main>
  );
}
