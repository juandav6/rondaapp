// app/api/socios/[id]/retiro/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

type Context = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: Context) {
  const { params } = await context;
  const socioId = Number((await params).id);

  if (!socioId || isNaN(socioId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const body = await req.json();
  const monto = Number(body?.monto ?? 0);
  const nota = String(body?.nota ?? "").trim();

  if (monto <= 0) {
    return NextResponse.json({ error: "El monto debe ser mayor a 0" }, { status: 400 });
  }
  if (!nota) {
    return NextResponse.json({ error: "La nota es requerida" }, { status: 400 });
  }

  const socio = await prisma.socio.findUnique({
    where: { id: socioId },
    select: { id: true, nombres: true, apellidos: true, saldoAhorros: true },
  });

  if (!socio) {
    return NextResponse.json({ error: "Socio no encontrado" }, { status: 404 });
  }

  if (Number(socio.saldoAhorros) < monto) {
    return NextResponse.json({
      error: `Saldo insuficiente. Disponible: $${Number(socio.saldoAhorros).toFixed(2)}`,
    }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    // Descontar saldo
    const updated = await tx.socio.update({
      where: { id: socioId },
      data: { saldoAhorros: { decrement: new Prisma.Decimal(monto) } },
      select: { saldoAhorros: true },
    });

    // Registrar movimiento
    await tx.movimientoCuenta.create({
      data: {
        socioId,
        tipo: "RETIRO",
        monto: new Prisma.Decimal(monto),
        nota,
      },
    });

    return updated;
  });

  return NextResponse.json({
    ok: true,
    nuevoSaldo: Number(result.saldoAhorros),
  });
}
