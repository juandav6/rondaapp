import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"; // ajusta a tu proyecto

type PUTBody = { ordenIds: number[] };

export async function PUT(req: Request | NextRequest, { params }: any) {
  try {
    const rondaId = Number(params.id);
    if (!rondaId || Number.isNaN(rondaId)) {
      return NextResponse.json({ error: "ID de ronda inválido" }, { status: 400 });
    }

    const body = (await req.json()) as PUTBody;
    const ordenIds = Array.isArray(body?.ordenIds) ? body.ordenIds : [];
    if (!ordenIds.length) {
      return NextResponse.json({ error: "ordenIds vacío" }, { status: 400 });
    }

    // Verifica que los socios pertenezcan a la ronda (opcional pero recomendado)
    const participantes = await prisma.participacion.findMany({
      where: { rondaId },
      select: { socioId: true },
    });
    const setValidos = new Set(participantes.map((p) => p.socioId));
    const todosValidos = ordenIds.every((id) => setValidos.has(id));
    if (!todosValidos) {
      return NextResponse.json({ error: "Hay socios que no pertenecen a la ronda" }, { status: 400 });
    }

    // Persistir el orden: una de estas dos estrategias

    // A) Campo "orden" en la tabla participante
    // Actualiza cada participante con su posición
    await Promise.all(
      ordenIds.map((socioId, index) =>
        prisma.participacion.update({
          where: { rondaId_socioId: { rondaId, socioId } }, // índice compuesto recomendado
          data: { orden: index + 1 },
        })
      )
    );

    // B) Tabla separada 'ronda_orden' (si manejas historial) — omitir si no aplica.

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: "No se pudo guardar el nuevo orden" }, { status: 500 });
  }
}
