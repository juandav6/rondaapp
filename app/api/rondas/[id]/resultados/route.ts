import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type Context = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: Context) {
  const { params } = await context;
  const rondaId = Number((await params).id);

  const ronda = await prisma.ronda.findUnique({
    where: { id: rondaId },
    include: {
      participaciones: {
        include: { socio: true },
      },
    },
  });
  if (!ronda) return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });

  // Totales globales
  const totalAportes = await prisma.aporte.aggregate({
    where: { rondaId },
    _sum: { monto: true, multa: true },
  });

  const totalAhorros = await prisma.ahorro.aggregate({
    where: { rondaId },
    _sum: { monto: true },
  });

  // Totales por socio
  const aportesPorSocio = await prisma.aporte.groupBy({
    by: ["socioId"],
    where: { rondaId },
    _sum: { monto: true, multa: true },
  });

  const ahorrosPorSocio = await prisma.ahorro.groupBy({
    by: ["socioId"],
    where: { rondaId },
    _sum: { monto: true },
  });

  const aporteMap = Object.fromEntries(aportesPorSocio.map(a => [a.socioId, a]));
  const ahorroMap = Object.fromEntries(ahorrosPorSocio.map(a => [a.socioId, a]));

  const socios = ronda.participaciones.map(p => {
    const ap = aporteMap[p.socioId]?._sum || {};
    const ah = ahorroMap[p.socioId]?._sum || {};

    return {
      id: p.socio.id,
      nombres: p.socio.nombres,
      apellidos: p.socio.apellidos,
      numeroCuenta: p.socio.numeroCuenta,
      aportes: ap.monto?.toString() ?? "0",
      multas: ap.multa?.toString() ?? "0",
      ahorros: ah.monto?.toString() ?? "0",
    };
  });

  return NextResponse.json({
    resumen: {
      id: ronda.id,
      nombre: ronda.nombre,
      fechaInicio: ronda.fechaInicio,
      fechaFin: ronda.fechaFin,
      totalSocios: ronda.participaciones.length,
      totalAportes: totalAportes._sum.monto?.toString() ?? "0",
      totalMultas: totalAportes._sum.multa?.toString() ?? "0",
      totalAhorros: totalAhorros._sum.monto?.toString() ?? "0",
    },
    socios,
  });
}
