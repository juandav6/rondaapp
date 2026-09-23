// app/api/mobile/auth/me/route.ts
// Devuelve el usuario vigente según su token, releído de la BD (por si su rol
// o su socioId cambiaron desde que inició sesión).
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireMobileUser } from "@/lib/mobile-auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = requireMobileUser(req);
  if ("error" in auth) return auth.error;

  const usuario = await prisma.usuario.findUnique({
    where: { id: auth.user.id },
    select: { id: true, email: true, nombre: true, rol: true, socioId: true },
  });

  if (!usuario) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ user: usuario });
}
