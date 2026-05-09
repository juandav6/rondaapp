// app/api/rondas/[id]/resultados/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type Context = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: Context) {
  const { params } = await context;
  const rondaId = Number((await params).id);

  const ronda = await prisma.ronda.findUnique({
    where: { id: rondaId },
    include: { participaciones: { include: { socio: true } } },
  });
  if (!ronda) return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });

  const [totalAportesAgg, totalAhorrosAgg] = await Promise.all([
    prisma.aporte.aggregate({ where: { rondaId }, _sum: { monto: true, multa: true } }),
    prisma.ahorro.aggregate({ where: { rondaId }, _sum: { monto: true } }),
  ]);

  const [aportesPorSocio, ahorrosPorSocio] = await Promise.all([
    prisma.aporte.groupBy({ by: ["socioId"], where: { rondaId }, _sum: { monto: true, multa: true } }),
    prisma.ahorro.groupBy({ by: ["socioId"], where: { rondaId }, _sum: { monto: true } }),
  ]);

  const aporteMap = Object.fromEntries(aportesPorSocio.map(a => [a.socioId, a]));
  const ahorroMap = Object.fromEntries(ahorrosPorSocio.map(a => [a.socioId, a]));

  // Cuentas de inversión
  const cuentasInversion = await prisma.cuentaInversion.findMany({
    where: { rondaId },
  }).catch(() => []);

  const inversionMap = Object.fromEntries(cuentasInversion.map(c => [c.socioId, c]));
  const totalFondoInversion = cuentasInversion.reduce((acc, c) => acc + Number(c.montoInvertido), 0);

  // Préstamos
  const prestamos = await prisma.prestamo.findMany({
    where: { rondaId },
    include: {
      socio: { select: { id: true, nombres: true, apellidos: true, numeroCuenta: true } },
      cuotas: { select: { interes: true, capital: true, cuota: true, pagada: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const totalInteresReal = prestamos.reduce((acc, p) =>
    acc + p.cuotas.filter(c => c.pagada).reduce((a, c) => a + Number(c.interes), 0), 0
  );
  const totalInteresProyectado = prestamos.reduce((acc, p) =>
    acc + p.cuotas.reduce((a, c) => a + Number(c.interes), 0), 0
  );

  const prestamosNormalized = prestamos.map(p => {
    const totalInteres = p.cuotas.reduce((a, c) => a + Number(c.interes), 0);
    const cuotasPagadas = p.cuotas.filter(c => c.pagada).length;
    return {
      id: p.id, estado: p.estado, monto: Number(p.monto),
      tasaAnual: Number(p.tasaAnual), plazoMeses: p.plazoMeses,
      saldoActual: Number(p.saldoActual),
      totalInteres: Math.round(totalInteres * 100) / 100,
      totalAPagar: Math.round((Number(p.monto) + totalInteres) * 100) / 100,
      cuotasPagadas, totalCuotas: p.cuotas.length, socio: p.socio,
    };
  });

  // Si hay inversiones → usar montoInvertido para el %; si no → usar aportes (fallback)
  const usarInversion = cuentasInversion.length > 0;
  const baseTotal = usarInversion ? totalFondoInversion : Number(totalAportesAgg._sum.monto ?? 0);
  const interesParaDistribuir = !ronda.activa ? totalInteresReal : totalInteresProyectado;

  const socios = ronda.participaciones.map(p => {
    const ap = aporteMap[p.socioId]?._sum || {};
    const ah = ahorroMap[p.socioId]?._sum || {};
    const inv = inversionMap[p.socioId];

    const aporteSocio = Number(ap.monto ?? 0);
    const ahorroSocio = Number(ah.monto ?? 0);
    const montoInvertido = inv ? Number(inv.montoInvertido) : 0;
    const interesesAcumulados = inv ? Number(inv.interesesAcumulados) : 0;

    const base = usarInversion ? montoInvertido : aporteSocio;
    const proporcion = baseTotal > 0 ? base / baseTotal : 0;
    const pctDisplay = Math.round(proporcion * 10000) / 100;

    // Si ya se calcularon intereses en cuenta_inversion, usarlos; si no, calcular
    const interesGanado = interesesAcumulados > 0
      ? interesesAcumulados
      : Math.round(proporcion * interesParaDistribuir * 100) / 100;

    return {
      id: p.socio.id, nombres: p.socio.nombres, apellidos: p.socio.apellidos,
      numeroCuenta: p.socio.numeroCuenta,
      aportes: aporteSocio,
      ahorros: ahorroSocio,
      multas: Number(ap.multa ?? 0),
      montoInvertido,
      proporcion: pctDisplay,
      interesGanado,
      totalARecibir: Math.round((montoInvertido + interesGanado) * 100) / 100,
    };
  });

  return NextResponse.json({
    resumen: {
      id: ronda.id, nombre: ronda.nombre, activa: ronda.activa,
      fechaInicio: ronda.fechaInicio, fechaFin: ronda.fechaFin,
      totalSocios: ronda.participaciones.length,
      totalAportes: Number(totalAportesAgg._sum.monto ?? 0),
      totalMultas: Number(totalAportesAgg._sum.multa ?? 0),
      totalAhorros: Number(totalAhorrosAgg._sum.monto ?? 0),
      totalFondoInversion,
      totalInteresGenerado: Math.round(interesParaDistribuir * 100) / 100,
      totalInteresProyectado: Math.round(totalInteresProyectado * 100) / 100,
      totalPrestamos: prestamos.length,
    },
    socios,
    prestamos: prestamosNormalized,
  });
}
