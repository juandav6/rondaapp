// app/api/rondas/[id]/multas/route.ts
// GET  → resumen caja multas: total recaudado, gastos, disponible, detalle por socio
// POST → registrar un gasto de la caja de multas
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

function round2(n: number) { return Math.round((n + Number.EPSILON) * 100) / 100; }

export async function GET(_req: Request, ctx: Context) {
  const rondaId = Number((await ctx.params).id);
  if (!Number.isFinite(rondaId))
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    const [ronda, aportes, gastos] = await Promise.all([
      prisma.ronda.findUnique({
        where: { id: rondaId },
        select: { id: true, nombre: true, activa: true, semanaActual: true },
      }),
      // Todos los aportes con multa > 0
      prisma.aporte.findMany({
        where: { rondaId, multa: { gt: 0 } },
        include: {
          socio: { select: { nombres: true, apellidos: true, numeroCuenta: true } },
        },
        orderBy: { semana: "asc" },
      }),
      // Gastos registrados contra la caja
      (prisma as any).gastoMulta.findMany({
        where: { rondaId },
        orderBy: { fecha: "desc" },
      }),
    ]);

    if (!ronda) return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });

    // Total recaudado en multas
    const totalMultas = round2(aportes.reduce((s, a) => s + Number(a.multa), 0));

    // Total gastado
    const totalGastado = round2(gastos.reduce((s: number, g: any) => s + Number(g.monto), 0));

    // Disponible
    const disponible = round2(totalMultas - totalGastado);

    // Resumen por socio
    const porSocioMap = new Map<number, { socio: any; semanas: number[]; total: number }>();
    aportes.forEach(a => {
      const key = a.socioId;
      const prev = porSocioMap.get(key);
      if (prev) {
        prev.semanas.push(a.semana);
        prev.total = round2(prev.total + Number(a.multa));
      } else {
        porSocioMap.set(key, {
          socio: a.socio,
          semanas: [a.semana],
          total: Number(a.multa),
        });
      }
    });

    return NextResponse.json({
      ronda,
      resumen: { totalMultas, totalGastado, disponible },
      detalleAportes: aportes.map(a => ({
        id: a.id,
        semana: a.semana,
        socio: a.socio,
        multa: Number(a.multa),
        fecha: a.fecha,
      })),
      porSocio: Array.from(porSocioMap.values())
        .sort((a, b) => b.total - a.total),
      gastos: gastos.map((g: any) => ({
        id: g.id,
        descripcion: g.descripcion,
        monto: Number(g.monto),
        fecha: g.fecha,
        creadoPor: g.creadoPor,
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}

export async function POST(req: Request, ctx: Context) {
  const rondaId = Number((await ctx.params).id);
  if (!Number.isFinite(rondaId))
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    const body = await req.json();
    const descripcion = String(body?.descripcion ?? "").trim();
    const monto = Number(body?.monto);
    const fecha = body?.fecha ? new Date(`${body.fecha}T12:00:00Z`) : new Date();

    if (!descripcion) return NextResponse.json({ error: "Descripción requerida" }, { status: 400 });
    if (!monto || monto <= 0) return NextResponse.json({ error: "Monto inválido" }, { status: 400 });

    // Verificar que hay saldo disponible
    const [multasAgg, gastosAgg] = await Promise.all([
      prisma.aporte.aggregate({
        where: { rondaId, multa: { gt: 0 } },
        _sum: { multa: true },
      }),
      (prisma as any).gastoMulta.aggregate({
        where: { rondaId },
        _sum: { monto: true },
      }),
    ]);

    const totalMultas = round2(Number(multasAgg._sum.multa ?? 0));
    const totalGastado = round2(Number(gastosAgg._sum.monto ?? 0));
    const disponible = round2(totalMultas - totalGastado);

    if (monto > disponible + 0.01) {
      return NextResponse.json({
        error: `Saldo insuficiente. Disponible: $${disponible.toFixed(2)}, solicitado: $${monto.toFixed(2)}.`
      }, { status: 400 });
    }

    const gasto = await (prisma as any).gastoMulta.create({
      data: {
        rondaId,
        descripcion,
        monto: new Prisma.Decimal(round2(monto)),
        fecha,
      },
    });

    return NextResponse.json({
      ok: true,
      gasto: { ...gasto, monto: Number(gasto.monto) },
      nuevoDisponible: round2(disponible - monto),
    }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
