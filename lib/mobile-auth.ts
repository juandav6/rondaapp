// lib/mobile-auth.ts
// Autenticación por token (Bearer JWT) para la API que consume la app Flutter.
// Independiente de las sesiones por cookie de NextAuth que usa la web.
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

const SECRET = process.env.MOBILE_JWT_SECRET || process.env.NEXTAUTH_SECRET || "";
const EXPIRES_IN = "30d";

if (!SECRET) {
  // No lanzamos error en import-time para no romper el build, pero sí en uso.
  console.warn("[mobile-auth] Falta MOBILE_JWT_SECRET o NEXTAUTH_SECRET en las variables de entorno.");
}

export type MobileTokenPayload = {
  id: number;
  email: string;
  nombre: string | null;
  rol: "ADMIN" | "SOCIO";
  socioId: number | null;
};

export function signMobileToken(payload: MobileTokenPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });
}

export function verifyMobileToken(token: string): MobileTokenPayload | null {
  try {
    const decoded = jwt.verify(token, SECRET);
    if (typeof decoded === "string") return null;
    return decoded as unknown as MobileTokenPayload;
  } catch {
    return null;
  }
}

function extractBearer(req: NextRequest): string | null {
  const header = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!header || !header.startsWith("Bearer ")) return null;
  return header.slice(7).trim();
}

/** Devuelve el usuario del token, o null si no hay token válido. */
export function getMobileUser(req: NextRequest): MobileTokenPayload | null {
  const token = extractBearer(req);
  if (!token) return null;
  return verifyMobileToken(token);
}

/** Atajo: responde 401 automáticamente si no hay sesión móvil válida. */
export function requireMobileUser(
  req: NextRequest
): { user: MobileTokenPayload } | { error: NextResponse } {
  const user = getMobileUser(req);
  if (!user) {
    return { error: NextResponse.json({ error: "No autenticado" }, { status: 401 }) };
  }
  return { user };
}

/** Atajo: además exige rol ADMIN. */
export function requireMobileAdmin(
  req: NextRequest
): { user: MobileTokenPayload } | { error: NextResponse } {
  const result = requireMobileUser(req);
  if ("error" in result) return result;
  if (result.user.rol !== "ADMIN") {
    return { error: NextResponse.json({ error: "Sin permisos" }, { status: 403 }) };
  }
  return result;
}
