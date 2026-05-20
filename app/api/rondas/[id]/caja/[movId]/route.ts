// app/api/rondas/[id]/caja/[movId]/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string; movId: string }> };

export async function DELETE(_req: Request, ctx: Context) {
  const { id, movId } = await ctx.params;
  try {
    const mov = await (prisma as any).movimientoCaja.findUnique({ where: { id: Number(movId) } });
    if (!mov) return NextResponse.json({ error: "Movimiento no encontrado" }, { status: 404 });
    if (mov.rondaId !== Number(id)) return NextResponse.json({ error: "No pertenece a esta ronda" }, { status: 400 });
    await (prisma as any).movimientoCaja.delete({ where: { id: Number(movId) } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}

export async function PUT(req: Request, ctx: Context) {
  const { id, movId } = await ctx.params;
  try {
    const body = await req.json();
    const { monto, descripcion, fecha } = body;
    const data: any = {};
    if (monto) data.monto = new Prisma.Decimal(Number(monto));
    if (descripcion !== undefined) data.descripcion = descripcion;
    if (fecha) data.fecha = new Date(`${fecha}T12:00:00Z`);
    const updated = await (prisma as any).movimientoCaja.update({ where: { id: Number(movId) }, data });
    return NextResponse.json({ ok: true, movimiento: { ...updated, monto: Number(updated.monto) } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
