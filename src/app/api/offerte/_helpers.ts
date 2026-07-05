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
