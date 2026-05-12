// app/api/rondas/[id]/prestamos-activos/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const rondaId = Number(params.id);
  if (!rondaId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const prestamos = await prisma.prestamo.findMany({
    where: { rondaId, estado: "ACTIVO" },
    select: {
      id: true,
      monto: true,
      saldoActual: true,
      tasaAnual: true,
      estado: true,
      socio: {
        select: { nombres: true, apellidos: true, numeroCuenta: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(
    prestamos.map(p => ({
      id: p.id,
      monto: Number(p.monto),
      saldoActual: Number(p.saldoActual),
      tasaAnual: Number(p.tasaAnual),
      estado: p.estado,
      socio: p.socio,
    }))
  );
}
