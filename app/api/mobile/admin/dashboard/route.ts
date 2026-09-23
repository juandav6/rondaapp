// app/api/mobile/admin/dashboard/route.ts
// Mismo cálculo que app/api/dashboard/stats, protegido con Bearer JWT (solo ADMIN).
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireMobileAdmin } from "@/lib/mobile-auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = requireMobileAdmin(req);
  if ("error" in auth) return auth.error;

  try {
    const todasRondas = await prisma.ronda.findMany({
      orderBy: { fechaInicio: "desc" },
      select: { id: true, nombre: true, activa: true, fechaInicio: true, fechaFin: true },
    });

    const rondaActual = todasRondas.find(r => r.activa) ?? todasRondas[0] ?? null;
    const rondaAnterior = todasRondas.find(r => !r.activa && r.id !== rondaActual?.id) ?? null;

    const totalSocios = await prisma.socio.count();

    const sociosRondaActual = rondaActual
      ? await prisma.participacion.count({ where: { rondaId: rondaActual.id } })
      : 0;
    const sociosRondaAnterior = rondaAnterior
      ? await prisma.participacion.count({ where: { rondaId: rondaAnterior.id } })
      : 0;

    const ahorrosAgg = await prisma.socio.aggregate({ _sum: { saldoAhorros: true } });
    const totalAhorros = Number(ahorrosAgg._sum.saldoAhorros ?? 0);

    const ahorrosRondaActualAgg = rondaActual
      ? await prisma.ahorro.aggregate({ where: { rondaId: rondaActual.id }, _sum: { monto: true } })
      : null;
    const ahorrosRondaActual = Number(ahorrosRondaActualAgg?._sum?.monto ?? 0);

    const ahorrosRondaAnteriorAgg = rondaAnterior
      ? await prisma.ahorro.aggregate({ where: { rondaId: rondaAnterior.id }, _sum: { monto: true } })
      : null;
    const ahorrosRondaAnterior = Number(ahorrosRondaAnteriorAgg?._sum?.monto ?? 0);

    const prestamosActivosAgg = rondaActual
      ? await prisma.prestamo.aggregate({
          where: { rondaId: rondaActual.id, estado: "ACTIVO" },
          _sum: { saldoActual: true },
          _count: true,
        })
      : null;
    const saldoPrestamosActual = Number(prestamosActivosAgg?._sum?.saldoActual ?? 0);
    const numPrestamosActivos = prestamosActivosAgg?._count ?? 0;

    const prestamosAnterioresAgg = rondaAnterior
      ? await prisma.prestamo.aggregate({ where: { rondaId: rondaAnterior.id }, _sum: { saldoActual: true } })
      : null;
    const saldoPrestamosAnterior = Number(prestamosAnterioresAgg?._sum?.saldoActual ?? 0);

    const inicioMes = new Date();
    inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0);
    const finMes = new Date();
    finMes.setHours(23, 59, 59, 999);

    const depositosMesAgg = await prisma.movimientoCuenta.aggregate({
      where: { tipo: "AHORRO", rondaId: null, createdAt: { gte: inicioMes, lte: finMes } },
      _sum: { monto: true },
    });
    const depositosMes = Number(depositosMesAgg._sum?.monto ?? 0);

    const inicioMesAnt = new Date();
    inicioMesAnt.setMonth(inicioMesAnt.getMonth() - 1);
    inicioMesAnt.setDate(1); inicioMesAnt.setHours(0, 0, 0, 0);
    const finMesAnt = new Date();
    finMesAnt.setDate(0); finMesAnt.setHours(23, 59, 59, 999);

    const depositosMesAntAgg = await prisma.movimientoCuenta.aggregate({
      where: { tipo: "AHORRO", rondaId: null, createdAt: { gte: inicioMesAnt, lte: finMesAnt } },
      _sum: { monto: true },
    });
    const depositosMesAnterior = Number(depositosMesAntAgg._sum?.monto ?? 0);

    const retirosMesAgg = await prisma.movimientoCuenta.aggregate({
      where: { tipo: "RETIRO", createdAt: { gte: inicioMes, lte: finMes } },
      _sum: { monto: true },
    });
    const retirosMes = Number(retirosMesAgg._sum?.monto ?? 0);

    const retirosMesAntAgg = await prisma.movimientoCuenta.aggregate({
      where: { tipo: "RETIRO", createdAt: { gte: inicioMesAnt, lte: finMesAnt } },
      _sum: { monto: true },
    });
    const retirosMesAnterior = Number(retirosMesAntAgg._sum?.monto ?? 0);

    function pctDiff(actual: number, anterior: number) {
      if (anterior === 0) return actual > 0 ? 100 : 0;
      return ((actual - anterior) / anterior) * 100;
    }
    function absDiff(actual: number, anterior: number) {
      return actual - anterior;
    }

    return NextResponse.json({
      totalSocios,
      totalAhorros,
      saldoPrestamosActual,
      numPrestamosActivos,
      depositosMes,
      retirosMes,
      rondaActualId: rondaActual?.id ?? null,
      rondaAnteriorId: rondaAnterior?.id ?? null,
      rondaActualNombre: rondaActual?.nombre ?? null,
      sociosRondaActual,
      sociosRondaAnterior,
      ahorrosRondaActual,
      ahorrosRondaAnterior,
      diff: {
        socios: { abs: absDiff(sociosRondaActual, sociosRondaAnterior), pct: pctDiff(sociosRondaActual, sociosRondaAnterior) },
        ahorros: { abs: absDiff(ahorrosRondaActual, ahorrosRondaAnterior), pct: pctDiff(ahorrosRondaActual, ahorrosRondaAnterior) },
        prestamos: { abs: absDiff(saldoPrestamosActual, saldoPrestamosAnterior), pct: pctDiff(saldoPrestamosActual, saldoPrestamosAnterior) },
        depositos: { abs: absDiff(depositosMes, depositosMesAnterior), pct: pctDiff(depositosMes, depositosMesAnterior) },
        retiros: { abs: absDiff(retirosMes, retirosMesAnterior), pct: pctDiff(retirosMes, retirosMesAnterior) },
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error" }, { status: 500 });
  }
}
