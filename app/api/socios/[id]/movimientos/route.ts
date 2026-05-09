// app/api/socios/[id]/movimientos/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: Context) {
  const { params } = await context;
  const socioId = Number((await params).id);

  if (!socioId || isNaN(socioId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const url = new URL(req.url);
  const tipo = url.searchParams.get("tipo"); // opcional: RETIRO | INVERSION | etc.

  const movimientos = await prisma.movimientoCuenta.findMany({
    where: {
      socioId,
      ...(tipo ? { tipo } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { ronda: { select: { nombre: true } } },
  });

  return NextResponse.json({
    movimientos: movimientos.map(m => ({
      id: m.id,
      tipo: m.tipo,
      monto: Number(m.monto),
      nota: m.nota,
      createdAt: m.createdAt,
      ronda: m.ronda,
    })),
  });
}
