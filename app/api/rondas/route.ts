// app/api/rondas/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
export const runtime = "nodejs";
import { Prisma } from "@prisma/client";

// GET → ronda activa + participaciones (ordenadas) + código
export async function GET() {
  const ronda = await prisma.ronda.findFirst({
    where: { activa: true },
    include: {
      participaciones: {
        include: { socio: true },
        orderBy: { orden: "asc" }, // 👈 respeta el orden guardado
      },
    },
  });
  if (!ronda) return new NextResponse(null, { status: 204 });

  return NextResponse.json({
    id: ronda.id,
    nombre: ronda.nombre,
    semanaActual: ronda.semanaActual,
    montoAporte: ronda.montoAporte.toString(),
    ahorroObjetivoPorSocio: ronda.ahorroObjetivoPorSocio.toString(),
    fechaInicio: ronda.fechaInicio.toISOString(),
    fechaFin: ronda.fechaFin ? ronda.fechaFin.toISOString() : null,
    intervaloDiasCobro: ronda.intervaloDiasCobro, // 👈 NUEVO
    participaciones: ronda.participaciones.map((p) => ({
      id: p.id,
      orden: p.orden,
      socio: {
        nombres: p.socio.nombres,
        apellidos: p.socio.apellidos,
        numeroCuenta: p.socio.numeroCuenta,
      },
    })),
  });
}

// POST → crear ronda con código secuencial RDxxxx
export async function POST(req: Request) {
  const body = await req.json();
  const { nombre, montoAporte, fechaInicio, ahorroObjetivo, intervaloDiasCobro } = body as {
    nombre?: string;
    montoAporte: number;
    fechaInicio: string;
    ahorroObjetivo: number;
    intervaloDiasCobro?: number;
  };

  // valida única ronda activa
  const activa = await prisma.ronda.findFirst({ where: { activa: true } });
  if (activa) {
    return NextResponse.json(
      { error: "Ya existe una ronda activa" },
      { status: 400 }
    );
  }

  // genera código secuencial RD0001, RD0002, ...
  const row = await prisma.$queryRaw<{ nextval: bigint }[]>`
    SELECT nextval('ronda_codigo_seq') as nextval
  `;
  const n = Number(row[0].nextval);
  const codigo = `RD${String(n).padStart(4, "0")}`;

  // saneo de valores
  const intervalo = Number.isFinite(intervaloDiasCobro) && Number(intervaloDiasCobro) > 0
    ? Math.floor(Number(intervaloDiasCobro))
    : 7; // por defecto semanal

  // crea la ronda
  const ronda = await prisma.ronda.create({
    data: {
      nombre: codigo,
      montoAporte: new Prisma.Decimal(Number(montoAporte ?? 0)), // 👈 Decimal
      fechaInicio: new Date(fechaInicio),
      activa: true,
      semanaActual: 1,
      ahorroObjetivoPorSocio: new Prisma.Decimal(Number(ahorroObjetivo ?? 0)), // 👈 Decimal
      intervaloDiasCobro: intervalo, // 👈 NUEVO
    },
    select: {
      id: true,
      nombre: true,
      montoAporte: true,
      fechaInicio: true,
      fechaFin: true,
      ahorroObjetivoPorSocio: true,
      activa: true,
      semanaActual: true,
      intervaloDiasCobro: true, // 👈 NUEVO
    },
  });

  return NextResponse.json({
    id: ronda.id,
    nombre: ronda.nombre,
    montoAporte: ronda.montoAporte.toString(),
    fechaInicio: ronda.fechaInicio.toISOString(),
    fechaFin: ronda.fechaFin ? ronda.fechaFin.toISOString() : null,
    ahorroObjetivoPorSocio: ronda.ahorroObjetivoPorSocio.toString(),
    activa: ronda.activa,
    semanaActual: ronda.semanaActual,
    intervaloDiasCobro: ronda.intervaloDiasCobro, // 👈 NUEVO
  });
}
