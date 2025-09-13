import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type Body = { socioId: number; semana?: number };

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const rondaId = Number(params.id);
    const { socioId, semana } = (await req.json()) as Body;

    if (!rondaId || !socioId) {
      return NextResponse.json({ error: "rondaId y socioId son obligatorios" }, { status: 400 });
    }

    const ronda = await prisma.ronda.findUnique({ where: { id: rondaId } });
    if (!ronda) return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });

    const semanaEf = Number.isFinite(semana) ? Number(semana) : ronda.semanaActual;

    // Validar que el socio pertenece a la ronda
    const pertenece = await prisma.participacion.findUnique({
      where: { rondaId_socioId: { rondaId, socioId } },
      select: { socioId: true },
    });
    if (!pertenece) {
      return NextResponse.json({ error: "El socio no pertenece a la ronda" }, { status: 400 });
    }

    // Upsert por (rondaId, semana)
    const saved = await prisma.responsableCobroSemana.upsert({
      where: { rondaId_semana: { rondaId, semana: semanaEf } },
      create: { rondaId, semana: semanaEf, socioId },
      update: { socioId },
      select: { socioId: true, semana: true },
    });

    return NextResponse.json({ ok: true, responsableId: saved.socioId, semana: saved.semana });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: "No se pudo guardar el responsable" }, { status: 500 });
  }
}
