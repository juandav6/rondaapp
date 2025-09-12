import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getParams } from "@/lib/getParams";
export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: { params: { id: string; semana: string } } | { params: Promise<{ id: string; semana: string }> }) {
  try {
    const { id, semana } = await getParams((ctx as any).params);
    const rondaId = Number(id);
    const semanaNum = Number(semana);

    if (!Number.isFinite(rondaId) || !Number.isFinite(semanaNum)) {
      return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
    }

   const ronda = await prisma.ronda.findUnique({ where: { id: rondaId } });
    if (!ronda) return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });


    const objetivo = Number(ronda.ahorroObjetivoPorSocio ?? 0);
    const socioIds = ronda.participaciones.map((p) => p.socioId);

    const [acums, semanaMarks, aportesSemana] = await Promise.all([
      prisma.ahorro.groupBy({
        by: ["socioId"],
        where: { rondaId, socioId: { in: socioIds } },
        _sum: { monto: true },
      }),
      prisma.ahorro.findMany({
        where: { rondaId, semana: semanaNum },
        select: { socioId: true },
      }),
      prisma.aporte.findMany({
        where: { rondaId, semana: semanaNum },
        select: { socioId: true },
      }),
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
        pagado: pagadosSemana.has(p.socioId),              // ✅ esto hace desaparecer el botón
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
        ahorroObjetivoPorSocio: ronda.ahorroObjetivoPorSocio.toString(),
      },
      semana: semanaNum,
      totalParticipantes: await prisma.participacion.count({ where: { rondaId } }),
      items: [], // ← rellena con tu cálculo real
    });
  } catch (e: any) {
    console.error("GET /api/rondas/[id]/semana/[semana]/aportes", e);
    return NextResponse.json({ error: e?.message ?? "Error interno" }, { status: 500 });
  }
}
