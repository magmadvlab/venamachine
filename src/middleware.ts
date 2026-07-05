import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

// Route pubbliche: login, tracking cliente, volantini, prenotazione manutenzione e slot agenda controllati da token.
const PUBLIC_PATHS = [
  /^\/login(\/|$)/,
  /^\/r\//,
  /^\/offerte\/[^/]+\/?$/,
  /^\/manutenzione\/[^/]+\/?$/,
  /^\/api\/agenda\/slots(\/|$)/,
  /^\/api\/agenda\/prenotazioni(\/|$)/,
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((re) => re.test(pathname));
}

function isConfigured(value?: string) {
  return Boolean(value && !value.startsWith("la-tua-"));
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!isConfigured(supabaseUrl) || !isConfigured(supabaseAnonKey)) {
    return response;
  }

  try {
    const supabase = createServerClient(
      supabaseUrl!,
      supabaseAnonKey!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options),
            );
          },
        },
      },
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const pathname = request.nextUrl.pathname;

    if (!user && !isPublic(pathname)) {
      // API: rispondo 401; pagine: redirect a /login conservando la destinazione.
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
      }
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }
  } catch {
    return response;
  }

  return response;
}

export const config = {
  // Esclude asset statici, immagini Next, manifest e icone/asset PWA pubblici.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|robots.txt|.*\\.png$|.*\\.svg$|.*\\.ico$).*)",
  ],
};
