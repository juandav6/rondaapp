// app/api/mobile/socio/movimientos/route.ts
// Mismo criterio que app/api/portal/[socioId]/movimientos, autenticado con
// Bearer JWT.
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireMobileUser } from "@/lib/mobile-auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const { user } = auth;

  let socioId: number | null = null;
  if (user.rol === "ADMIN") {
    const qp = req.nextUrl.searchParams.get("socioId");
    socioId = qp ? Number(qp) : null;
  } else {
    socioId = user.socioId;
  }
  if (!socioId) return NextResponse.json({ error: "Falta socioId" }, { status: 400 });

  const movimientos = await prisma.movimientoCuenta.findMany({
    where: { socioId },
    include: { ronda: { select: { nombre: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({
    movimientos: movimientos.map(m => ({
      id: m.id,
      tipo: m.tipo,
      monto: Number(m.monto),
      nota: m.nota,
      createdAt: m.createdAt,
      ronda: m.ronda,
    })),
  });
}
