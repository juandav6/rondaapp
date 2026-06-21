// app/api/admin/reconciliar/saldos/route.ts
// POST: Reconcilia saldoAhorros de cada socio recalculando desde MovimientoCuenta

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const TIPOS_SUMA = ["AHORRO", "DEVOLUCION", "INTERES"];
const TIPOS_RESTA = ["RETIRO", "INVERSION"];

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const soloVer: boolean = body.soloVer ?? true;
    const socioId: number | undefined = body.socioId ? Number(body.socioId) : undefined;

    // Obtener socios a reconciliar
    const socios = await prisma.socio.findMany({
      where: socioId ? { id: socioId } : undefined,
      select: { id: true, nombres: true, apellidos: true, saldoAhorros: true },
    });

    if (socioId && socios.length === 0) {
      return NextResponse.json({ error: "Socio no encontrado" }, { status: 404 });
    }

    // Obtener todos los movimientos agrupados por socio
    const movimientos = await prisma.movimientoCuenta.findMany({
      where: socioId ? { socioId } : undefined,
      select: { socioId: true, tipo: true, monto: true },
    });

    // Calcular saldo por socio
    const saldoCalculadoPorSocio: Record<number, number> = {};
    for (const mov of movimientos) {
      const monto = Number(mov.monto);
      if (!saldoCalculadoPorSocio[mov.socioId]) {
        saldoCalculadoPorSocio[mov.socioId] = 0;
      }
      if (TIPOS_SUMA.includes(mov.tipo)) {
        saldoCalculadoPorSocio[mov.socioId] = r2(saldoCalculadoPorSocio[mov.socioId] + monto);
      } else if (TIPOS_RESTA.includes(mov.tipo)) {
        saldoCalculadoPorSocio[mov.socioId] = r2(saldoCalculadoPorSocio[mov.socioId] - monto);
      }
    }

    // Encontrar diferencias
    const diferencias: Array<{
      socioId: number;
      nombre: string;
      saldoActual: number;
      saldoCalculado: number;
      diferencia: number;
    }> = [];

    for (const socio of socios) {
      const saldoActual = r2(Number(socio.saldoAhorros));
      const saldoCalculado = r2(saldoCalculadoPorSocio[socio.id] ?? 0);
      const diferencia = r2(saldoCalculado - saldoActual);

      if (diferencia !== 0) {
        diferencias.push({
          socioId: socio.id,
          nombre: `${socio.nombres} ${socio.apellidos}`,
          saldoActual,
          saldoCalculado,
          diferencia,
        });
      }
    }

    let corregidos = 0;

    // Corregir si no es solo vista previa
    if (!soloVer && diferencias.length > 0) {
      await prisma.$transaction(
        diferencias.map((d) =>
          prisma.socio.update({
            where: { id: d.socioId },
            data: { saldoAhorros: new Prisma.Decimal(d.saldoCalculado) },
          })
        )
      );
      corregidos = diferencias.length;
    }

    return NextResponse.json({
      diferencias,
      totalDiferencias: diferencias.length,
      corregidos,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
