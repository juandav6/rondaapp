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

    // Filtro de fechas
    const fechaFilter: any = {};
    if (desde) fechaFilter.gte = new Date(`${desde}T00:00:00Z`);
    if (hasta) fechaFilter.lte = new Date(`${hasta}T23:59:59Z`);
    const hasFecha = Object.keys(fechaFilter).length > 0;

    // ── Ahorros de rondas ────────────────────────────────────────────────────
    const ahorrosRonda = await prisma.ahorro.findMany({
      where: {
        socioId,
        monto: { gt: 0 },
        ...(hasFecha ? { fecha: fechaFilter } : {}),
      },
      include: { ronda: { select: { id: true, nombre: true } } },
      orderBy: [{ fecha: "desc" }, { id: "desc" }],
    });

    // ── Depósitos y retiros libres (movimientos sin ronda) ───────────────────
    const movimientosLibres = await prisma.movimientoCuenta.findMany({
      where: {
        socioId,
        tipo: { in: ["AHORRO", "RETIRO"] },
        rondaId: null,
        ...(hasFecha ? { createdAt: fechaFilter } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });

    // ── Combinar ─────────────────────────────────────────────────────────────
    const itemsRonda = ahorrosRonda.map((a) => ({
      id: `r_${a.id}`,
      tipo: "ronda",
      rondaId: a.rondaId,
      rondaNombre: a.ronda?.nombre ?? null,
      semana: a.semana,
      monto: Number(a.monto),
      fecha: a.fecha.toISOString(),
      nota: null,
    }));

    const itemsLibres = movimientosLibres.map((m) => ({
      id: `m_${m.id}`,
      tipo: m.tipo === "RETIRO" ? "retiro" : "deposito",
      rondaId: null,
      rondaNombre: m.tipo === "RETIRO" ? "Retiro" : "Depósito libre",
      semana: null,
      monto: m.tipo === "RETIRO" ? -Number(m.monto) : Number(m.monto),
      fecha: m.createdAt.toISOString(),
      nota: m.nota,
    }));

    const items = [...itemsRonda, ...itemsLibres].sort(
      (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
    );

    // Saldo real del socio (campo saldoAhorros en la tabla socios)
    // Este es SIEMPRE la fuente de verdad — suma ahorros de rondas + depósitos libres
    const socio = await prisma.socio.findUnique({
      where: { id: socioId },
      select: { saldoAhorros: true },
    });
    const saldoTotal = Number(socio?.saldoAhorros ?? 0);

    return NextResponse.json({ items, saldo: saldoTotal, saldoTotal });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error inesperado" }, { status: 500 });
  }
}
