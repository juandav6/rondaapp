// app/api/admin/prestamos/[id]/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { registrarBitacora, diffObjetos } from "@/lib/bitacora";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const dec = (n: number) => new Prisma.Decimal(r2(n));

// PUT: cancelar (con nota) o cambiar fechaInicio
export async function PUT(req: Request, ctx: Ctx) {
  const id = Number((await ctx.params).id);
  try {
    const body = await req.json();
    const { accion, notaCancelacion, fechaInicio } = body;

    const antes = await prisma.prestamo.findUnique({
      where: { id },
      include: { socio: { select: { nombres: true, apellidos: true } } },
    });
    if (!antes) return NextResponse.json({ error: "Préstamo no encontrado" }, { status: 404 });

    // ── Cancelar préstamo ─────────────────────────────────────────────────
    if (accion === "cancelar") {
      if (antes.estado === "CANCELADO")
        return NextResponse.json({ error: "El préstamo ya está cancelado" }, { status: 400 });

      await prisma.prestamo.update({
        where: { id },
        data: {
          estado: "CANCELADO",
          notaCancelacion: notaCancelacion?.trim() || null,
          saldoActual: new Prisma.Decimal(0),
        },
      });

      await registrarBitacora({
        tabla: "prestamos", registroId: id, accion: "EDITAR",
        camposCambios: {
          estado: { antes: antes.estado, despues: "CANCELADO" },
          notaCancelacion: { antes: null, despues: notaCancelacion?.trim() || "(sin nota)" },
          saldoActual: { antes: Number(antes.saldoActual), despues: 0 },
        },
      });

      return NextResponse.json({ ok: true, mensaje: `Préstamo cancelado. Saldo puesto en $0.` });
    }

    // ── Cambiar fechaInicio ───────────────────────────────────────────────
    if (accion === "fecha") {
      if (!fechaInicio) return NextResponse.json({ error: "fechaInicio requerida" }, { status: 400 });
      const nuevaFecha = new Date(fechaInicio);
      if (isNaN(nuevaFecha.getTime())) return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });

      await prisma.prestamo.update({
        where: { id },
        data: { fechaInicio: nuevaFecha },
      });

      await registrarBitacora({
        tabla: "prestamos", registroId: id, accion: "EDITAR",
        camposCambios: {
          fechaInicio: { antes: antes.fechaInicio.toISOString().slice(0,10), despues: fechaInicio },
        },
      });

      return NextResponse.json({ ok: true, mensaje: "Fecha de inicio actualizada" });
    }

    return NextResponse.json({ error: "accion debe ser 'cancelar' o 'fecha'" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}

// DELETE: eliminar completamente (datos incorrectos)
export async function DELETE(_req: Request, ctx: Ctx) {
  const id = Number((await ctx.params).id);
  try {
    const prestamo = await prisma.prestamo.findUnique({
      where: { id },
      include: {
        socio: { select: { nombres: true, apellidos: true } },
        ronda: { select: { nombre: true } },
        cuotas: true,
      },
    });
    if (!prestamo) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    // Solo se puede eliminar si no tiene cuotas pagadas
    const cuotasPagadas = prestamo.cuotas.filter(c => c.pagada).length;
    if (cuotasPagadas > 0)
      return NextResponse.json({
        error: `No se puede eliminar: tiene ${cuotasPagadas} cuota(s) pagada(s). Use "Cancelar" en su lugar.`,
      }, { status: 400 });

    await prisma.$transaction(async (tx) => {
      await tx.prestamoCuota.deleteMany({ where: { prestamoId: id } });
      await tx.prestamo.delete({ where: { id } });
    });

    await registrarBitacora({
      tabla: "prestamos", registroId: id, accion: "ELIMINAR",
      camposCambios: {
        socio: { antes: `${prestamo.socio.nombres} ${prestamo.socio.apellidos}`, despues: null },
        monto: { antes: Number(prestamo.monto), despues: null },
        ronda: { antes: prestamo.ronda.nombre, despues: null },
        cuotasEliminadas: { antes: prestamo.cuotas.length, despues: 0 },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
