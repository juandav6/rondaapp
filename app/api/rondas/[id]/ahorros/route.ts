// app/api/rondas/[id]/ahorros/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type Params = { params: { id: string } };

export async function POST(req: Request, { params }: Params) {
  const rondaId = Number(params.id);
  const { socioId, semana, monto } = await req.json();

  if (!socioId || !semana || !monto || Number(monto) <= 0) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const ronda = await prisma.ronda.findUnique({
    where: { id: rondaId },
    select: { ahorroObjetivoPorSocio: true },
  });
  if (!ronda) return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });

  const objetivo = Number(ronda.ahorroObjetivoPorSocio ?? 0);

  // acumulado actual
  const { _sum } = await prisma.ahorro.aggregate({
    where: { rondaId, socioId },
    _sum: { monto: true },
  });
  const acum = Number(_sum.monto ?? 0);
  const restante = Math.max(objetivo - acum, 0);

  if (Number(monto) > restante) {
    return NextResponse.json(
      { error: `No puedes ahorrar más de ${restante.toFixed(2)} esta ronda` },
      { status: 400 }
    );
  }

  // Si quieres forzar máximo UN registro por semana, verifica:
  const ya = await prisma.ahorro.count({ where: { rondaId, socioId, semana } });
  if (ya > 0) {
    return NextResponse.json({ error: "Ya registraste un ahorro esta semana" }, { status: 400 });
  }

  await prisma.ahorro.create({
    data: { rondaId, socioId, semana, monto: Number(monto) },
  });

  return NextResponse.json({ ok: true });
}
