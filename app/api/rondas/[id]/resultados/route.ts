// app/api/rondas/[id]/resultados/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

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

  // ── Totales globales ────────────────────────────────────────────────────────
  const totalAportes = await prisma.aporte.aggregate({
    where: { rondaId },
    _sum: { monto: true, multa: true },
  });
  const totalAhorros = await prisma.ahorro.aggregate({
    where: { rondaId },
    _sum: { monto: true },
  });

  // ── Totales por socio ───────────────────────────────────────────────────────
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

  const aporteMap = Object.fromEntries(aportesPorSocio.map((a) => [a.socioId, a]));
  const ahorroMap = Object.fromEntries(ahorrosPorSocio.map((a) => [a.socioId, a]));

  // Total aportes de la ronda (para calcular proporciones)
  const totalAportesNum = Number(totalAportes._sum.monto ?? 0);

  // ── Préstamos de la ronda con sus cuotas ────────────────────────────────────
  const prestamos = await prisma.prestamo.findMany({
    where: { rondaId },
    orderBy: { createdAt: "asc" },
    include: {
      socio: { select: { id: true, nombres: true, apellidos: true, numeroCuenta: true } },
      cuotas: { select: { interes: true, pagada: true } },
    },
  });

  // Total interés proyectado de todos los préstamos de la ronda
  const totalInteresRonda = prestamos.reduce((acc, p) => {
    return acc + p.cuotas.reduce((a, c) => a + Number(c.interes), 0);
  }, 0);

  // Total interés ya cobrado (cuotas pagadas)
  const totalInteresCobrado = prestamos.reduce((acc, p) => {
    return acc + p.cuotas.filter((c) => c.pagada).reduce((a, c) => a + Number(c.interes), 0);
  }, 0);

  // Préstamos normalizados para el frontend
  const prestamosNormalizados = prestamos.map((p) => {
    const interesTotal = p.cuotas.reduce((a, c) => a + Number(c.interes), 0);
    const interesCobrado = p.cuotas.filter((c) => c.pagada).reduce((a, c) => a + Number(c.interes), 0);
    return {
      id: p.id,
      socio: p.socio,
      monto: Number(p.monto),
      tasaAnual: Number(p.tasaAnual),
      plazoMeses: p.plazoMeses,
      fechaInicio: p.fechaInicio,
      estado: p.estado,
      saldoActual: Number(p.saldoActual),
      interesTotal: Math.round(interesTotal * 100) / 100,
      interesCobrado: Math.round(interesCobrado * 100) / 100,
    };
  });

  // ── Socios con aportes y ahorros ───────────────────────────────────────────
  const socios = ronda.participaciones.map((p) => {
    const ap = aporteMap[p.socioId]?._sum || {};
    const ah = ahorroMap[p.socioId]?._sum || {};
    const aporteSocio = Number(ap.monto ?? 0);
    const proporcion = totalAportesNum > 0 ? aporteSocio / totalAportesNum : 0;

    return {
      id: p.socio.id,
      nombres: p.socio.nombres,
      apellidos: p.socio.apellidos,
      numeroCuenta: p.socio.numeroCuenta,
      aportes: ap.monto?.toString() ?? "0",
      multas: ap.multa?.toString() ?? "0",
      ahorros: ah.monto?.toString() ?? "0",
      proporcion: Math.round(proporcion * 10000) / 100,
      orden: p.orden,
      // montoInvertido y interesGanado vienen del fondo, no de participaciones
      montoInvertido: 0,
      interesGanado: null,
      totalARecibir: null,
    };
  });

  // ── Fondo de inversión ──────────────────────────────────────────────────────
  const cuentasInversion = await prisma.cuentaInversion.findMany({
    where: { rondaId },
    include: { socio: { select: { id: true, nombres: true, apellidos: true, numeroCuenta: true } } },
    orderBy: { porcentajeParticipacion: "desc" },
  });

  const fondoTotal = cuentasInversion.reduce((s, c) => s + Number(c.montoInvertido), 0);

  return NextResponse.json({
    resumen: {
      id: ronda.id,
      nombre: ronda.nombre,
      activa: ronda.activa,
      fechaInicio: ronda.fechaInicio,
      fechaFin: ronda.fechaFin,
      totalSocios: ronda.participaciones.length,
      totalAportes: totalAportes._sum.monto?.toString() ?? "0",
      totalMultas: totalAportes._sum.multa?.toString() ?? "0",
      totalAhorros: totalAhorros._sum.monto?.toString() ?? "0",
      totalInteresProyectado: Math.round(totalInteresRonda * 100) / 100,
      totalInteresCobrado: Math.round(totalInteresCobrado * 100) / 100,
      totalFondoInversion: Math.round(fondoTotal * 100) / 100,
      fondoTotal: Math.round(fondoTotal * 100) / 100,
      totalInversores: cuentasInversion.length,
    },
    socios,
    prestamos: prestamosNormalizados,
    inversores: cuentasInversion.map(c => ({
      socio: c.socio,
      montoInvertido: Number(c.montoInvertido),
      porcentaje: Number(c.porcentajeParticipacion),
      interesesAcumulados: Number(c.interesesAcumulados),
      totalARecibir: Number(c.montoInvertido) + Number(c.interesesAcumulados),
      devuelto: c.devuelto,
    })),
  });
}
