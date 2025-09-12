// app/api/rondas/[id]/participantes/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;                      // 👈 OBLIGATORIO en Next 15
    const rondaId = Number(id);
    if (!Number.isFinite(rondaId)) {
      return NextResponse.json({ error: "ID de ronda inválido" }, { status: 400 });
    }

    // Body seguro
    let body: any;
    try { body = await req.json(); }
    catch { return NextResponse.json({ error: "Body JSON inválido" }, { status: 400 }); }

    const sociosIds: number[] = Array.isArray(body?.sociosIds) ? body.sociosIds.map(Number) : [];
    if (!sociosIds.length) {
      return NextResponse.json({ error: "Debes enviar sociosIds (array de números)" }, { status: 400 });
    }

    // Verifica ronda
    const ronda = await prisma.ronda.findUnique({ where: { id: rondaId } });
    if (!ronda) return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });

    // Sorteo
    const ordenAleatorio = [...sociosIds].sort(() => Math.random() - 0.5);

    // Atómico
    await prisma.$transaction(async (tx) => {
      await tx.participacion.deleteMany({ where: { rondaId } });
      await tx.participacion.createMany({
        data: ordenAleatorio.map((socioId, idx) => ({
          rondaId,
          socioId,
          orden: idx + 1,
        })),
      });
    });

    const participantes = await prisma.participacion.findMany({
      where: { rondaId },
      include: { socio: { select: { id: true, nombres: true, apellidos: true, numeroCuenta: true } } },
      orderBy: { orden: "asc" },
    });

    return NextResponse.json(
      {
        ok: true,
        ordenIds: participantes.map(p => p.socioId), // 👈 tu UI lo usa si viene
        participantes: participantes.map(p => ({
          id: p.id,
          orden: p.orden,
          socio: {
            id: p.socio.id,
            nombres: p.socio.nombres,
            apellidos: p.socio.apellidos,
            numeroCuenta: p.socio.numeroCuenta,
          },
        })),
      },
      { status: 201 }
    );
  } catch (e: any) {
    console.error("POST /api/rondas/[id]/participantes error:", e);
    return NextResponse.json({ error: e?.message ?? "Error interno" }, { status: 500 });
  }
}
