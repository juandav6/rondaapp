import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const rondaId = Number(params.id);
  const ronda = await prisma.ronda.findUnique({
    where: { id: rondaId },
    include: { participaciones: true },
  });
  if (!ronda?.activa) return NextResponse.json({ error: "Ronda no activa" }, { status: 400 });

  const duracion = ronda.participaciones.length;
  const siguiente = ronda.semanaActual + 1;

  // si ya terminó
  if (siguiente > duracion) {
    await prisma.ronda.update({
      where: { id: rondaId },
      data: { activa: false, fechaFin: new Date() },
    });
    return NextResponse.json({ finalizada: true });
  }

  const r = await prisma.ronda.update({
    where: { id: rondaId },
    data: { semanaActual: siguiente },
  });
  return NextResponse.json(r);
}
