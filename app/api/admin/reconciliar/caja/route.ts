// app/api/admin/reconciliar/caja/route.ts
// POST: Reconcilia MovimientoCaja contra IngresoMulta y GastoMulta

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
      select: { id: true, nombre: true },
    });

    if (rondaId && rondas.length === 0) {
      return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });
    }

    const diferenciasMultas: Array<{
      rondaId: number;
      nombre: string;
      sumaIngresoMulta: number;
      sumaMovCajaMulta: number;
      diferencia: number;
    }> = [];

    const diferenciasGastos: Array<{
      rondaId: number;
      nombre: string;
      sumaGastoMulta: number;
      sumaMovCajaGasto: number;
      diferencia: number;
    }> = [];

    const huerfanos: Array<{
      rondaId: number;
      nombre: string;
      movimientoId: number;
      tipo: string;
      monto: number;
      fecha: Date;
      descripcion: string | null;
    }> = [];

    for (const ronda of rondas) {
      // --- Multas: IngresoMulta vs MovimientoCaja tipo MULTA ---
      const [sumaIngresosMulta, sumaMovCajaMulta] = await Promise.all([
        prisma.ingresoMulta.aggregate({
          where: { rondaId: ronda.id },
          _sum: { monto: true },
        }),
        prisma.movimientoCaja.aggregate({
          where: { rondaId: ronda.id, tipo: "MULTA" },
          _sum: { monto: true },
        }),
      ]);

      const totalIngresoMulta = r2(Number(sumaIngresosMulta._sum.monto ?? 0));
      const totalMovCajaMulta = r2(Number(sumaMovCajaMulta._sum.monto ?? 0));
      const diffMultas = r2(totalIngresoMulta - totalMovCajaMulta);

      if (diffMultas !== 0) {
        diferenciasMultas.push({
          rondaId: ronda.id,
          nombre: ronda.nombre,
          sumaIngresoMulta: totalIngresoMulta,
          sumaMovCajaMulta: totalMovCajaMulta,
          diferencia: diffMultas,
        });
      }

      // --- Gastos: GastoMulta vs MovimientoCaja tipo GASTO ---
      const [sumaGastosMulta, sumaMovCajaGasto] = await Promise.all([
        prisma.gastoMulta.aggregate({
          where: { rondaId: ronda.id },
          _sum: { monto: true },
        }),
        prisma.movimientoCaja.aggregate({
          where: { rondaId: ronda.id, tipo: "GASTO" },
          _sum: { monto: true },
        }),
      ]);

      const totalGastoMulta = r2(Number(sumaGastosMulta._sum.monto ?? 0));
      const totalMovCajaGasto = r2(Number(sumaMovCajaGasto._sum.monto ?? 0));
      const diffGastos = r2(totalGastoMulta - totalMovCajaGasto);

      if (diffGastos !== 0) {
        diferenciasGastos.push({
          rondaId: ronda.id,
          nombre: ronda.nombre,
          sumaGastoMulta: totalGastoMulta,
          sumaMovCajaGasto: totalMovCajaGasto,
          diferencia: diffGastos,
        });
      }

      // --- Huerfanos: MovimientoCaja sin correspondencia ---
      // Multas en caja sin IngresoMulta correspondiente
      const movCajaMultas = await prisma.movimientoCaja.findMany({
        where: { rondaId: ronda.id, tipo: "MULTA" },
        select: { id: true, tipo: true, monto: true, socioId: true, semana: true, fecha: true, descripcion: true },
      });

      for (const mc of movCajaMultas) {
        if (mc.socioId && mc.semana) {
          const ingreso = await prisma.ingresoMulta.findFirst({
            where: { rondaId: ronda.id, socioId: mc.socioId, semana: mc.semana },
          });
          if (!ingreso) {
            huerfanos.push({
              rondaId: ronda.id,
              nombre: ronda.nombre,
              movimientoId: mc.id,
              tipo: mc.tipo,
              monto: r2(Number(mc.monto)),
              fecha: mc.fecha,
              descripcion: mc.descripcion,
            });
          }
        } else {
          // Sin socioId o semana => no puede tener IngresoMulta correspondiente
          huerfanos.push({
            rondaId: ronda.id,
            nombre: ronda.nombre,
            movimientoId: mc.id,
            tipo: mc.tipo,
            monto: r2(Number(mc.monto)),
            fecha: mc.fecha,
            descripcion: mc.descripcion,
          });
        }
      }

      // Gastos en caja sin GastoMulta correspondiente
      const movCajaGastos = await prisma.movimientoCaja.findMany({
        where: { rondaId: ronda.id, tipo: "GASTO" },
        select: { id: true, tipo: true, monto: true, fecha: true, descripcion: true },
      });

      for (const mc of movCajaGastos) {
        // Buscar GastoMulta por rondaId, monto y fecha cercana
        const gasto = await prisma.gastoMulta.findFirst({
          where: {
            rondaId: ronda.id,
            monto: mc.monto,
            descripcion: mc.descripcion ?? undefined,
          },
        });
        if (!gasto) {
          huerfanos.push({
            rondaId: ronda.id,
            nombre: ronda.nombre,
            movimientoId: mc.id,
            tipo: mc.tipo,
            monto: r2(Number(mc.monto)),
            fecha: mc.fecha,
            descripcion: mc.descripcion,
          });
        }
      }
    }

    return NextResponse.json({
      diferenciasMultas,
      totalDiferenciasMultas: diferenciasMultas.length,
      diferenciasGastos,
      totalDiferenciasGastos: diferenciasGastos.length,
      huerfanos,
      totalHuerfanos: huerfanos.length,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
