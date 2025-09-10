import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type Context = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: Context) {
  const { params } = await context;
  const rondaId = Number((await params).id);

  const { socioId, semana, monto } = await req.json();
  if (!socioId || !semana || monto == null) {
    return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
  }

  const ronda = await prisma.ronda.findUnique({ where: { id: rondaId } });
  if (!ronda) return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });
  if (!ronda.activa) return NextResponse.json({ error: "Ronda no activa" }, { status: 400 });

  // Acumular ahorro (permitimos múltiples registros por semana)
  const reg = await prisma.ahorro.create({
    data: { rondaId, socioId, semana, monto },
  });

  return NextResponse.json({
    id: reg.id,
    socioId,
    semana,
    monto: reg.monto.toString(),
  });
}
