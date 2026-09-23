// middleware.ts (raíz del proyecto)
import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token as any;
    const rol = token?.rol;

    // ── Rutas públicas — dejar pasar siempre ──
    // Nota: /api/mobile ya no llega aquí — está excluida en el matcher de abajo
    // porque se autentica sola con Bearer JWT (ver lib/mobile-auth.ts).
    const esPublica =
      pathname.startsWith("/login") ||
      pathname.startsWith("/api/auth") ||
      pathname.startsWith("/_next") ||
      pathname.startsWith("/images") ||
      pathname === "/favicon.ico";

    if (esPublica) return NextResponse.next();

    // ── Sin sesión → login ──
    if (!token) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    // ── SOCIO intenta acceder al panel admin → portal ──
    if (rol === "SOCIO" && !pathname.startsWith("/portal") && !pathname.startsWith("/api/portal")) {
      const socioId = token.socioId;
      if (socioId) {
        return NextResponse.redirect(new URL(`/portal/${socioId}`, req.url));
      }
      return NextResponse.redirect(new URL("/login", req.url));
    }

    // ── ADMIN intenta acceder al portal → dashboard ──
    if (rol === "ADMIN" && pathname.startsWith("/portal")) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      // withAuth llama a este callback primero.
      // Devuelve true para que el middleware function() de arriba
      // maneje la lógica; false redirige automáticamente a signIn.
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    // Aplica a todas las rutas excepto archivos estáticos, api/auth y api/mobile.
    // api/mobile queda fuera porque el callback `authorized` de withAuth corre
    // ANTES que la función de arriba y redirigiría a /login (una respuesta HTML)
    // a cualquier request sin cookie de NextAuth, incluida la app Flutter.
    "/((?!login|api/auth|api/mobile|_next/static|_next/image|favicon.ico|images).*)",
  ],
};
