// app/api/rondas/[id]/fondo/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
type Params = Promise<{ id: string }>;

export async function GET(_req: Request, ctx: { params: Params }) {
  const { id } = await ctx.params;
  const rondaId = Number(id);
  if (!Number.isFinite(rondaId))
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    const [ronda, inversores, prestamos, movimientos] = await Promise.all([
      (prisma.ronda as any).findUnique({
        where: { id: rondaId },
        select: {
          id: true, nombre: true, activa: true,
          saldoFondoDisponible: true,
        },
      }),
      prisma.cuentaInversion.findMany({
        where: { rondaId },
        include: { socio: { select: { nombres: true, apellidos: true, numeroCuenta: true } } },
        orderBy: { porcentajeParticipacion: "desc" },
      }),
      prisma.prestamo.findMany({
        where: { rondaId },
        include: {
          socio: { select: { nombres: true, apellidos: true } },
          cuotas: { orderBy: { numero: "asc" } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.movimientoCuenta.findMany({
        where: {
          rondaId,
          tipo: { in: ["PRESTAMO_SALIDA", "PRESTAMO_COBRO", "INTERES", "INVERSION", "DEVOLUCION"] },
        },
        include: { socio: { select: { nombres: true, apellidos: true } } },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    if (!ronda) return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });

    const fondoTotal = inversores.reduce((s: number, i: any) => s + Number(i.montoInvertido), 0);
    const fondoDisponible = Number(ronda.saldoFondoDisponible ?? 0);
    const fondoPrestado = prestamos
      .filter((p: any) => p.estado === "ACTIVO")
      .reduce((s: number, p: any) => s + Number(p.saldoActual), 0);
    const interesesAcumulados = inversores.reduce((s: number, i: any) => s + Number(i.interesesAcumulados), 0);
    const capitalRecuperado = movimientos
      .filter((m: any) => m.tipo === "PRESTAMO_COBRO")
      .reduce((s: number, m: any) => s + Number(m.monto), 0);

    return NextResponse.json({
      ronda: { id: ronda.id, nombre: ronda.nombre, activa: ronda.activa },
      resumen: {
        fondoTotal,
        fondoDisponible,
        fondoPrestado,
        interesesAcumulados,
        capitalRecuperado,
        totalInversores: inversores.length,
        prestamosActivos: prestamos.filter((p: any) => p.estado === "ACTIVO").length,
        prestamosCancelados: prestamos.filter((p: any) => p.estado === "CANCELADO").length,
      },
      inversores: inversores.map((i: any) => ({
        socio: i.socio,
        montoInvertido: Number(i.montoInvertido),
        porcentaje: Number(i.porcentajeParticipacion),
        interesesAcumulados: Number(i.interesesAcumulados),
        totalARecibir: Number(i.montoInvertido) + Number(i.interesesAcumulados),
        devuelto: i.devuelto,
      })),
      prestamos: prestamos.map((p: any) => ({
        id: p.id,
        socio: p.socio,
        monto: Number(p.monto),
        saldoActual: Number(p.saldoActual),
        estado: p.estado,
        cuotasPagadas: p.cuotas.filter((c: any) => c.pagada).length,
        totalCuotas: p.cuotas.length,
        capitalRecuperado: p.cuotas.filter((c: any) => c.pagada).reduce((s: number, c: any) => s + Number(c.capital), 0),
        interesGenerado: p.cuotas.filter((c: any) => c.pagada).reduce((s: number, c: any) => s + Number(c.interes), 0),
      })),
      movimientos: movimientos.map((m: any) => ({
        id: m.id,
        tipo: m.tipo,
        monto: Number(m.monto),
        nota: m.nota,
        socio: m.socio,
        fecha: m.createdAt,
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}

// PUT /api/rondas/[id]/fondo — recalcular porcentajes de participación
export async function PUT(req: Request, ctx: any) {
  try {
    const rondaId = Number((await ctx.params).id);
    const body = await req.json().catch(() => ({}));

    if (!body?.recalcularPorcentajes) {
      return NextResponse.json({ error: "Acción no reconocida" }, { status: 400 });
    }

    const cuentas = await prisma.cuentaInversion.findMany({
      where: { rondaId },
      select: { id: true, socioId: true, montoInvertido: true },
    });

    if (cuentas.length === 0)
      return NextResponse.json({ ok: true, mensaje: "Sin inversores" });

    const fondoTotal = cuentas.reduce((s, c) => s + Number(c.montoInvertido), 0);
    if (fondoTotal <= 0)
      return NextResponse.json({ error: "Fondo total es 0" }, { status: 400 });

    // Actualizar porcentajes
    await prisma.$transaction(cuentas.map(c => {
      const pct = Math.round((Number(c.montoInvertido) / fondoTotal) * 1000000) / 10000; // 4 decimales
      return prisma.cuentaInversion.update({
        where: { id: c.id },
        data: { porcentajeParticipacion: pct },
      });
    }));

    return NextResponse.json({ ok: true, fondoTotal, inversores: cuentas.length });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
