// app/api/prestamos/express/[id]/route.ts
// PUT /cobrar → marcar como cobrado, registrar interés en caja común
// PUT /acumular → sumar $1 de interés (al cerrar semana con express pendiente)

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

function round2(n: number) { return Math.round((n + Number.EPSILON) * 100) / 100; }
function toDecimal(n: number) { return new Prisma.Decimal(round2(n)); }

export async function PUT(req: Request, ctx: Context) {
  const { id } = await ctx.params;
  const expressId = Number(id);
  if (!Number.isFinite(expressId))
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    const body = await req.json();
    const accion = body?.accion; // "cobrar" | "acumular"

    const express = await (prisma as any).prestamoExpress.findUnique({
      where: { id: expressId },
      include: {
        socio: { select: { nombres: true, apellidos: true } },
        ronda: { select: { id: true, semanaActual: true } },
      },
    });
    if (!express) return NextResponse.json({ error: "Préstamo express no encontrado" }, { status: 404 });
    if (express.estado === "COBRADO") return NextResponse.json({ error: "Ya fue cobrado" }, { status: 400 });

    // ── Acción: acumular interés (se llama al cerrar semana) ──────────────────
    if (accion === "acumular") {
      const nuevoInteres = round2(Number(express.interesAcumulado) + Number(express.interesPorSemana));
      const nuevoTotal = round2(Number(express.principal) + nuevoInteres);

      await (prisma as any).prestamoExpress.update({
        where: { id: expressId },
        data: {
          interesAcumulado: toDecimal(nuevoInteres),
          total: toDecimal(nuevoTotal),
        },
      });

      return NextResponse.json({
        ok: true,
        interesAcumulado: nuevoInteres,
        total: nuevoTotal,
        mensaje: `Interés acumulado: $${nuevoInteres} (${nuevoTotal} total)`,
      });
    }

    // ── Acción: cobrar ────────────────────────────────────────────────────────
    if (accion === "cobrar") {
      const semanaActual = Number(express.ronda.semanaActual);
      const semanasRetraso = Math.max(0, semanaActual - Number(express.semanaVencimiento));

      // Recalcular interés final: $1 × semanas desde que se creó
      const semanasTranscurridas = Math.max(1, semanaActual - Number(express.semana));
      const interesFinal = round2(Number(express.interesPorSemana) * semanasTranscurridas);
      

      const interesReal = interesFinal;
      const totalFinalCorrecto = round2(Number(express.principal) + interesReal);

      // Marcar como cobrado
      await (prisma as any).prestamoExpress.update({
        where: { id: expressId },
        data: {
          estado: "COBRADO",
          semanaCobro: semanaActual,
          interesAcumulado: toDecimal(interesReal),
          total: toDecimal(totalFinalCorrecto),
        },
      });

      // Registrar interés en caja común (disponible para gastos de la ronda)
      if (interesReal > 0) {
        await (prisma as any).movimientoCaja.create({
          data: {
            rondaId: express.rondaId,
            tipo: "INTERES_EXPRESS",
            monto: toDecimal(interesReal),
            socioId: express.socioId,
            semana: semanaActual,
            prestamoExpressId: expressId,
            descripcion: `Interés express · ${express.socio.nombres} ${express.socio.apellidos} · sem. ${express.semana}→${semanaActual}`,
          },
        });
      }

      return NextResponse.json({
        ok: true,
        estado: "COBRADO",
        semanaCobro: semanaActual,
        semanasRetraso,
        principal: Number(express.principal),
        interesAcumulado: interesReal,
        total: totalFinalCorrecto,
        mensaje: `Cobrado en semana ${semanaActual}. Interés $${interesReal.toFixed(2)} ingresado a la caja común.`,
      });
    }

    return NextResponse.json({ error: "accion debe ser 'cobrar' o 'acumular'" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: Context) {
  const { id } = await ctx.params;
  const expressId = Number(id);
  try {
    await (prisma as any).prestamoExpress.delete({ where: { id: expressId } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
