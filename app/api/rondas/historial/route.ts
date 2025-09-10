// app/api/rondas/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
export const runtime = "nodejs";

// GET → todas las rondas (para historial)
export async function GET() {
  const rondas = await prisma.ronda.findMany({
    orderBy: { fechaInicio: "desc" },
    select: {
      id: true,
      nombre: true,
      fechaInicio: true,
      fechaFin: true,
      activa: true,
    },
  });

  return NextResponse.json(rondas);
}

// POST → crear ronda
export async function POST(req: Request) {
  const { nombre, montoAporte, fechaInicio } = await req.json();

  // validar que no haya otra activa
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
      montoAporte,
      fechaInicio: new Date(fechaInicio),
      activa: true,
      semanaActual: 1,
    },
  });

  return NextResponse.json({
    id: ronda.id,
    nombre: ronda.nombre,
    montoAporte: ronda.montoAporte.toString(),
    fechaInicio: ronda.fechaInicio.toISOString(),
  });
}
