// app/api/rondas/[id]/avanzar/route.ts
import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const rawId = resolvedParams.id;
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
  } catch (error) {
    console.error("Error en GET /api/rondas/[id]/avanzar:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}