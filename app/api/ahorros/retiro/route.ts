// app/api/ahorros/retiro/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";

export const runtime = "nodejs";

// Ronda "técnica" para movimientos fuera de rondas activas
const RONDA_LIBRE_NOMBRE = "AHORROS_LIBRES";

export async function POST(req: NextRequest) {
  try {
    const { socioId, monto } = (await req.json()) as {
      socioId?: number;
      monto?: number;
    };

    const sId = Number(socioId);
    const cant = Number(monto);

    if (!Number.isFinite(sId) || sId <= 0 || !Number.isFinite(cant) || cant <= 0) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    // 1) Bloquear si hay alguna ronda activa
    const activas = await prisma.ronda.count({ where: { activa: true } });
    if (activas > 0) {
      return NextResponse.json(
        { error: "Hay una ronda activa. No se puede realizar el retiro." },
        { status: 400 }
      );
    }

    // 2) Saldo actual del socio (ahorros - retiros)
    const { _sum } = await prisma.ahorro.aggregate({
      where: { socioId: sId },
      _sum: { monto: true },
    });
    const saldoActual = Number(_sum.monto ?? 0);

    if (cant > saldoActual) {
      return NextResponse.json(
        { error: `El monto excede el saldo disponible (${saldoActual.toFixed(2)})` },
        { status: 400 }
      );
    }

    // 3) Buscar/crear la ronda "libre"
    let rondaLibre = await prisma.ronda.findFirst({ where: { nombre: RONDA_LIBRE_NOMBRE } });
    if (!rondaLibre) {
      rondaLibre = await prisma.ronda.create({
        data: {
          nombre: RONDA_LIBRE_NOMBRE,
          montoAporte: new Decimal(0),
          activa: false,
          fechaInicio: new Date("2000-01-01T00:00:00Z"),
          // fechaFin: null (opcional)
          semanaActual: 1,
          ahorroObjetivoPorSocio: new Decimal(0),
        },
      });
    }

    // 4) Asignar semana incremental para este socio en la ronda libre
    const { _max } = await prisma.ahorro.aggregate({
      where: { rondaId: rondaLibre.id, socioId: sId },
      _max: { semana: true },
    });
    const siguienteSemana = Number(_max.semana ?? 0) + 1;

    // 5) Crear registro con monto negativo
    await prisma.ahorro.create({
      data: {
        rondaId: rondaLibre.id,
        socioId: sId,
        semana: siguienteSemana,
        monto: -Math.abs(cant),
      },
    });

    // 6) Recalcular saldo
    const agg2 = await prisma.ahorro.aggregate({
      where: { socioId: sId },
      _sum: { monto: true },
    });
    const saldoNuevo = Number(agg2._sum.monto ?? 0);

    return NextResponse.json({ ok: true, saldo: saldoNuevo });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error inesperado" }, { status: 500 });
  }
}
