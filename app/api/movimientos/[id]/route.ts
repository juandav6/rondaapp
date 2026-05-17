// app/api/movimientos/[id]/route.ts
// GET  → detalle de un movimiento
// PUT  → editar monto, fecha y nota de un movimiento
// DELETE → eliminar (reversa saldo)
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";
type Params = Promise<{ id: string }>;

function toDecimal(n: number) {
  return new Prisma.Decimal(Math.round((n + Number.EPSILON) * 100) / 100);
}

export async function GET(_req: Request, ctx: { params: Params }) {
  const id = Number((await ctx.params).id);
  if (!Number.isFinite(id))
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const mov = await prisma.movimientoCuenta.findUnique({
    where: { id },
    include: { socio: { select: { nombres: true, apellidos: true, numeroCuenta: true } } },
  });
  if (!mov) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  return NextResponse.json({
    id: mov.id,
    tipo: mov.tipo,
    monto: Number(mov.monto),
    nota: mov.nota,
    fecha: mov.createdAt,
    socio: mov.socio,
    rondaId: mov.rondaId,
  });
}

export async function PUT(req: Request, ctx: { params: Params }) {
  const id = Number((await ctx.params).id);
  if (!Number.isFinite(id))
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    const { monto, fecha, nota } = await req.json();

    const movActual = await prisma.movimientoCuenta.findUnique({
      where: { id },
      select: { id: true, tipo: true, monto: true, socioId: true, createdAt: true, nota: true },
    });
    if (!movActual) return NextResponse.json({ error: "Movimiento no encontrado" }, { status: 404 });

    // Solo permitir editar depósitos y retiros libres
    if (!["AHORRO", "RETIRO"].includes(movActual.tipo)) {
      return NextResponse.json(
        { error: "Solo se pueden editar depósitos libres y retiros" },
        { status: 400 }
      );
    }

    const montoAnterior = Number(movActual.monto);
    const montoNuevo = monto != null ? Number(monto) : montoAnterior;

    if (montoNuevo <= 0)
      return NextResponse.json({ error: "El monto debe ser mayor a 0" }, { status: 400 });

    const diferencia = montoNuevo - montoAnterior;

    // Parsear fecha
    let fechaNueva: Date | undefined;
    if (fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      fechaNueva = new Date(`${fecha}T12:00:00Z`);
      if (Number.isNaN(fechaNueva.getTime())) fechaNueva = undefined;
    }

    await prisma.$transaction(async (tx) => {
      // 1. Actualizar movimiento
      await tx.movimientoCuenta.update({
        where: { id },
        data: {
          monto: toDecimal(montoNuevo),
          nota: nota !== undefined ? nota : movActual.nota,
          ...(fechaNueva && { createdAt: fechaNueva }),
        },
      });

      // 2. Ajustar saldo del socio si el monto cambió
      if (Math.abs(diferencia) > 0.001) {
        if (movActual.tipo === "AHORRO") {
          // Depósito: si sube el monto, el saldo sube
          await tx.socio.update({
            where: { id: movActual.socioId },
            data: { saldoAhorros: { increment: toDecimal(diferencia) } },
          });
        } else if (movActual.tipo === "RETIRO") {
          // Retiro: si sube el monto, el saldo baja más
          await tx.socio.update({
            where: { id: movActual.socioId },
            data: { saldoAhorros: { decrement: toDecimal(diferencia) } },
          });
        }
      }
    });

    return NextResponse.json({ ok: true, id, montoNuevo, diferencia });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Params }) {
  const id = Number((await ctx.params).id);
  if (!Number.isFinite(id))
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    const mov = await prisma.movimientoCuenta.findUnique({
      where: { id },
      select: { id: true, tipo: true, monto: true, socioId: true },
    });
    if (!mov) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    if (!["AHORRO", "RETIRO"].includes(mov.tipo))
      return NextResponse.json({ error: "Solo se pueden eliminar depósitos libres y retiros" }, { status: 400 });

    await prisma.$transaction(async (tx) => {
      await tx.movimientoCuenta.delete({ where: { id } });
      // Revertir saldo
      if (mov.tipo === "AHORRO") {
        await tx.socio.update({
          where: { id: mov.socioId },
          data: { saldoAhorros: { decrement: toDecimal(Number(mov.monto)) } },
        });
      } else {
        await tx.socio.update({
          where: { id: mov.socioId },
          data: { saldoAhorros: { increment: toDecimal(Number(mov.monto)) } },
        });
      }
    });

    return NextResponse.json({ ok: true, eliminado: id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
