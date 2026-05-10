// app/api/rondas/[id]/ahorros/route.ts
import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";

export async function POST(req: Request | NextRequest, { params }: any) {
  const rondaId = Number(Array.isArray(params?.id) ? params.id[0] : params?.id);
  const { socioId, semana, monto } = (await req.json()) as {
    socioId?: number; semana?: number; monto?: number;
  };

  if (!Number.isFinite(rondaId) || !socioId || !semana || !monto || Number(monto) <= 0) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const ronda = await prisma.ronda.findUnique({
    where: { id: rondaId },
    select: { id: true },
  });
  if (!ronda) {
    return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });
  }

  // Verificar que no haya registrado ahorro esta semana
  const ya = await prisma.ahorro.count({ where: { rondaId, socioId, semana } });
  if (ya > 0) {
    return NextResponse.json({ error: "Ya registraste un ahorro esta semana" }, { status: 400 });
  }

  // Registrar ahorro Y actualizar saldoAhorros en una sola transacción
  const montoDecimal = new Prisma.Decimal(monto);

  const [ahorro, socioActualizado] = await prisma.$transaction([
    prisma.ahorro.create({
      data: { rondaId, socioId, semana, monto: montoDecimal },
    }),
    prisma.socio.update({
      where: { id: socioId },
      data: { saldoAhorros: { increment: montoDecimal } },
      select: { saldoAhorros: true },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    ahorro,
    nuevoSaldo: Number(socioActualizado.saldoAhorros),
  });
}
