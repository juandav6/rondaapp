// app/api/admin/reconciliar/fondo/route.ts
// POST: Reconcilia saldoFondoDisponible de cada ronda y verifica cadena de MovimientoFondo

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const soloVer: boolean = body.soloVer ?? true;
    const rondaId: number | undefined = body.rondaId ? Number(body.rondaId) : undefined;

    const rondas = await prisma.ronda.findMany({
      where: rondaId ? { id: rondaId } : undefined,
      select: { id: true, nombre: true, saldoFondoDisponible: true },
    });

    if (rondaId && rondas.length === 0) {
      return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });
    }

    const diferenciasRondas: Array<{
      rondaId: number;
      nombre: string;
      saldoActual: number;
      saldoCalculado: number;
      diferencia: number;
      detalle: { totalInvertido: number; totalPrestado: number; totalCapitalRecuperado: number };
    }> = [];

    const erroresCadena: Array<{
      rondaId: number;
      nombre: string;
      movimientoId: number;
      posicion: number;
      saldoDespuesAnterior: number;
      saldoAntesActual: number;
      diferencia: number;
    }> = [];

    for (const ronda of rondas) {
      // --- 1. Verificar saldoFondoDisponible ---

      // Total invertido (entradas al fondo)
      const inversiones = await prisma.cuentaInversion.aggregate({
        where: { rondaId: ronda.id },
        _sum: { montoInvertido: true },
      });
      const totalInvertido = r2(Number(inversiones._sum.montoInvertido ?? 0));

      // Total prestado (salidas del fondo, solo activos)
      const prestamos = await prisma.prestamo.aggregate({
        where: { rondaId: ronda.id, estado: "ACTIVO" },
        _sum: { monto: true },
      });
      const totalPrestado = r2(Number(prestamos._sum.monto ?? 0));

      // Capital recuperado (cuotas pagadas de prestamos de esta ronda)
      const cuotasPagadas = await prisma.prestamoCuota.aggregate({
        where: {
          pagada: true,
          prestamo: { rondaId: ronda.id },
        },
        _sum: { capital: true },
      });
      const totalCapitalRecuperado = r2(Number(cuotasPagadas._sum.capital ?? 0));

      const saldoCalculado = r2(totalInvertido - totalPrestado + totalCapitalRecuperado);
      const saldoActual = r2(Number(ronda.saldoFondoDisponible));
      const diferencia = r2(saldoCalculado - saldoActual);

      if (diferencia !== 0) {
        diferenciasRondas.push({
          rondaId: ronda.id,
          nombre: ronda.nombre,
          saldoActual,
          saldoCalculado,
          diferencia,
          detalle: { totalInvertido, totalPrestado, totalCapitalRecuperado },
        });
      }

      // --- 2. Verificar cadena de MovimientoFondo ---
      const movimientos = await prisma.movimientoFondo.findMany({
        where: { rondaId: ronda.id },
        orderBy: { id: "asc" },
        select: { id: true, saldoAntes: true, saldoDespues: true },
      });

      for (let i = 1; i < movimientos.length; i++) {
        const anterior = movimientos[i - 1];
        const actual = movimientos[i];
        const saldoDespuesAnt = r2(Number(anterior.saldoDespues));
        const saldoAntesCurr = r2(Number(actual.saldoAntes));

        if (saldoDespuesAnt !== saldoAntesCurr) {
          erroresCadena.push({
            rondaId: ronda.id,
            nombre: ronda.nombre,
            movimientoId: actual.id,
            posicion: i,
            saldoDespuesAnterior: saldoDespuesAnt,
            saldoAntesActual: saldoAntesCurr,
            diferencia: r2(saldoAntesCurr - saldoDespuesAnt),
          });
        }
      }
    }

    let corregidos = 0;

    // Corregir saldoFondoDisponible si no es solo vista previa
    if (!soloVer && diferenciasRondas.length > 0) {
      await prisma.$transaction(
        diferenciasRondas.map((d) =>
          prisma.ronda.update({
            where: { id: d.rondaId },
            data: { saldoFondoDisponible: new Prisma.Decimal(d.saldoCalculado) },
          })
        )
      );
      corregidos = diferenciasRondas.length;
    }

    return NextResponse.json({
      diferencias: diferenciasRondas,
      totalDiferencias: diferenciasRondas.length,
      erroresCadena,
      totalErroresCadena: erroresCadena.length,
      corregidos,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
