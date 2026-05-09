// app/api/rondas/[id]/inversion/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

type Context = { params: Promise<{ id: string }> };

type AporteBody = { socioId: number; monto: number };

export async function GET(_req: Request, context: Context) {
  const { params } = await context;
  const rondaId = Number((await params).id);

  const cuentas = await prisma.cuentaInversion.findMany({
    where: { rondaId },
    include: {
      socio: { select: { id: true, nombres: true, apellidos: true, numeroCuenta: true, saldoAhorros: true } },
    },
    orderBy: { socioId: "asc" },
  });

  const totalFondo = cuentas.reduce((a, c) => a + Number(c.montoInvertido), 0);
  const totalIntereses = cuentas.reduce((a, c) => a + Number(c.interesesAcumulados), 0);

  return NextResponse.json({
    totalFondo,
    totalIntereses,
    cuentas: cuentas.map(c => ({
      id: c.id,
      socioId: c.socioId,
      socio: c.socio,
      montoInvertido: Number(c.montoInvertido),
      porcentajeParticipacion: Number(c.porcentajeParticipacion),
      interesesAcumulados: Number(c.interesesAcumulados),
      devuelto: c.devuelto,
    })),
  });
}

export async function POST(req: Request, context: Context) {
  const { params } = await context;
  const rondaId = Number((await params).id);

  const body = await req.json();
  const aportes: AporteBody[] = body?.aportes ?? [];

  if (!aportes.length) {
    return NextResponse.json({ error: "No se recibieron aportes" }, { status: 400 });
  }

  const ronda = await prisma.ronda.findUnique({ where: { id: rondaId } });
  if (!ronda) return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });
  if (!ronda.activa) return NextResponse.json({ error: "La ronda no está activa" }, { status: 400 });

  // Verificar que no existan ya cuentas de inversión para esta ronda
  const existing = await prisma.cuentaInversion.count({ where: { rondaId } });
  if (existing > 0) {
    return NextResponse.json({ error: "Ya se registró el fondo de inversión para esta ronda" }, { status: 409 });
  }

  // Calcular total del fondo para los porcentajes
  const totalFondo = aportes.reduce((a, b) => a + Number(b.monto), 0);
  if (totalFondo <= 0) {
    return NextResponse.json({ error: "El fondo total debe ser mayor a 0" }, { status: 400 });
  }

  // Validar que cada socio tenga saldo suficiente
  for (const aporte of aportes) {
    if (Number(aporte.monto) < 0) {
      return NextResponse.json({ error: `El monto no puede ser negativo (socioId ${aporte.socioId})` }, { status: 400 });
    }
    if (Number(aporte.monto) === 0) continue;

    const socio = await prisma.socio.findUnique({ where: { id: aporte.socioId } });
    if (!socio) return NextResponse.json({ error: `Socio ${aporte.socioId} no encontrado` }, { status: 404 });

    if (Number(socio.saldoAhorros) < Number(aporte.monto)) {
      return NextResponse.json({
        error: `${socio.nombres} ${socio.apellidos} no tiene saldo suficiente. Disponible: $${Number(socio.saldoAhorros).toFixed(2)}`,
      }, { status: 400 });
    }
  }

  // Transacción: crear CuentaInversion + descontar saldoAhorros + registrar movimientos
  await prisma.$transaction(async (tx) => {
    for (const aporte of aportes) {
      const monto = Number(aporte.monto);
      const pct = (monto / totalFondo) * 100;

      // Crear cuenta de inversión
      await tx.cuentaInversion.create({
        data: {
          rondaId,
          socioId: aporte.socioId,
          montoInvertido: new Prisma.Decimal(monto),
          porcentajeParticipacion: new Prisma.Decimal(Math.round(pct * 10000) / 10000),
          interesesAcumulados: new Prisma.Decimal(0),
        },
      });

      if (monto > 0) {
        // Descontar saldoAhorros
        await tx.socio.update({
          where: { id: aporte.socioId },
          data: { saldoAhorros: { decrement: new Prisma.Decimal(monto) } },
        });

        // Registrar movimiento
        await tx.movimientoCuenta.create({
          data: {
            socioId: aporte.socioId,
            rondaId,
            tipo: "INVERSION",
            monto: new Prisma.Decimal(monto),
            nota: `Aporte al fondo de inversión ronda ${ronda.nombre}`,
          },
        });
      }
    }
  });

  // Recalcular porcentajes exactos con el total real
  const cuentas = await prisma.cuentaInversion.findMany({
    where: { rondaId },
    include: {
      socio: { select: { id: true, nombres: true, apellidos: true, numeroCuenta: true, saldoAhorros: true } },
    },
  });

  return NextResponse.json({
    ok: true,
    totalFondo,
    cuentas: cuentas.map(c => ({
      socioId: c.socioId,
      socio: c.socio,
      montoInvertido: Number(c.montoInvertido),
      porcentajeParticipacion: Number(c.porcentajeParticipacion),
      interesesAcumulados: Number(c.interesesAcumulados),
    })),
  }, { status: 201 });
}
