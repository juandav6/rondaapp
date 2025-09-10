// app/api/rondas/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
export const runtime = "nodejs";
import { Prisma } from "@prisma/client";

// GET → ronda activa + participaciones
export async function GET() {
  const ronda = await prisma.ronda.findFirst({
    where: { activa: true },
    include: {
      participaciones: { include: { socio: true }, orderBy: { orden: "asc" } },
    },
  });
  if (!ronda) return new NextResponse(null, { status: 204 });

  return NextResponse.json({
    id: ronda.id,
    nombre: ronda.nombre,
    semanaActual: ronda.semanaActual,
    montoAporte: ronda.montoAporte.toString(),
    ahorroObjetivoPorSocio: ronda.ahorroObjetivoPorSocio.toString(),
    participaciones: ronda.participaciones.map((p: { id: any; orden: any; socio: { nombres: any; apellidos: any; numeroCuenta: any; }; }) => ({
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

// POST → crear ronda (tu formulario la usa)
export async function POST(req: Request) {
  const { nombre, montoAporte, fechaInicio,ahorroObjetivo  } = await req.json();

  const activa = await prisma.ronda.findFirst({ where: { activa: true } });
  if (activa) {
    return NextResponse.json(
      { error: "Ya existe una ronda activa" },
      { status: 400 }
    );
  }

  const ronda = await prisma.ronda.create({
    data: {
      nombre,
      montoAporte, // número: Prisma lo guarda en NUMERIC
      fechaInicio: new Date(fechaInicio),
      activa: true,
      semanaActual: 1,
      ahorroObjetivoPorSocio: new Prisma.Decimal(ahorroObjetivo ?? 0),
    },
  });

  return NextResponse.json({
    id: ronda.id,
    nombre: ronda.nombre,
    montoAporte: ronda.montoAporte.toString(),
    fechaInicio: ronda.fechaInicio.toISOString(),
    ahorroObjetivoPorSocio: ronda.ahorroObjetivoPorSocio.toString(),
  });
}
