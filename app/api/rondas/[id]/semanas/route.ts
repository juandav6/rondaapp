// app/api/rondas/[id]/semanas/route.ts
// GET  → detalle de todas las semanas con aportes, ahorros, responsable y observaciones
// PUT  → actualizar observaciones de una semana específica
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Context) {
  const rondaId = Number((await ctx.params).id);
  if (!Number.isFinite(rondaId))
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    const [ronda, participaciones, aportes, ahorros, responsables] = await Promise.all([
      prisma.ronda.findUnique({
        where: { id: rondaId },
        select: { id: true, nombre: true, semanaActual: true, montoAporte: true, fechaInicio: true, intervaloDiasCobro: true },
      }),
      prisma.participacion.findMany({
        where: { rondaId },
        include: { socio: { select: { id: true, nombres: true, apellidos: true, numeroCuenta: true } } },
        orderBy: { orden: "asc" },
      }),
      prisma.aporte.findMany({
        where: { rondaId },
        select: { socioId: true, semana: true, monto: true, multa: true, observaciones: true },
      }),
      prisma.ahorro.findMany({
        where: { rondaId },
        select: { socioId: true, semana: true, monto: true },
      }),
      prisma.responsableCobroSemana.findMany({
        where: { rondaId },
        include: { socio: { select: { nombres: true, apellidos: true } } },
        orderBy: { semana: "asc" },
      }),
    ]);

    if (!ronda) return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });

    const semanaActual = ronda.semanaActual;
    const totalSemanas = participaciones.length;

    // Agrupar aportes y ahorros por semana
    const aportesPorSemana = new Map<number, { total: number; pagados: number; multas: number }>();
    aportes.forEach(a => {
      const prev = aportesPorSemana.get(a.semana) ?? { total: 0, pagados: 0, multas: 0 };
      aportesPorSemana.set(a.semana, {
        total: prev.total + Number(a.monto),
        pagados: prev.pagados + 1,
        multas: prev.multas + Number(a.multa),
      });
    });

    const ahorrosPorSemana = new Map<number, number>();
    ahorros.forEach(a => {
      ahorrosPorSemana.set(a.semana, (ahorrosPorSemana.get(a.semana) ?? 0) + Number(a.monto));
    });

    const responsableMap = new Map(responsables.map(r => [r.semana, r]));

    // Construir semanas cerradas (semanaActual - 1 hacia atrás)
    const semanas = Array.from({ length: semanaActual - 1 }, (_, i) => {
      const sem = i + 1;
      const resp = responsableMap.get(sem);
      const ap = aportesPorSemana.get(sem) ?? { total: 0, pagados: 0, multas: 0 };
      const ahorro = ahorrosPorSemana.get(sem) ?? 0;
      const idx = participaciones.length > 0 ? ((sem - 1) % participaciones.length) : 0;
      const receptor = participaciones[idx];

      return {
        semana: sem,
        responsableId: resp?.socioId ?? null,
        responsableNombre: resp ? `${resp.socio.nombres} ${resp.socio.apellidos}` : null,
        observaciones: resp?.observaciones ?? "",
        receptor: receptor ? {
          socioId: receptor.socioId,
          nombre: `${receptor.socio.nombres} ${receptor.socio.apellidos}`,
        } : null,
        totalAportes: ap.total,
        sociosPagaron: ap.pagados,
        totalSocios: totalSemanas,
        totalMultas: ap.multas,
        totalAhorros: ahorro,
        cerrada: true,
      };
    });

    return NextResponse.json({
      ronda: {
        ...ronda,
        montoAporte: Number(ronda.montoAporte),
      },
      semanas: semanas.reverse(), // más reciente primero
      totalCerradas: semanas.length,
      totalSemanas,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}

export async function PUT(req: Request, ctx: Context) {
  const rondaId = Number((await ctx.params).id);
  if (!Number.isFinite(rondaId))
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    const { semana, observaciones } = await req.json();
    if (!semana || typeof semana !== "number")
      return NextResponse.json({ error: "semana requerida" }, { status: 400 });

    // Upsert — si no existe el responsable de esa semana, igual guardamos
    const existing = await prisma.responsableCobroSemana.findUnique({
      where: { rondaId_semana: { rondaId, semana } },
    });

    if (existing) {
      await prisma.responsableCobroSemana.update({
        where: { rondaId_semana: { rondaId, semana } },
        data: { observaciones: observaciones ?? "" },
      });
    } else {
      // Buscar socio receptor de esa semana para crear el registro
      const receptor = await prisma.participacion.findFirst({
        where: { rondaId, orden: semana },
        select: { socioId: true },
      });
      if (!receptor)
        return NextResponse.json({ error: "No se encontró participación para esa semana" }, { status: 404 });

      await prisma.responsableCobroSemana.create({
        data: { rondaId, semana, socioId: receptor.socioId, observaciones: observaciones ?? "" },
      });
    }

    return NextResponse.json({ ok: true, semana, observaciones });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
