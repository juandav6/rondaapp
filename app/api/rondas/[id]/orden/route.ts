// app/api/rondas/[id]/orden/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const { ordenIds } = await req.json();
    const rondaId = Number(params.id);

    if (!Array.isArray(ordenIds) || ordenIds.length === 0) {
      return NextResponse.json({ error: "ordenIds es requerido" }, { status: 400 });
    }

    // 👇 incluye intervaloDiasCobro en el select (o elimina select)
    const ronda = await prisma.ronda.findUnique({
      where: { id: rondaId },
      select: {
        id: true,
        fechaInicio: true,
        intervaloDiasCobro: true,
      },
    });
    if (!ronda) return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });

    // Verifica pertenencia de socios a la ronda
    const participantes = await prisma.participacion.findMany({
      where: { rondaId },
      select: { socioId: true },
    });
    const setValidos = new Set(participantes.map((p) => p.socioId));
    const todosValidos = ordenIds.every((id: number) => setValidos.has(id));
    if (!todosValidos) {
      return NextResponse.json({ error: "Hay socios que no pertenecen a la ronda" }, { status: 400 });
    }

    // Persistir orden 1..n en transacción
    await prisma.$transaction(
      ordenIds.map((socioId: number, index: number) =>
        prisma.participacion.update({
          where: { rondaId_socioId: { rondaId, socioId } },
          data: { orden: index + 1 },
        })
      )
    );

    // Recalcular fechaFin
    const intervalo = ronda.intervaloDiasCobro ?? 7;
    const n = ordenIds.length;
    const fechaFin = new Date(ronda.fechaInicio);
    fechaFin.setDate(fechaFin.getDate() + Math.max(0, (n - 1) * intervalo));

    await prisma.ronda.update({
      where: { id: rondaId },
      data: { fechaFin },
    });

    return NextResponse.json({ ok: true, fechaFin: fechaFin.toISOString() });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: "No se pudo guardar el nuevo orden" }, { status: 500 });
  }
}
