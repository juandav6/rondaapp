// app/api/rondas/[id]/ahorros/route.ts
import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
export const runtime = "nodejs";

// Calcula la fecha real de una semana de la ronda
function fechaDeSemana(fechaInicio: Date, semana: number, intervalo: number): Date {
  const d = new Date(Date.UTC(
    fechaInicio.getUTCFullYear(),
    fechaInicio.getUTCMonth(),
    fechaInicio.getUTCDate(),
    12, 0, 0
  ));
  d.setUTCDate(d.getUTCDate() + (semana - 1) * intervalo);
  return d;
}

export async function POST(req: Request | NextRequest, { params }: any) {
  const rondaId = Number(Array.isArray(params?.id) ? params.id[0] : params?.id);
  const { socioId, semana, monto } = (await req.json()) as {
    socioId?: number; semana?: number; monto?: number;
  };

  if (!Number.isFinite(rondaId) || !socioId || !semana || !monto || Number(monto) <= 0) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const ronda = await prisma.ronda.findUnique({
    where: { id: rondaId },
    select: {
      id: true,
      nombre: true,
      fechaInicio: true,
      intervaloDiasCobro: true,
    },
  });
  if (!ronda) {
    return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });
  }

  // Verificar que no haya registrado ahorro esta semana
  const ya = await prisma.ahorro.count({ where: { rondaId, socioId, semana } });
  if (ya > 0) {
    return NextResponse.json({ error: "Ya registraste un ahorro esta semana" }, { status: 400 });
  }

  const montoDecimal = new Prisma.Decimal(monto);

  // Fecha real de la semana (no la fecha de registro)
  const fechaSemana = ronda.fechaInicio
    ? fechaDeSemana(ronda.fechaInicio, semana, ronda.intervaloDiasCobro ?? 7)
    : new Date();

  // Transacción: crear ahorro + movimiento + actualizar saldo
  const [ahorro, , socioActualizado] = await prisma.$transaction([
    // 1. Registrar en tabla ahorros con la fecha correcta de la semana
    prisma.ahorro.create({
      data: {
        rondaId,
        socioId,
        semana,
        monto: montoDecimal,
        fecha: fechaSemana,        // ← fecha real de la semana
      },
    }),
    // 2. Crear movimiento con la fecha real de la semana
    prisma.movimientoCuenta.create({
      data: {
        socioId,
        rondaId,
        tipo: "AHORRO",
        monto: montoDecimal,
        nota: `Ahorro semana ${semana} · ${ronda.nombre}`,
        createdAt: fechaSemana,    // ← fecha real de la semana
      },
    }),
    // 3. Incrementar saldoAhorros del socio
    prisma.socio.update({
      where: { id: socioId },
      data: { saldoAhorros: { increment: montoDecimal } },
      select: { saldoAhorros: true },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    ahorro,
    nuevoSaldo: Number(socioActualizado.saldoAhorros),
  });
}
