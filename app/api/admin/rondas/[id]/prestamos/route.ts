// app/api/admin/rondas/[id]/prestamos/route.ts
// Devuelve TODOS los préstamos de una ronda (activos, cancelados, pagados)
// con cuotas, fechaInicio y nota de cancelación para administración

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const rondaId = Number((await ctx.params).id);
  if (!Number.isFinite(rondaId))
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    const prestamos = await prisma.prestamo.findMany({
      where: { rondaId },
      include: {
        socio: { select: { id: true, nombres: true, apellidos: true, numeroCuenta: true } },
        cuotas: { orderBy: { numero: "asc" } },
      },
      orderBy: [
        // Activos primero, luego cancelados, luego pagados
        { estado: "asc" },
        { createdAt: "asc" },
      ],
    });

    return NextResponse.json(
      prestamos.map(p => ({
        id: p.id,
        socioId: p.socioId,
        socio: p.socio,
        monto: Number(p.monto),
        tasaAnual: Number(p.tasaAnual),
        plazoMeses: p.plazoMeses,
        fechaInicio: p.fechaInicio,
        estado: p.estado,
        notaCancelacion: (p as any).notaCancelacion ?? null,
        saldoActual: Number(p.saldoActual),
        cuotas: p.cuotas.map(c => ({
          id: c.id,
          numero: c.numero,
          cuota: Number(c.cuota),
          capital: Number(c.capital),
          interes: Number(c.interes),
          saldo: Number(c.saldo),
          pagada: c.pagada,
          fechaVenc: c.fechaVenc,
          fechaPago: c.fechaPago,
        })),
      }))
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
