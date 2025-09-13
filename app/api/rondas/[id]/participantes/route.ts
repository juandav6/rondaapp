// app/api/rondas/[id]/participantes/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { sociosIds } = await req.json();
    const rondaId = Number(params.id);

    if (!Array.isArray(sociosIds) || sociosIds.length === 0) {
      return NextResponse.json({ error: "sociosIds es requerido" }, { status: 400 });
    }

    // Trae lo que necesitas (incluye intervaloDiasCobro)
    const ronda = await prisma.ronda.findUnique({
      where: { id: rondaId },
      select: {
        id: true,
        fechaInicio: true,
        intervaloDiasCobro: true, // 👈 importante para el cálculo
      },
    });
    if (!ronda) return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });

    // Validar que los socios existan (opcional, pero defensivo)
    const existentes = await prisma.socio.findMany({
      where: { id: { in: sociosIds } },
      select: { id: true },
    });
    const setExistentes = new Set(existentes.map((s) => s.id));
    const todosExisten = sociosIds.every((id: number) => setExistentes.has(id));
    if (!todosExisten) {
      return NextResponse.json({ error: "Hay socios inexistentes" }, { status: 400 });
    }

    // Sorteo simple si no viene orden definido; cámbialo si tu lógica es otra
    const ordenIds: number[] = [...sociosIds].sort(() => Math.random() - 0.5);

    // Crea participaciones con orden 1..n en transacción
    await prisma.$transaction([
      prisma.participacion.deleteMany({ where: { rondaId } }),
      ...ordenIds.map((socioId, idx) =>
        prisma.participacion.create({
          data: { rondaId, socioId, orden: idx + 1 },
        })
      ),
    ]);

    // Recalcular fechaFin: inicio + (n - 1) * intervalo
    const intervalo = ronda.intervaloDiasCobro ?? 7;
    const n = ordenIds.length;
    const fechaFin = new Date(ronda.fechaInicio);
    fechaFin.setDate(fechaFin.getDate() + Math.max(0, (n - 1) * intervalo));

    await prisma.ronda.update({
      where: { id: rondaId },
      data: { fechaFin },
    });

    return NextResponse.json({
      ok: true,
      ordenIds,
      fechaFin: fechaFin.toISOString(),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "No se pudieron agregar participantes" }, { status: 500 });
  }
}
