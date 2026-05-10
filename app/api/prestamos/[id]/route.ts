// app/api/prestamos/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: Context) {
  const { params } = await context;
  const id = Number((await params).id);
  if (!id || isNaN(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    const prestamo = await prisma.prestamo.findUnique({
      where: { id },
      include: {
        socio: { select: { id: true, nombres: true, apellidos: true, numeroCuenta: true } },
        ronda: { select: { id: true, nombre: true, activa: true } },
        cuotas: { orderBy: { numero: "asc" } },
      },
    });
    if (!prestamo) return NextResponse.json({ error: "Préstamo no encontrado" }, { status: 404 });

    return NextResponse.json({
      prestamo: {
        ...prestamo,
        monto: Number(prestamo.monto),
        tasaAnual: Number(prestamo.tasaAnual),
        saldoActual: Number(prestamo.saldoActual),
        cuotas: prestamo.cuotas.map(c => ({
          ...c,
          cuota: Number(c.cuota),
          interes: Number(c.interes),
          capital: Number(c.capital),
          saldo: Number(c.saldo),
        })),
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error al obtener préstamo" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, context: Context) {
  const { params } = await context;
  const id = Number((await params).id);
  if (!id || isNaN(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    const prestamo = await prisma.prestamo.findUnique({
      where: { id },
      include: {
        cuotas: { select: { id: true, pagada: true } },
      },
    });

    if (!prestamo) return NextResponse.json({ error: "Préstamo no encontrado" }, { status: 404 });

    // Solo cancelar si NINGUNA cuota ha sido pagada
    const cuotasPagadas = prestamo.cuotas.filter(c => c.pagada).length;
    if (cuotasPagadas > 0) {
      return NextResponse.json(
        { error: `No se puede cancelar: ${cuotasPagadas} cuota(s) ya han sido pagadas.` },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.prestamoCuota.deleteMany({ where: { prestamoId: id } });
      await tx.prestamo.delete({ where: { id } });
    });

    return NextResponse.json({ ok: true, mensaje: "Préstamo cancelado correctamente." });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "No se pudo cancelar el préstamo" },
      { status: 500 }
    );
  }
}
