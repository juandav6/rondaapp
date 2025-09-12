import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getParams } from "@/lib/getParams";
export const runtime = "nodejs";

export async function PUT(req: NextRequest, ctx: { params: { id: string } } | { params: Promise<{ id: string }> }) {
  try {
    const { id } = await getParams((ctx as any).params);
    const rondaId = Number(id);

    let body: any;
    try { body = await req.json(); }
    catch { return NextResponse.json({ error: "Body JSON inválido" }, { status: 400 }); }

    const ordenIds: number[] = Array.isArray(body?.ordenIds) ? body.ordenIds.map(Number) : [];
    if (!ordenIds.length) {
      return NextResponse.json({ error: "ordenIds vacío" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await Promise.all(
        ordenIds.map((socioId, i) =>
          tx.participacion.updateMany({
            where: { rondaId, socioId },
            data: { orden: i + 1 },
          })
        )
      );
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    console.error("PUT /api/rondas/[id]/orden", e);
    return NextResponse.json({ error: e?.message ?? "Error interno" }, { status: 500 });
  }
}
