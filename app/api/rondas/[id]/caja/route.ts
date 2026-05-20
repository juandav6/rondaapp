// app/api/rondas/[id]/caja/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const dec = (n: number) => new Prisma.Decimal(r2(n));

export async function GET(_req: Request, ctx: Ctx) {
  const rondaId = Number((await ctx.params).id);
  if (!Number.isFinite(rondaId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    const [ronda, movimientos, participaciones] = await Promise.all([
      prisma.ronda.findUnique({ where: { id: rondaId }, select: { id: true, nombre: true, activa: true, semanaActual: true } }),
      (prisma as any).movimientoCaja.findMany({
        where: { rondaId },
        include: { socio: { select: { id: true, nombres: true, apellidos: true, numeroCuenta: true } } },
        orderBy: { fecha: "desc" },
      }),
      prisma.participacion.findMany({
        where: { rondaId },
        include: { socio: { select: { id: true, nombres: true, apellidos: true, numeroCuenta: true } } },
        orderBy: { orden: "asc" },
      }),
    ]);

    if (!ronda) return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });

    const totalMultas    = r2(movimientos.filter((m: any) => m.tipo === "MULTA").reduce((s: number, m: any) => s + Number(m.monto), 0));
    const totalIntereses = r2(movimientos.filter((m: any) => m.tipo === "INTERES_EXPRESS").reduce((s: number, m: any) => s + Number(m.monto), 0));
    const totalGastos    = r2(movimientos.filter((m: any) => m.tipo === "GASTO").reduce((s: number, m: any) => s + Number(m.monto), 0));
    const totalIngresos  = r2(totalMultas + totalIntereses);
    const saldoCaja      = r2(totalIngresos - totalGastos);

    // Agrupado por socio
    const map = new Map<number, any>();
    movimientos.filter((m: any) => m.tipo !== "GASTO" && m.socioId).forEach((m: any) => {
      const p = map.get(m.socioId) ?? { socio: m.socio, multas: [], intereses: [], totalMultas: 0, totalIntereses: 0 };
      if (m.tipo === "MULTA") { p.multas.push({ id: m.id, semana: m.semana, monto: Number(m.monto), descripcion: m.descripcion, fecha: m.fecha }); p.totalMultas = r2(p.totalMultas + Number(m.monto)); }
      if (m.tipo === "INTERES_EXPRESS") { p.intereses.push({ id: m.id, semana: m.semana, monto: Number(m.monto), descripcion: m.descripcion, fecha: m.fecha }); p.totalIntereses = r2(p.totalIntereses + Number(m.monto)); }
      map.set(m.socioId, p);
    });

    return NextResponse.json({
      ronda,
      resumen: { totalMultas, totalIntereses, totalIngresos, totalGastos, saldoCaja },
      movimientos: movimientos.map((m: any) => ({ id: m.id, tipo: m.tipo, monto: Number(m.monto), socio: m.socio ?? null, semana: m.semana, descripcion: m.descripcion, fecha: m.fecha })),
      porSocio: Array.from(map.values()).filter(ps => ps.totalMultas > 0 || ps.totalIntereses > 0).sort((a: any, b: any) => (b.totalMultas + b.totalIntereses) - (a.totalMultas + a.totalIntereses)),
      socios: participaciones.map(p => ({ id: p.socio.id, nombres: p.socio.nombres, apellidos: p.socio.apellidos, numeroCuenta: p.socio.numeroCuenta })),
    });
  } catch (e: any) { return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 }); }
}

export async function POST(req: Request, ctx: Ctx) {
  const rondaId = Number((await ctx.params).id);
  if (!Number.isFinite(rondaId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  try {
    const body = await req.json();
    const { tipo, monto, socioId, semana, descripcion, fecha, prestamoExpressId } = body;
    if (!["MULTA", "INTERES_EXPRESS", "GASTO"].includes(tipo)) return NextResponse.json({ error: "tipo inválido" }, { status: 400 });
    if (!monto || Number(monto) <= 0) return NextResponse.json({ error: "monto inválido" }, { status: 400 });
    if (tipo !== "GASTO" && !socioId) return NextResponse.json({ error: "socioId requerido" }, { status: 400 });
    if (tipo === "GASTO" && !descripcion?.trim()) return NextResponse.json({ error: "descripción requerida" }, { status: 400 });

    if (tipo === "GASTO") {
      const agg = await (prisma as any).movimientoCaja.groupBy({ by: ["tipo"], where: { rondaId }, _sum: { monto: true } });
      const ing  = agg.filter((a: any) => a.tipo !== "GASTO").reduce((s: number, a: any) => s + Number(a._sum.monto ?? 0), 0);
      const gast = agg.filter((a: any) => a.tipo === "GASTO").reduce((s: number, a: any) => s + Number(a._sum.monto ?? 0), 0);
      const disp = r2(ing - gast);
      if (Number(monto) > disp + 0.01) return NextResponse.json({ error: `Saldo insuficiente. Disponible: $${disp.toFixed(2)}` }, { status: 400 });
    }

    const mov = await (prisma as any).movimientoCaja.create({
      data: { rondaId, tipo, monto: dec(Number(monto)), socioId: socioId ? Number(socioId) : null, semana: semana ? Number(semana) : null, descripcion: descripcion?.trim() || null, fecha: fecha ? new Date(`${fecha}T12:00:00Z`) : new Date(), prestamoExpressId: prestamoExpressId ? Number(prestamoExpressId) : null },
      include: { socio: { select: { nombres: true, apellidos: true } } },
    });
    return NextResponse.json({ ok: true, movimiento: { ...mov, monto: Number(mov.monto) } }, { status: 201 });
  } catch (e: any) { return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 }); }
}
