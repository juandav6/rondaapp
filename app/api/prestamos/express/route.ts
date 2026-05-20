// app/api/prestamos/express/route.ts
// Lógica:
// - Al crear: socio no puede pagar semana N → express por montoAporte, vence semana N+1
// - Al cerrar semana: si express sigue PENDIENTE → interésAcumulado += $1/semana
// - Al cobrar: marcar COBRADO, registrar semanaCobro, distribuir interés entre inversores

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";

function round2(n: number) { return Math.round((n + Number.EPSILON) * 100) / 100; }
function toDecimal(n: number) { return new Prisma.Decimal(round2(n)); }

// ── GET: todos los express de la ronda activa ──────────────────────────────────
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const rondaIdParam = searchParams.get("rondaId");

    let rondaId: number;
    if (rondaIdParam) {
      rondaId = Number(rondaIdParam);
    } else {
      const rondaActiva = await prisma.ronda.findFirst({ where: { activa: true }, select: { id: true } });
      if (!rondaActiva) return NextResponse.json({ prestamos: [] });
      rondaId = rondaActiva.id;
    }

    const ronda = await prisma.ronda.findUnique({
      where: { id: rondaId },
      select: { id: true, nombre: true, semanaActual: true, montoAporte: true },
    });

    const prestamos = await (prisma as any).prestamoExpress.findMany({
      where: { rondaId },
      include: { socio: { select: { id: true, nombres: true, apellidos: true, numeroCuenta: true } } },
      orderBy: [{ estado: "asc" }, { semana: "desc" }],
    });

    // Calcular interés actualizado para pendientes (sin guardar aún)
    const semanaActual = ronda?.semanaActual ?? 1;
    const prestamosConInteres = prestamos.map((p: any) => {
      const semanasTranscurridas = p.estado === "PENDIENTE"
        ? Math.max(0, semanaActual - Number(p.semanaVencimiento))
        : 0;
      const interesActualizado = round2(
        Number(p.interesPorSemana) * Math.max(1, semanaActual - Number(p.semana))
      );
      const totalActualizado = round2(Number(p.principal) + (p.estado === "PENDIENTE" ? interesActualizado : Number(p.interesAcumulado)));

      return {
        id: p.id,
        socio: p.socio,
        semana: Number(p.semana),
        semanaVencimiento: Number(p.semanaVencimiento),
        semanaCobro: p.semanaCobro,
        principal: Number(p.principal),
        interesPorSemana: Number(p.interesPorSemana),
        interesAcumulado: p.estado === "PENDIENTE" ? interesActualizado : Number(p.interesAcumulado),
        total: totalActualizado,
        estado: p.estado,
        observaciones: p.observaciones,
        semanasVencidas: semanasTranscurridas,
        createdAt: p.createdAt,
      };
    });

    const pendientes = prestamosConInteres.filter((p: any) => p.estado === "PENDIENTE");
    const cobrados = prestamosConInteres.filter((p: any) => p.estado === "COBRADO");
    const totalIntereses = round2(cobrados.reduce((s: number, p: any) => s + p.interesAcumulado, 0));
    const totalPendiente = round2(pendientes.reduce((s: number, p: any) => s + p.total, 0));

    return NextResponse.json({
      ronda,
      prestamos: prestamosConInteres,
      resumen: {
        totalPendientes: pendientes.length,
        totalCobrados: cobrados.length,
        montoPendiente: totalPendiente,
        interesesGenerados: totalIntereses,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}

// ── POST: crear préstamo express ──────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { rondaId, socioId, semana, observaciones } = body;

    if (!rondaId || !socioId || !semana)
      return NextResponse.json({ error: "rondaId, socioId y semana son requeridos" }, { status: 400 });

    const ronda = await prisma.ronda.findUnique({
      where: { id: Number(rondaId) },
      select: { id: true, montoAporte: true, semanaActual: true },
    });
    if (!ronda) return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });

    const principal = Number(ronda.montoAporte);
    const interesPorSemana = 1; // $1 fijo por semana
    const semanaVencimiento = Number(semana) + 1; // debe pagar la siguiente semana
    const interesAcumulado = interesPorSemana; // interés mínimo de 1 semana
    const total = round2(principal + interesAcumulado);

    // Verificar que no exista ya un express pendiente para este socio en esta semana
    const existente = await (prisma as any).prestamoExpress.findFirst({
      where: { rondaId: Number(rondaId), socioId: Number(socioId), semana: Number(semana), estado: "PENDIENTE" },
    });
    if (existente)
      return NextResponse.json({ error: "Ya existe un préstamo express pendiente para este socio en esta semana" }, { status: 400 });

    const express = await (prisma as any).prestamoExpress.create({
      data: {
        rondaId: Number(rondaId),
        socioId: Number(socioId),
        semana: Number(semana),
        semanaVencimiento,
        principal: toDecimal(principal),
        interesPorSemana: toDecimal(interesPorSemana),
        interesAcumulado: toDecimal(interesAcumulado),
        total: toDecimal(total),
        estado: "PENDIENTE",
        observaciones: observaciones || null,
      },
    });

    return NextResponse.json({
      id: express.id,
      principal,
      interesAcumulado,
      total,
      semanaVencimiento,
      mensaje: `Préstamo express creado. Vence semana ${semanaVencimiento}. Interés: $${interesAcumulado}/semana`,
    }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 400 });
  }
}
