import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";

type Context = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: Context) {
  const { params } = await context;
  const rondaId = Number((await params).id);

  const ronda = await prisma.ronda.findUnique({
    where: { id: rondaId },
    include: {
      participaciones: { include: { socio: true } },
    },
  });
  if (!ronda) return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });

  // Aportes por socio (sumas)
  const aportesAgg = await prisma.aporte.groupBy({
    by: ["socioId"],
    where: { rondaId },
    _sum: { monto: true, multa: true },
  });

  // Ahorros por socio (sumas)
  const ahorrosAgg = await prisma.ahorro.groupBy({
    by: ["socioId"],
    where: { rondaId },
    _sum: { monto: true },
  });

  const aportesBy: Record<number, { monto: Decimal; multa: Decimal }> = {};
  for (const a of aportesAgg) {
    aportesBy[a.socioId] = {
      monto: (a._sum.monto ?? new Decimal(0)) as Decimal,
      multa: (a._sum.multa ?? new Decimal(0)) as Decimal,
    };
  }

  const ahorrosBy: Record<number, Decimal> = {};
  for (const a of ahorrosAgg) {
    ahorrosBy[a.socioId] = (a._sum.monto ?? new Decimal(0)) as Decimal;
  }

  const detallePorSocio = ronda.participaciones
    .sort((a, b) => a.orden - b.orden)
    .map((p) => {
      const aporte = aportesBy[p.socioId]?.monto ?? new Decimal(0);
      const multa = aportesBy[p.socioId]?.multa ?? new Decimal(0);
      const ahorro = ahorrosBy[p.socioId] ?? new Decimal(0);
      return {
        socioId: p.socioId,
        socio: {
          nombres: p.socio.nombres,
          apellidos: p.socio.apellidos,
          numeroCuenta: p.socio.numeroCuenta,
        },
        aporteTotal: aporte.toString(),
        multasTotal: multa.toString(),
        ahorroTotal: ahorro.toString(),
      };
    });

  // Totales de ronda
  const totalSemanas = ronda.participaciones.length;
  const totalAportes = detallePorSocio.reduce((acc, x) => acc.plus(x.aporteTotal), new Decimal(0));
  const totalMultas  = detallePorSocio.reduce((acc, x) => acc.plus(x.multasTotal), new Decimal(0));
  const totalAhorros = detallePorSocio.reduce((acc, x) => acc.plus(x.ahorroTotal), new Decimal(0));

  // Intereses generados (si tuvieras regla; por ahora 0)
  const interesesGenerados = new Decimal(0);

  return NextResponse.json({
    ronda: {
      id: ronda.id,
      nombre: ronda.nombre,
      fechaInicio: ronda.fechaInicio.toISOString(),
      fechaFin: ronda.fechaFin?.toISOString() ?? null,
      duracionSemanas: totalSemanas, // definido por #participantes
      montoAporte: ronda.montoAporte.toString(),
      ahorroObjetivoPorSocio: ronda.ahorroObjetivoPorSocio.toString(),
    },
    totales: {
      totalRecaudado: totalAportes.toString(),
      totalMultas: totalMultas.toString(),
      totalAhorros: totalAhorros.toString(),
      interesesGenerados: interesesGenerados.toString(),
    },
    detallePorSocio,
  });
}
