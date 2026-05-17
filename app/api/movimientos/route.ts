// app/api/movimientos/route.ts
// GET → lista paginada de movimientos con filtros tipo, socio, fechas
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const tipo = searchParams.get("tipo") ?? "AHORRO";
  const socioId = searchParams.get("socioId");
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 50)));

  try {
    // Para AHORRO (depósitos libres): excluir los que tienen rondaId (esos son ahorros de ronda, no depósitos libres)
    // Para RETIRO: mostrar todos independientemente del rondaId
    const where: any = { tipo };
    if (tipo === "AHORRO") where.rondaId = null; // solo depósitos libres
    if (socioId) where.socioId = Number(socioId);
    if (desde) where.createdAt = { ...where.createdAt, gte: new Date(desde + "T00:00:00Z") };
    if (hasta) where.createdAt = { ...where.createdAt, lte: new Date(hasta + "T23:59:59Z") };

    const [total, movimientos, agg] = await Promise.all([
      prisma.movimientoCuenta.count({ where }),
      prisma.movimientoCuenta.findMany({
        where,
        include: { socio: { select: { id: true, nombres: true, apellidos: true, numeroCuenta: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.movimientoCuenta.aggregate({ where, _sum: { monto: true } }),
    ]);

    return NextResponse.json({
      total,
      page,
      pages: Math.ceil(total / limit),
      totalMonto: Number(agg._sum.monto ?? 0),
      debug: { tipo, rondaIdFilter: tipo === "AHORRO" ? null : "none", socioId: socioId ?? "all" },
      movimientos: movimientos.map(m => ({
        id: m.id,
        tipo: m.tipo,
        monto: Number(m.monto),
        nota: m.nota,
        fecha: m.createdAt,
        socio: m.socio,
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
