// app/api/rondas/[id]/multas/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

function round2(n: number) { return Math.round((n + Number.EPSILON) * 100) / 100; }
function toDecimal(n: number) { return new Prisma.Decimal(round2(n)); }

// ── GET: resumen completo de la caja de multas ────────────────────────────────
export async function GET(_req: Request, ctx: Context) {
  const rondaId = Number((await ctx.params).id);
  if (!Number.isFinite(rondaId))
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    const [ronda, ingresos, gastos] = await Promise.all([
      prisma.ronda.findUnique({
        where: { id: rondaId },
        select: { id: true, nombre: true, activa: true, semanaActual: true },
      }),
      // Ingresos: multas cobradas por socio/semana
      (prisma as any).ingresoMulta.findMany({
        where: { rondaId },
        include: { socio: { select: { nombres: true, apellidos: true, numeroCuenta: true } } },
        orderBy: { fecha: "desc" },
      }),
      // Gastos: en qué se usó la caja
      (prisma as any).gastoMulta.findMany({
        where: { rondaId },
        orderBy: { fecha: "desc" },
      }),
    ]);

    if (!ronda) return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });

    const totalIngresos = round2(ingresos.reduce((s: number, i: any) => s + Number(i.monto), 0));
    const totalGastado = round2(gastos.reduce((s: number, g: any) => s + Number(g.monto), 0));
    const disponible = round2(totalIngresos - totalGastado);

    // Resumen por socio
    const porSocioMap = new Map<number, { socio: any; semanas: number[]; total: number; observaciones: string[] }>();
    ingresos.forEach((i: any) => {
      const prev = porSocioMap.get(i.socioId);
      if (prev) {
        prev.semanas.push(i.semana);
        prev.total = round2(prev.total + Number(i.monto));
        if (i.observaciones) prev.observaciones.push(i.observaciones);
      } else {
        porSocioMap.set(i.socioId, {
          socio: i.socio,
          semanas: [i.semana],
          total: Number(i.monto),
          observaciones: i.observaciones ? [i.observaciones] : [],
        });
      }
    });

    // Socios disponibles para el formulario
    const socios = await prisma.participacion.findMany({
      where: { rondaId },
      include: { socio: { select: { id: true, nombres: true, apellidos: true, numeroCuenta: true } } },
      orderBy: { orden: "asc" },
    });

    return NextResponse.json({
      ronda,
      resumen: { totalIngresos, totalGastado, disponible },
      ingresos: ingresos.map((i: any) => ({
        id: i.id,
        socio: i.socio,
        semana: i.semana,
        monto: Number(i.monto),
        observaciones: i.observaciones,
        fecha: i.fecha,
      })),
      porSocio: Array.from(porSocioMap.values()).sort((a, b) => b.total - a.total),
      gastos: gastos.map((g: any) => ({
        id: g.id,
        descripcion: g.descripcion,
        monto: Number(g.monto),
        fecha: g.fecha,
        creadoPor: g.creadoPor,
      })),
      socios: socios.map(p => ({
        id: p.socio.id,
        nombres: p.socio.nombres,
        apellidos: p.socio.apellidos,
        numeroCuenta: p.socio.numeroCuenta,
        orden: p.orden,
      })),
      totalSemanas: ronda.semanaActual - 1,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}

// ── POST: registrar ingreso o gasto ──────────────────────────────────────────
export async function POST(req: Request, ctx: Context) {
  const rondaId = Number((await ctx.params).id);
  if (!Number.isFinite(rondaId))
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    const body = await req.json();
    const tipo = body?.tipo; // "ingreso" | "gasto"

    if (tipo === "ingreso") {
      const socioId = Number(body?.socioId);
      const semana = Number(body?.semana);
      const monto = Number(body?.monto);
      const observaciones = String(body?.observaciones ?? "").trim() || null;
      const fecha = body?.fecha ? new Date(`${body.fecha}T12:00:00Z`) : new Date();

      if (!socioId || socioId <= 0) return NextResponse.json({ error: "Socio requerido" }, { status: 400 });
      if (!semana || semana <= 0) return NextResponse.json({ error: "Semana requerida" }, { status: 400 });
      if (!monto || monto <= 0) return NextResponse.json({ error: "Monto inválido" }, { status: 400 });

      const ingreso = await (prisma as any).ingresoMulta.create({
        data: { rondaId, socioId, semana, monto: toDecimal(monto), observaciones, fecha },
        include: { socio: { select: { nombres: true, apellidos: true, numeroCuenta: true } } },
      });

      return NextResponse.json({
        ok: true,
        tipo: "ingreso",
        ingreso: { ...ingreso, monto: Number(ingreso.monto) },
      }, { status: 201 });

    } else if (tipo === "gasto") {
      const descripcion = String(body?.descripcion ?? "").trim();
      const monto = Number(body?.monto);
      const fecha = body?.fecha ? new Date(`${body.fecha}T12:00:00Z`) : new Date();

      if (!descripcion) return NextResponse.json({ error: "Descripción requerida" }, { status: 400 });
      if (!monto || monto <= 0) return NextResponse.json({ error: "Monto inválido" }, { status: 400 });

      // Verificar saldo disponible
      const [ingresosAgg, gastosAgg] = await Promise.all([
        (prisma as any).ingresoMulta.aggregate({ where: { rondaId }, _sum: { monto: true } }),
        (prisma as any).gastoMulta.aggregate({ where: { rondaId }, _sum: { monto: true } }),
      ]);
      const disponible = round2(Number(ingresosAgg._sum.monto ?? 0) - Number(gastosAgg._sum.monto ?? 0));
      if (monto > disponible + 0.01)
        return NextResponse.json({ error: `Saldo insuficiente. Disponible: $${disponible.toFixed(2)}` }, { status: 400 });

      const gasto = await (prisma as any).gastoMulta.create({
        data: { rondaId, descripcion, monto: toDecimal(monto), fecha },
      });

      return NextResponse.json({
        ok: true,
        tipo: "gasto",
        gasto: { ...gasto, monto: Number(gasto.monto) },
        nuevoDisponible: round2(disponible - monto),
      }, { status: 201 });

    } else {
      return NextResponse.json({ error: "tipo debe ser 'ingreso' o 'gasto'" }, { status: 400 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
