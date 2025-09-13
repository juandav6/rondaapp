// app/api/rondas/[id]/orden/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// === Helpers de fecha (evitan saltos por zona horaria) ===
function toUTCNoon(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0));
}
function addDaysUTCNoon(from: Date, days: number) {
  const base = toUTCNoon(from);
  base.setUTCDate(base.getUTCDate() + days);
  return base;
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json().catch(() => ({}));
    const ordenIdsRaw = Array.isArray(body?.ordenIds) ? body.ordenIds : [];
    const ordenIds: number[] = ordenIdsRaw.map((v: any) => Number(v)).filter((v: number) => Number.isFinite(v));

    const rondaId = Number(params.id);
    if (!Number.isFinite(rondaId)) {
      return NextResponse.json({ error: "ID de ronda inválido" }, { status: 400 });
    }
    if (ordenIds.length === 0) {
      return NextResponse.json({ error: "ordenIds es requerido" }, { status: 400 });
    }

    // Trae fechaInicio + intervalo (necesarios para recalcular fechaFin)
    const ronda = await prisma.ronda.findUnique({
      where: { id: rondaId },
      select: {
        id: true,
        fechaInicio: true,
        intervaloDiasCobro: true,
      },
    });
    if (!ronda) {
      return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });
    }

    // Verificar que todos los socios pertenecen a la ronda
    const participantes = await prisma.participacion.findMany({
      where: { rondaId },
      select: { socioId: true },
    });
    const setValidos = new Set(participantes.map((p) => p.socioId));
    const todosValidos = ordenIds.every((id: number) => setValidos.has(id));
    if (!todosValidos) {
      return NextResponse.json({ error: "Hay socios que no pertenecen a la ronda" }, { status: 400 });
    }

    // Persistir orden 1..n (transacción)
    await prisma.$transaction(
      ordenIds.map((socioId: number, index: number) =>
        prisma.participacion.update({
          where: { rondaId_socioId: { rondaId, socioId } },
          data: { orden: index + 1 },
        })
      )
    );

    // Recalcular fechaFin en UTC (anclado a 12:00Z para evitar desfases)
    const intervalo = Number.isFinite(ronda.intervaloDiasCobro) && (ronda.intervaloDiasCobro ?? 0) > 0
      ? (ronda.intervaloDiasCobro as number)
      : 7;
    const n = ordenIds.length;

    // fechaFin = fechaInicio + (n-1)*intervalo días (si n=1, queda igual a la fecha de inicio)
    const fechaFin = addDaysUTCNoon(ronda.fechaInicio, Math.max(0, (n - 1) * intervalo));

    await prisma.ronda.update({
      where: { id: rondaId },
      data: { fechaFin },
    });

    // Devuelve ISO y también date-only por comodidad
    return NextResponse.json({
      ok: true,
      fechaFinISO: fechaFin.toISOString(),
      fechaFinDate: fechaFin.toISOString().slice(0, 10),
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: "No se pudo guardar el nuevo orden" }, { status: 500 });
  }
}
