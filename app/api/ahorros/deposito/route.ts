// app/api/ahorros/deposito/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { socioId, monto, fecha } = (await req.json()) as {
      socioId?: number;
      monto?: number;
      fecha?: string;
    };

    const sId = Number(socioId);
    const cant = Number(monto);

    if (!Number.isFinite(sId) || sId <= 0 || !Number.isFinite(cant) || cant <= 0) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    const socio = await prisma.socio.findUnique({
      where: { id: sId },
      select: { id: true, nombres: true, saldoAhorros: true },
    });
    if (!socio) return NextResponse.json({ error: "Socio no encontrado" }, { status: 404 });

    // Fecha del depósito
    let fechaReg: Date = new Date();
    if (fecha) {
      const f = new Date(`${fecha}T12:00:00Z`);
      if (Number.isNaN(f.getTime()))
        return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
      fechaReg = f;
    }

    const montoDecimal = new Prisma.Decimal(cant);

    // Transacción: movimiento + incrementar saldoAhorros
    const [movimiento, socioActualizado] = await prisma.$transaction([
      // 1. Crear movimiento visible en el historial
      prisma.movimientoCuenta.create({
        data: {
          socioId: sId,
          rondaId: null, // depósito libre, sin ronda
          tipo: "AHORRO",
          monto: montoDecimal,
          nota: `Depósito libre · ${fechaReg.toLocaleDateString("es-EC")}`,
          createdAt: fechaReg,
        },
      }),
      // 2. Incrementar saldoAhorros del socio
      prisma.socio.update({
        where: { id: sId },
        data: { saldoAhorros: { increment: montoDecimal } },
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
