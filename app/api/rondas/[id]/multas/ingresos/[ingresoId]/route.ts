// app/api/rondas/[id]/multas/ingresos/[ingresoId]/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string; ingresoId: string }> };

export async function DELETE(_req: Request, ctx: Context) {
  const { id, ingresoId } = await ctx.params;
  const rondaId = Number(id);
  const iId = Number(ingresoId);

  if (!Number.isFinite(rondaId) || !Number.isFinite(iId))
    return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });

  try {
    const ingreso = await (prisma as any).ingresoMulta.findUnique({ where: { id: iId } });
    if (!ingreso) return NextResponse.json({ error: "Ingreso no encontrado" }, { status: 404 });
    if (ingreso.rondaId !== rondaId) return NextResponse.json({ error: "No pertenece a esta ronda" }, { status: 400 });

    await (prisma as any).ingresoMulta.delete({ where: { id: iId } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
