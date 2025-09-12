// app/api/ahorros/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const socioIdStr = searchParams.get("socioId");
    const desde = searchParams.get("desde");
    const hasta = searchParams.get("hasta");

    const socioId = Number(socioIdStr);
    if (!Number.isFinite(socioId) || socioId <= 0) {
      return NextResponse.json({ error: "socioId inválido" }, { status: 400 });
    }

    // Filtro de fechas opcional
    const where: any = { socioId };
    if (desde || hasta) {
      where.fecha = {};
      if (desde) {
        // Desde 00:00:00
        const d = new Date(desde);
        d.setHours(0, 0, 0, 0);
        where.fecha.gte = d;
      }
      if (hasta) {
        // Hasta 23:59:59.999
        const h = new Date(hasta);
        h.setHours(23, 59, 59, 999);
        where.fecha.lte = h;
      }
    }

    const list = await prisma.ahorro.findMany({
      where,
      include: { ronda: { select: { id: true, nombre: true } } },
      orderBy: [{ fecha: "desc" }, { id: "desc" }],
    });

    const items = list.map((a) => ({
      id: a.id,
      rondaId: a.rondaId,
      rondaNombre: a.ronda?.nombre ?? null,
      semana: a.semana,
      monto: Number(a.monto),
      fecha: a.fecha.toISOString(),
    }));

    // Saldo total del socio (independiente de filtros)
    const agg = await prisma.ahorro.aggregate({
      where: { socioId },
      _sum: { monto: true },
    });
    const saldoTotal = Number(agg._sum.monto ?? 0);

    return NextResponse.json({ items, saldo: saldoTotal, saldoTotal });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error inesperado" }, { status: 500 });
  }
}
