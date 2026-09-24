// app/api/mobile/socio/movimientos/route.ts
// Mismo criterio que app/api/portal/[socioId]/movimientos, autenticado con
// Bearer JWT. Acepta filtros opcionales (?desde=&hasta=&tipo=A,B) para que
// el historial no dependa de que todo quepa en un solo `take`.
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
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

  const { searchParams } = req.nextUrl;
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");
  const tipo = searchParams.get("tipo"); // "AHORRO,RETIRO"

  const where: Prisma.MovimientoCuentaWhereInput = { socioId };
  if (desde || hasta) {
    where.createdAt = {
      ...(desde ? { gte: new Date(desde) } : {}),
      ...(hasta ? { lte: new Date(hasta) } : {}),
    };
  }
  if (tipo) {
    where.tipo = { in: tipo.split(",").map(t => t.trim()).filter(Boolean) };
  }

  const movimientos = await prisma.movimientoCuenta.findMany({
    where,
    include: { ronda: { select: { nombre: true } } },
    orderBy: { createdAt: "desc" },
    take: 500,
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
