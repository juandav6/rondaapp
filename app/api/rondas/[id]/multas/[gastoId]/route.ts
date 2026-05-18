// app/api/rondas/[id]/multas/[gastoId]/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string; gastoId: string }> };

export async function DELETE(_req: Request, ctx: Context) {
  const { id, gastoId } = await ctx.params;
  const rondaId = Number(id);
  const gId = Number(gastoId);

  if (!Number.isFinite(rondaId) || !Number.isFinite(gId))
    return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });

  try {
    const gasto = await (prisma as any).gastoMulta.findUnique({ where: { id: gId } });
    if (!gasto) return NextResponse.json({ error: "Gasto no encontrado" }, { status: 404 });
    if (gasto.rondaId !== rondaId) return NextResponse.json({ error: "No pertenece a esta ronda" }, { status: 400 });

    await (prisma as any).gastoMulta.delete({ where: { id: gId } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}

export async function PUT(req: Request, ctx: Context) {
  const { id, gastoId } = await ctx.params;
  const rondaId = Number(id);
  const gId = Number(gastoId);

  try {
    const body = await req.json();
    const descripcion = String(body?.descripcion ?? "").trim();
    const monto = Number(body?.monto);

    if (!descripcion) return NextResponse.json({ error: "Descripción requerida" }, { status: 400 });
    if (!monto || monto <= 0) return NextResponse.json({ error: "Monto inválido" }, { status: 400 });

    const updated = await (prisma as any).gastoMulta.update({
      where: { id: gId },
      data: { descripcion, monto },
    });
    return NextResponse.json({ ok: true, gasto: { ...updated, monto: Number(updated.monto) } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
