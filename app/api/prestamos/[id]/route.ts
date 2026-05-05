// app/api/prestamos/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id);
    if (!id || isNaN(id)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const prestamo = await prisma.prestamo.findUnique({
      where: { id },
      include: {
        socio: {
          select: { id: true, nombres: true, apellidos: true, numeroCuenta: true },
        },
        ronda: {
          select: { id: true, nombre: true, activa: true },
        },
        cuotas: {
          orderBy: { numero: "asc" },
        },
      },
    });

    if (!prestamo) {
      return NextResponse.json({ error: "Préstamo no encontrado" }, { status: 404 });
    }

    const normalized = {
      ...prestamo,
      monto: Number(prestamo.monto),
      tasaAnual: Number(prestamo.tasaAnual),
      saldoActual: Number(prestamo.saldoActual),
      cuotas: prestamo.cuotas.map((c) => ({
        ...c,
        cuota: Number(c.cuota),
        interes: Number(c.interes),
        capital: Number(c.capital),
        saldo: Number(c.saldo),
      })),
    };

    return NextResponse.json({ prestamo: normalized });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Error al obtener préstamo" },
      { status: 500 }
    );
  }
}
