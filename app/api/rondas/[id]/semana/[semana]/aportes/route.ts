// app/api/rondas/[id]/semana/[semana]/aportes/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";

export const runtime = "nodejs"; // 👈 IMPORTANTE con Prisma en Vercel

type Params = Promise<{ id: string; semana: string }>;

export async function GET(_req: NextRequest, ctx: { params: Params }) {
  try {
    const { id, semana } = await ctx.params; // Next 15: params es Promise
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
        participaciones: { include: { socio: true }, orderBy: { orden: "asc" } },
      },
    });
    if (!ronda) return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });

    const objetivo = Number(ronda.ahorroObjetivoPorSocio ?? 0);
    const socioIds = ronda.participaciones.map((p) => p.socioId);

    const [acums, semanaMarks, aportesSemana] = await Promise.all([
      prisma.ahorro.groupBy({
        by: ["socioId"],
        where: { rondaId, socioId: { in: socioIds } },
        _sum: { monto: true },
      }),
      prisma.ahorro.findMany({ where: { rondaId, semana: semanaNum }, select: { socioId: true } }),
      prisma.aporte.findMany({ where: { rondaId, semana: semanaNum }, select: { socioId: true } }),
    ]);

    const acumMap = new Map(acums.map((a) => [a.socioId, Number(a._sum.monto ?? 0)]));
    const marcadoSemana = new Set(semanaMarks.map((a) => a.socioId));
    const pagadosSemana = new Set(aportesSemana.map((a) => a.socioId));

    const items = ronda.participaciones.map((p) => {
      const ahorroAcumulado = acumMap.get(p.socioId) ?? 0;
      const ahorroRestante = Math.max(objetivo - ahorroAcumulado, 0);
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
        ahorroRegistradoSemana: marcadoSemana.has(p.socioId),
      };
    });

    return NextResponse.json({
      ronda: {
        id: ronda.id,
        nombre: ronda.nombre,
        semanaActual: ronda.semanaActual,
        montoAporte: ronda.montoAporte.toString(),
        ahorroObjetivoPorSocio: (ronda.ahorroObjetivoPorSocio ?? new Decimal(0)).toString(),
      },
      semana: semanaNum,
      totalParticipantes: ronda.participaciones.length,
      items,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error inesperado" }, { status: 500 });
  }
}
