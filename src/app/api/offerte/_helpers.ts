import { NextResponse } from "next/server";

type DbErrorShape = {
  message: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
};

export function dbError(step: string, error: DbErrorShape) {
  return NextResponse.json(
    { error: `${step}: ${error.message}`, code: error.code, details: error.details, hint: error.hint },
    { status: 400 },
  );
}

export function offerMessage(opts: { titolo: string; offertaUrl: string; validaAl?: string | null }) {
  return [
    "Ciao! Vena Coffee Machine ha nuove offerte per te.",
    `Volantino: ${opts.titolo}`,
    opts.validaAl ? `Valide fino al ${new Date(opts.validaAl).toLocaleDateString("it-IT")}.` : null,
    `Vedi tutte le offerte: ${opts.offertaUrl}`,
  ].filter(Boolean).join("\n");
}
