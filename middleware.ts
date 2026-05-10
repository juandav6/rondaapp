// middleware.ts  (en la raíz del proyecto, junto a package.json)
import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

// Protege todas las rutas excepto login y assets
export const config = {
  matcher: [
    "/((?!login|api/auth|_next/static|_next/image|favicon.ico|images).*)",
  ],
};
