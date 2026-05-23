// app/api/rondas/[id]/devolver-inversiones/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

type Context = { params: Promise<{ id: string }> };

export async function POST(_req: Request, context: Context) {
  const { params } = await context;
  const rondaId = Number((await params).id);

  const ronda = await prisma.ronda.findUnique({ where: { id: rondaId } });
  if (!ronda) return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });

  // Cuentas de inversión no devueltas
  const cuentas = await prisma.cuentaInversion.findMany({
    where: { rondaId, devuelto: false },
    include: { socio: { select: { id: true, nombres: true, apellidos: true } } },
  });

  if (cuentas.length === 0) {
    return NextResponse.json({
      ok: true,
      mensaje: "No hay inversiones pendientes de devolución en esta ronda.",
      devueltas: 0,
    });
  }

  // Intereses reales: suma de intereses de cuotas PAGADAS de préstamos de esta ronda
  const cuotasPagadas = await prisma.prestamoCuota.findMany({
    where: { prestamo: { rondaId }, pagada: true },
    select: { interes: true },
  });

  const totalInteresReal = cuotasPagadas.reduce(
    (acc, c) => acc + Number(c.interes), 0
  );

  const resultado: Array<{
    socioId: number;
    nombres: string;
    apellidos: string;
    capital: number;
    intereses: number;
    totalDevuelto: number;
  }> = [];

  await prisma.$transaction(async (tx) => {
    for (const cuenta of cuentas) {
      const pct = Number(cuenta.porcentajeParticipacion) / 100;
      const interesCorrespondiente = Math.round(pct * totalInteresReal * 100) / 100;
      const totalADevolver = Math.round(
        (Number(cuenta.montoInvertido) + interesCorrespondiente) * 100
      ) / 100;

      // Marcar como devuelta y actualizar intereses
      await tx.cuentaInversion.update({
        where: { id: cuenta.id },
        data: {
          interesesAcumulados: new Prisma.Decimal(interesCorrespondiente),
          devuelto: true,
        },
      });

      // Sumar a saldoAhorros: capital + interés (una sola vez)
      await tx.socio.update({
        where: { id: cuenta.socioId },
        data: { saldoAhorros: { increment: new Prisma.Decimal(totalADevolver) } },
      });

      // Movimiento DEVOLUCION = retorno del capital invertido
      // Fecha = fechaFin de la ronda (cuando se cerró y se distribuyó)
      const fechaCierre = ronda.fechaFin ?? new Date();
      await tx.movimientoCuenta.create({
        data: {
          socioId: cuenta.socioId,
          rondaId,
          tipo: "DEVOLUCION",
          monto: new Prisma.Decimal(Number(cuenta.montoInvertido)),
          nota: `Retorno capital fondo · ${ronda.nombre} · $${Number(cuenta.montoInvertido).toFixed(2)}`,
          createdAt: fechaCierre,
        },
      });

      // Movimiento INTERES = interés generado en esta ronda específica
      if (interesCorrespondiente > 0) {
        await tx.movimientoCuenta.create({
          data: {
            socioId: cuenta.socioId,
            rondaId,
            tipo: "INTERES",
            monto: new Prisma.Decimal(interesCorrespondiente),
            nota: `Intereses ${ronda.nombre} · ${(pct * 100).toFixed(2)}% participación · $${interesCorrespondiente.toFixed(2)}`,
            createdAt: fechaCierre,
          },
        });
      }

      resultado.push({
        socioId: cuenta.socioId,
        nombres: cuenta.socio.nombres,
        apellidos: cuenta.socio.apellidos,
        capital: Number(cuenta.montoInvertido),
        intereses: interesCorrespondiente,
        totalDevuelto: totalADevolver,
      });
    }
  });

  return NextResponse.json({
    ok: true,
    ronda: ronda.nombre,
    totalInteresReal: Math.round(totalInteresReal * 100) / 100,
    devueltas: resultado.length,
    totalDevuelto: resultado.reduce((a, r) => a + r.totalDevuelto, 0),
    detalle: resultado,
  });
}
