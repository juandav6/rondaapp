// app/api/admin/reconciliar/limpiar-ceros/route.ts
// Limpia MovimientoCuenta con monto=0 que no aportan nada al kardex
// (Generados por CuentaInversion con montoInvertido=0, error ya corregido)

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  try {
    const movimientos = await prisma.movimientoCuenta.findMany({
      where: { monto: 0 },
      include: { socio: { select: { nombres: true, apellidos: true, numeroCuenta: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      total: movimientos.length,
      movimientos: movimientos.map(m => ({
        id: m.id,
        socio: `${m.socio.nombres} ${m.socio.apellidos} (${m.socio.numeroCuenta})`,
        tipo: m.tipo,
        nota: m.nota,
        fecha: m.createdAt,
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST() {
  try {
    const result = await prisma.movimientoCuenta.deleteMany({
      where: { monto: 0 },
    });

    return NextResponse.json({
      ok: true,
      eliminados: result.count,
      mensaje: `Se eliminaron ${result.count} movimiento(s) con monto $0.00 del kardex.`,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
