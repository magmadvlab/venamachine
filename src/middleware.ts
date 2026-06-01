import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Route pubbliche (cliente "solo riceve"): pagina di tracking e login.
const PUBLIC_PATHS = [/^\/login(\/|$)/, /^\/r\//];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((re) => re.test(pathname));
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
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

  return response;
}

export const config = {
  // Esclude asset statici, immagini Next, manifest e icone/asset PWA pubblici.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|robots.txt|.*\\.png$|.*\\.svg$|.*\\.ico$).*)",
  ],
};
