// app/api/rondas/[id]/avanzar/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Next.js provee un tipo para el contexto de rutas dinámicas
type RouteContext = {
  params: {
    id: string;
  };
};

export async function GET(req: Request, context: RouteContext) {
  const rawId = context.params.id;
  const idStr = Array.isArray(rawId) ? rawId[0] : rawId;
  const rondaId = Number(idStr);

  if (!Number.isFinite(rondaId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const ronda = await prisma.ronda.findUnique({
    where: { id: rondaId },
    include: { participaciones: true },
  });

  if (!ronda?.activa) {
    return NextResponse.json({ error: "Ronda no activa" }, { status: 400 });
  }

  const duracion = ronda.participaciones.length;
  const siguiente = (ronda.semanaActual ?? 0) + 1;

  if (siguiente > duracion) {
    await prisma.ronda.update({
      where: { id: rondaId },
      data: { activa: false, fechaFin: new Date() },
    });
    return NextResponse.json({ finalizada: true });
  }

  const r = await prisma.ronda.update({
    where: { id: rondaId },
    data: { semanaActual: siguiente },
  });

  return NextResponse.json(r);
}
