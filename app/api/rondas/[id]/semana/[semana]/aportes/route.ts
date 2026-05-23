// app/api/rondas/[id]/semana/[semana]/aportes/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
export const runtime = "nodejs";

type Params = Promise<{ id: string; semana: string }>;

export async function GET(_req: NextRequest, ctx: { params: Params }) {
  try {
    const { id, semana } = await ctx.params;
    const rondaId = Number(id);
    const semanaNum = Number(semana);
    if (!Number.isFinite(rondaId) || !Number.isFinite(semanaNum)) {
      return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
    }

    const ronda = await prisma.ronda.findUnique({
      where: { id: rondaId },
      select: {
        id: true,
        nombre: true,
        semanaActual: true,
        montoAporte: true,
        ahorroObjetivoPorSocio: true,
        responsableId: true,
        fechaInicio: true,
        fechaFin: true,
        intervaloDiasCobro: true,
        participaciones: { include: { socio: true }, orderBy: { orden: "asc" } },
      },
    });
    if (!ronda) return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });

    const objetivo = Number(ronda.ahorroObjetivoPorSocio ?? 0);
    const socioIds = ronda.participaciones.map((p) => p.socioId);

    const [acums, ahorrosSemana, aportesSemana, responsableSemana, ahorrosParciales] = await Promise.all([
      // Ahorros acumulados totales por socio participante
      prisma.ahorro.groupBy({
        by: ["socioId"],
        where: { rondaId, socioId: { in: socioIds } },
        _sum: { monto: true },
      }),
      // Ahorros de esta semana específica (participantes)
      prisma.ahorro.findMany({
        where: { rondaId, semana: semanaNum, socioId: { in: socioIds } },
        select: { socioId: true, monto: true },
      }),
      // Aportes de esta semana (para saber quién pagó)
      prisma.aporte.findMany({
        where: { rondaId, semana: semanaNum },
        select: { socioId: true, monto: true },
      }),
      // Responsable de esta semana
      prisma.responsableCobroSemana.findUnique({
        where: { rondaId_semana: { rondaId, semana: semanaNum } },
        select: { socioId: true },
      }),
      // Socios que tienen ahorros en esta ronda pero NO son participantes (socios parciales)
      prisma.ahorro.findMany({
        where: { rondaId, socioId: { notIn: socioIds.length > 0 ? socioIds : [-1] } },
        include: { socio: { select: { id: true, nombres: true, apellidos: true, numeroCuenta: true, saldoAhorros: true } } },
      }),
    ]);

    const acumMap = new Map(acums.map((a) => [a.socioId, Number(a._sum.monto ?? 0)]));

    // Ahorros de esta semana por socio
    const ahorroSemanaMap = new Map<number, number>();
    for (const a of ahorrosSemana) {
      ahorroSemanaMap.set(a.socioId, (ahorroSemanaMap.get(a.socioId) ?? 0) + Number(a.monto));
    }

    const marcadoSemana = new Set(ahorrosSemana.map((a) => a.socioId));
    const pagadosSemana = new Set(aportesSemana.map((a) => a.socioId));

    const items = ronda.participaciones.map((p) => {
      const ahorroAcumulado = acumMap.get(p.socioId) ?? 0;
      const ahorroRestante = Math.max(objetivo - ahorroAcumulado, 0);
      const ahorroSemana = ahorroSemanaMap.get(p.socioId) ?? 0;

      return {
        socioId: p.socioId,
        socio: {
          nombres: p.socio.nombres,
          apellidos: p.socio.apellidos,
          numeroCuenta: p.socio.numeroCuenta,
        },
        orden: p.orden,
        pagado: pagadosSemana.has(p.socioId),
        monto: null,
        multa: "0",
        ahorroAcumulado: ahorroAcumulado.toFixed(2),
        ahorroRestante: ahorroRestante.toFixed(2),
        ahorroSemana: ahorroSemana.toFixed(2),           // ← nuevo
        ahorroRegistradoSemana: marcadoSemana.has(p.socioId),
      };
    });

    // Totales semana
    const totalAportesSemana = aportesSemana
      .reduce((s, a) => s + Number(a.monto), 0)
      .toFixed(2);
    const totalAhorrosSemana = Array.from(ahorroSemanaMap.values())
      .reduce((s, v) => s + v, 0)
      .toFixed(2);

    return NextResponse.json({
      ronda: {
        id: ronda.id,
        nombre: ronda.nombre,
        semanaActual: ronda.semanaActual,
        montoAporte: ronda.montoAporte.toString(),
        ahorroObjetivoPorSocio: (ronda.ahorroObjetivoPorSocio ?? new Decimal(0)).toString(),
        responsableId: ronda.responsableId ?? null,
        fechaInicio: ronda.fechaInicio?.toISOString() ?? null,
        fechaInicioISO: ronda.fechaInicio?.toISOString() ?? null,
        fechaInicioDate: ronda.fechaInicio?.toISOString().slice(0, 10) ?? null,
        intervaloDiasCobro: ronda.intervaloDiasCobro,
      },
      semana: semanaNum,
      totalParticipantes: ronda.participaciones.length,
      responsableId: responsableSemana?.socioId ?? ronda.responsableId ?? null,
      totalAportesSemana,
      totalAhorrosSemana,
      items,
      sociosParciales: (() => {
        // Agrupar por socio
        const parcialMap = new Map<number, { socio: any; ahorros: { semana: number; monto: number }[]; totalAcumulado: number }>();
        for (const a of ahorrosParciales) {
          if (!parcialMap.has(a.socioId)) {
            parcialMap.set(a.socioId, { socio: a.socio, ahorros: [], totalAcumulado: 0 });
          }
          const entry = parcialMap.get(a.socioId)!;
          entry.ahorros.push({ semana: a.semana, monto: Number(a.monto) });
          entry.totalAcumulado += Number(a.monto);
        }
        return Array.from(parcialMap.values()).map(p => ({
          socioId: p.socio.id,
          socio: { nombres: p.socio.nombres, apellidos: p.socio.apellidos, numeroCuenta: p.socio.numeroCuenta, saldoAhorros: Number(p.socio.saldoAhorros) },
          ahorroSemanaActual: Number(ahorrosParciales.find(a => a.socioId === p.socio.id && a.semana === semanaNum)?.monto ?? 0),
          ahorroRegistradoSemana: ahorrosParciales.some(a => a.socioId === p.socio.id && a.semana === semanaNum),
          totalAcumulado: p.totalAcumulado,
          objetivo: Number(ronda.ahorroObjetivoPorSocio ?? 0),
          ahorroRestante: Math.max(Number(ronda.ahorroObjetivoPorSocio ?? 0) - p.totalAcumulado, 0),
          historial: p.ahorros.sort((a, b) => a.semana - b.semana),
        })).sort((a, b) => a.socio.apellidos.localeCompare(b.socio.apellidos));
      })(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error inesperado" }, { status: 500 });
  }
}
