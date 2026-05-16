// app/api/ahorros/retiro/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
export const runtime = "nodejs";

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

    // Bloquear si hay ronda activa
    const activas = await prisma.ronda.count({ where: { activa: true } });
    if (activas > 0) {
      return NextResponse.json(
        { error: "Hay una ronda activa. No se puede realizar el retiro." },
        { status: 400 }
      );
    }

    // Verificar saldo actual del socio
    const socio = await prisma.socio.findUnique({
      where: { id: sId },
      select: { id: true, saldoAhorros: true },
    });
    if (!socio) return NextResponse.json({ error: "Socio no encontrado" }, { status: 404 });

    const saldoActual = Number(socio.saldoAhorros);
    if (cant > saldoActual) {
      return NextResponse.json(
        { error: `El monto excede el saldo disponible ($${saldoActual.toFixed(2)})` },
        { status: 400 }
      );
    }

    const montoDecimal = new Prisma.Decimal(cant);

    // Transacción: movimiento RETIRO + decrementar saldoAhorros
    const [movimiento, socioActualizado] = await prisma.$transaction([
      // 1. Crear movimiento de retiro
      prisma.movimientoCuenta.create({
        data: {
          socioId: sId,
          rondaId: null,
          tipo: "RETIRO",
          monto: montoDecimal,
          nota: `Retiro de ahorros · ${new Date().toLocaleDateString("es-EC")}`,
        },
      }),
      // 2. Decrementar saldoAhorros
      prisma.socio.update({
        where: { id: sId },
        data: { saldoAhorros: { decrement: montoDecimal } },
        select: { saldoAhorros: true },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      movimientoId: movimiento.id,
      saldo: Number(socioActualizado.saldoAhorros),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error inesperado" }, { status: 500 });
  }
}
