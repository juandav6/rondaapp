// app/api/ahorros/deposito/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";

export const runtime = "nodejs";

const RONDA_LIBRE_NOMBRE = "AHORROS_LIBRES";

export async function POST(req: NextRequest) {
  try {
    const { socioId, monto, fecha } = (await req.json()) as {
      socioId?: number;
      monto?: number;
      fecha?: string; // opcional YYYY-MM-DD
    };

    const sId = Number(socioId);
    const cant = Number(monto);

    if (!Number.isFinite(sId) || sId <= 0 || !Number.isFinite(cant) || cant <= 0) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    // Validar socio existe
    const socio = await prisma.socio.findUnique({ where: { id: sId }, select: { id: true } });
    if (!socio) return NextResponse.json({ error: "Socio no encontrado" }, { status: 404 });

    // Buscar/crear ronda libre
    let rondaLibre = await prisma.ronda.findFirst({ where: { nombre: RONDA_LIBRE_NOMBRE } });
    if (!rondaLibre) {
      rondaLibre = await prisma.ronda.create({
        data: {
          nombre: RONDA_LIBRE_NOMBRE,
          montoAporte: new Decimal(0),
          activa: false,
          fechaInicio: new Date("2000-01-01T00:00:00Z"),
          semanaActual: 1,
          ahorroObjetivoPorSocio: new Decimal(0),
        },
      });
    }

    // Semana incremental por socio en esta ronda (para no chocar con @@unique)
    const { _max } = await prisma.ahorro.aggregate({
      where: { rondaId: rondaLibre.id, socioId: sId },
      _max: { semana: true },
    });
    const siguienteSemana = Number(_max.semana ?? 0) + 1;

    // Fecha opcional
    let fechaReg: Date | undefined = undefined;
    if (fecha) {
      const f = new Date(fecha);
      if (Number.isNaN(f.getTime())) {
        return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
      }
      // normaliza a medianoche local
      f.setHours(12, 0, 0, 0);
      fechaReg = f;
    }

    const creado = await prisma.ahorro.create({
      data: {
        rondaId: rondaLibre.id,
        socioId: sId,
        semana: siguienteSemana,
        monto: cant, // POSITIVO
        ...(fechaReg ? { fecha: fechaReg } : {}),
      },
      select: { id: true },
    });

    // saldo nuevo
    const agg = await prisma.ahorro.aggregate({
      where: { socioId: sId },
      _sum: { monto: true },
    });
    const saldo = Number(agg._sum.monto ?? 0);

    return NextResponse.json({ ok: true, id: creado.id, saldo });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error inesperado" }, { status: 500 });
  }
}
