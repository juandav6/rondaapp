// app/api/prestamos/cuotas/[id]/pagar/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const cuotaId = Number(params.id);
    if (!cuotaId || isNaN(cuotaId)) {
      return NextResponse.json({ error: "ID de cuota inválido" }, { status: 400 });
    }

    // Fecha de pago opcional — si no se envía usa la fecha actual
    const body = await req.json().catch(() => ({}));
    const fechaPago = body?.fechaPago ? new Date(body.fechaPago + "T12:00:00Z") : new Date();

    const cuota = await prisma.prestamoCuota.findUnique({
      where: { id: cuotaId },
      include: { prestamo: true },
    });

    if (!cuota) {
      return NextResponse.json({ error: "Cuota no encontrada" }, { status: 404 });
    }
    if (cuota.pagada) {
      return NextResponse.json({ error: "Esta cuota ya fue pagada" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // marcar cuota como pagada
      const cuotaActualizada = await tx.prestamoCuota.update({
        where: { id: cuotaId },
        data: { pagada: true, fechaPago },
      });

      // actualizar saldo del préstamo
      const nuevoSaldo = Number(cuota.prestamo.saldoActual) - Number(cuota.capital);

      // verificar si quedan cuotas pendientes
      const cuotasPendientes = await tx.prestamoCuota.count({
        where: { prestamoId: cuota.prestamoId, pagada: false, id: { not: cuotaId } },
      });

      const nuevoEstado = cuotasPendientes === 0 ? "CANCELADO" : cuota.prestamo.estado;

      const prestamoActualizado = await tx.prestamo.update({
        where: { id: cuota.prestamoId },
        data: {
          saldoActual: Math.max(0, nuevoSaldo),
          estado: nuevoEstado,
        },
      });

      return { cuotaActualizada, prestamoActualizado };
    });

    return NextResponse.json({
      ok: true,
      saldoActual: Number(result.prestamoActualizado.saldoActual),
      estado: result.prestamoActualizado.estado,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Error al registrar pago" },
      { status: 500 }
    );
  }
}
