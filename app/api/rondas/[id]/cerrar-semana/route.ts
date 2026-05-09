// app/api/rondas/[id]/cerrar-semana/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

type Context = { params: Promise<{ id: string }> };

const MULTA_BASE = 100;

/** Ejecuta la devolución de inversiones al cierre de la ronda */
async function devolverInversiones(rondaId: number) {
  // 1. Obtener todas las cuentas de inversión de esta ronda no devueltas
  const cuentas = await prisma.cuentaInversion.findMany({
    where: { rondaId, devuelto: false },
    include: { socio: { select: { id: true, nombres: true, saldoAhorros: true } } },
  });

  if (cuentas.length === 0) return { devueltas: 0, totalDevuelto: 0 };

  // 2. Calcular intereses reales acumulados de cuotas pagadas
  //    para cada cuenta según su % de participación
  const cuotasPagadas = await prisma.prestamoCuota.findMany({
    where: { prestamo: { rondaId }, pagada: true },
    select: { interes: true },
  });

  const totalInteresReal = cuotasPagadas.reduce(
    (acc, c) => acc + Number(c.interes), 0
  );

  let totalDevuelto = 0;

  await prisma.$transaction(async (tx) => {
    for (const cuenta of cuentas) {
      const pct = Number(cuenta.porcentajeParticipacion) / 100;
      const interesCorrespondiente = Math.round(pct * totalInteresReal * 100) / 100;
      const totalADevolver = Number(cuenta.montoInvertido) + interesCorrespondiente;
      totalDevuelto += totalADevolver;

      // Actualizar intereses acumulados y marcar como devuelta
      await tx.cuentaInversion.update({
        where: { id: cuenta.id },
        data: {
          interesesAcumulados: new Prisma.Decimal(interesCorrespondiente),
          devuelto: true,
        },
      });

      // Sumar a saldoAhorros del socio
      await tx.socio.update({
        where: { id: cuenta.socioId },
        data: {
          saldoAhorros: {
            increment: new Prisma.Decimal(Math.round(totalADevolver * 100) / 100),
          },
        },
      });

      // Registrar movimiento de devolución
      await tx.movimientoCuenta.create({
        data: {
          socioId: cuenta.socioId,
          rondaId,
          tipo: "DEVOLUCION",
          monto: new Prisma.Decimal(Math.round(totalADevolver * 100) / 100),
          nota: `Devolución al cierre de ronda: $${Number(cuenta.montoInvertido).toFixed(2)} capital + $${interesCorrespondiente.toFixed(2)} intereses`,
        },
      });

      // Si hay intereses, registrar también movimiento de INTERES por separado
      if (interesCorrespondiente > 0) {
        await tx.movimientoCuenta.create({
          data: {
            socioId: cuenta.socioId,
            rondaId,
            tipo: "INTERES",
            monto: new Prisma.Decimal(interesCorrespondiente),
            nota: `Intereses ganados (${(pct * 100).toFixed(2)}% participación)`,
          },
        });
      }
    }
  });

  return { devueltas: cuentas.length, totalDevuelto };
}

export async function POST(_req: Request, context: Context) {
  const { params } = await context;
  const rondaId = Number((await params).id);

  const ronda = await prisma.ronda.findUnique({
    where: { id: rondaId },
    include: { participaciones: { select: { socioId: true } } },
  });

  if (!ronda) return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });
  if (!ronda.activa) return NextResponse.json({ error: "Ronda no activa" }, { status: 400 });

  const semana = ronda.semanaActual;
  const participantes = ronda.participaciones.map((p) => p.socioId);

  // Verificar si todos pagaron esta semana
  const pagos = await prisma.aporte.findMany({
    where: { rondaId, semana },
    select: { socioId: true },
  });

  const pagaron = new Set(pagos.map((p) => p.socioId));
  const pendientesIds = participantes.filter((id) => !pagaron.has(id));

  if (pendientesIds.length > 0) {
    const socios = await prisma.socio.findMany({
      where: { id: { in: pendientesIds } },
      select: { id: true, nombres: true, apellidos: true, numeroCuenta: true },
    });
    return NextResponse.json({
      ok: true,
      avanzada: false,
      pendientes: socios.map((s) => ({
        socioId: s.id,
        socio: { nombres: s.nombres, apellidos: s.apellidos, numeroCuenta: s.numeroCuenta },
        montoAporte: ronda.montoAporte.toString(),
        multa: MULTA_BASE.toFixed(2),
        totalAdeudado: (Number(ronda.montoAporte) + MULTA_BASE).toFixed(2),
      })),
    });
  }

  const totalSemanas = participantes.length;
  const siguiente = semana + 1;

  // ── CIERRE DE RONDA ───────────────────────────────────────────────────────
  if (siguiente > totalSemanas) {
    // 1. Cerrar la ronda
    await prisma.ronda.update({
      where: { id: rondaId },
      data: { activa: false, fechaFin: new Date() },
    });

    // 2. Devolver inversiones + intereses a cada socio
    const devolucion = await devolverInversiones(rondaId);

    return NextResponse.json({
      ok: true,
      avanzada: true,
      finalizada: true,
      devolucion, // { devueltas: N, totalDevuelto: X }
    });
  }

  // ── AVANZAR SEMANA ────────────────────────────────────────────────────────
  await prisma.ronda.update({
    where: { id: rondaId },
    data: { semanaActual: siguiente },
  });

  return NextResponse.json({ ok: true, avanzada: true, finalizada: false });
}
