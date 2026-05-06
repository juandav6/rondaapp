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

  // ── Totales globales ──────────────────────────────────────────────────────
  const [totalAportes, totalAhorros] = await Promise.all([
    prisma.aporte.aggregate({ where: { rondaId }, _sum: { monto: true, multa: true } }),
    prisma.ahorro.aggregate({ where: { rondaId }, _sum: { monto: true } }),
  ]);

  // ── Totales por socio ─────────────────────────────────────────────────────
  const [aportesPorSocio, ahorrosPorSocio] = await Promise.all([
    prisma.aporte.groupBy({ by: ["socioId"], where: { rondaId }, _sum: { monto: true, multa: true } }),
    prisma.ahorro.groupBy({ by: ["socioId"], where: { rondaId }, _sum: { monto: true } }),
  ]);

  const aporteMap = Object.fromEntries(aportesPorSocio.map((a) => [a.socioId, a]));
  const ahorroMap = Object.fromEntries(ahorrosPorSocio.map((a) => [a.socioId, a]));

  const totalAportesRonda = Number(totalAportes._sum.monto ?? 0);

  // ── Préstamos de la ronda con sus cuotas ──────────────────────────────────
  const prestamos = await prisma.prestamo.findMany({
    where: { rondaId },
    include: {
      socio: { select: { id: true, nombres: true, apellidos: true, numeroCuenta: true } },
      cuotas: { select: { interes: true, capital: true, cuota: true, pagada: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  // Total interés proyectado de TODOS los préstamos de la ronda
  const totalInteresRonda = prestamos.reduce((acc, p) => {
    return acc + p.cuotas.reduce((a, c) => a + Number(c.interes), 0);
  }, 0);

  // Normalizar préstamos para el frontend
  const prestamosNormalized = prestamos.map((p) => {
    const totalInteresPrestamo = p.cuotas.reduce((a, c) => a + Number(c.interes), 0);
    const totalCapital = Number(p.monto);
    const totalAPagar = totalCapital + totalInteresPrestamo;
    const cuotasPagadas = p.cuotas.filter((c) => c.pagada).length;

    return {
      id: p.id,
      estado: p.estado,
      monto: Number(p.monto),
      tasaAnual: Number(p.tasaAnual),
      plazoMeses: p.plazoMeses,
      saldoActual: Number(p.saldoActual),
      totalInteres: Math.round(totalInteresPrestamo * 100) / 100,
      totalAPagar: Math.round(totalAPagar * 100) / 100,
      cuotasPagadas,
      totalCuotas: p.cuotas.length,
      socio: p.socio,
    };
  });

  // ── Socios con su parte proporcional de intereses ─────────────────────────
  const socios = ronda.participaciones.map((p) => {
    const ap = aporteMap[p.socioId]?._sum || {};
    const ah = ahorroMap[p.socioId]?._sum || {};
    const aporteSocio = Number(ap.monto ?? 0);

    // Proporción = aportes del socio / total aportes de la ronda
    const proporcion = totalAportesRonda > 0 ? aporteSocio / totalAportesRonda : 0;
    const interesGanado = Math.round(proporcion * totalInteresRonda * 100) / 100;

    return {
      id: p.socio.id,
      nombres: p.socio.nombres,
      apellidos: p.socio.apellidos,
      numeroCuenta: p.socio.numeroCuenta,
      aportes: aporteSocio,
      multas: Number(ap.multa ?? 0),
      ahorros: Number(ah.monto ?? 0),
      proporcion: Math.round(proporcion * 10000) / 100, // % con 2 decimales
      interesGanado,
    };
  });

  return NextResponse.json({
    resumen: {
      id: ronda.id,
      nombre: ronda.nombre,
      activa: ronda.activa,
      fechaInicio: ronda.fechaInicio,
      fechaFin: ronda.fechaFin,
      totalSocios: ronda.participaciones.length,
      totalAportes: totalAportesRonda,
      totalMultas: Number(totalAportes._sum.multa ?? 0),
      totalAhorros: Number(totalAhorros._sum.monto ?? 0),
      totalInteresGenerado: Math.round(totalInteresRonda * 100) / 100,
      totalPrestamos: prestamos.length,
    },
    socios,
    prestamos: prestamosNormalized,
  });
}
