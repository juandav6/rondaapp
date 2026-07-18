// app/api/rondas/[id]/gasto-compartido/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, _ctx: Ctx) {
  try {
    const socios = await prisma.socio.findMany({
      where: { activo: true },
      select: {
        id: true,
        nombres: true,
        apellidos: true,
        numeroCuenta: true,
        saldoAhorros: true,
      },
      orderBy: [{ apellidos: "asc" }, { nombres: "asc" }],
    });
    return NextResponse.json({
      socios: socios.map(s => ({ ...s, saldoAhorros: Number(s.saldoAhorros) })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request, ctx: Ctx) {
  const rondaId = Number((await ctx.params).id);
  try {
    const body = await req.json();
    const { descripcion, monto, socioIds } = body;

    if (!descripcion?.trim())
      return NextResponse.json({ error: "Descripción requerida" }, { status: 400 });
    if (!monto || Number(monto) <= 0)
      return NextResponse.json({ error: "Monto inválido" }, { status: 400 });
    if (!Array.isArray(socioIds) || socioIds.length === 0)
      return NextResponse.json({ error: "Selecciona al menos un socio" }, { status: 400 });

    const montoTotal = Number(monto);
    const count = socioIds.length;
    // Reparto equitativo: N-1 pagan el cociente redondeado, el último absorbe el residuo
    const base = Math.floor((montoTotal / count) * 100) / 100;
    const residuo = Math.round((montoTotal - base * count) * 100) / 100;

    const nota = `Gasto compartido: ${descripcion.trim()}`;

    const socios = await prisma.socio.findMany({
      where: { id: { in: socioIds }, activo: true },
      select: { id: true, nombres: true, apellidos: true, saldoAhorros: true },
    });

    if (socios.length !== socioIds.length)
      return NextResponse.json({ error: "Uno o más socios no encontrados o inactivos" }, { status: 400 });

    // Calcular monto por socio según posición
    const montosPorSocio = socios.map((s, i) => ({
      socio: s,
      monto: i === socios.length - 1 ? base + residuo : base,
    }));

    const insuficientes = montosPorSocio.filter(
      ({ socio, monto: m }) => Number(socio.saldoAhorros) < m
    );
    if (insuficientes.length > 0) {
      const nombres = insuficientes.map(({ socio }) => `${socio.nombres} ${socio.apellidos}`).join(", ");
      return NextResponse.json({ error: `Saldo insuficiente para: ${nombres}` }, { status: 400 });
    }

    const aplicados: { socioId: number; nombre: string; monto: number }[] = [];

    await prisma.$transaction(async (tx) => {
      for (const { socio, monto: m } of montosPorSocio) {
        const montoDecimal = new Prisma.Decimal(m.toFixed(2));
        await tx.movimientoCuenta.create({
          data: {
            socioId: socio.id,
            rondaId,
            tipo: "RETIRO",
            monto: montoDecimal,
            nota,
          },
        });
        await tx.socio.update({
          where: { id: socio.id },
          data: { saldoAhorros: { decrement: montoDecimal } },
        });
        aplicados.push({ socioId: socio.id, nombre: `${socio.nombres} ${socio.apellidos}`, monto: m });
      }
    });

    return NextResponse.json({ ok: true, aplicados, montoPorSocio: base, totalSocios: count });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
