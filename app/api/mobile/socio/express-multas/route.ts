// app/api/mobile/socio/express-multas/route.ts
// Consolida, en una sola consulta por lado, lo que la pestaña "Express" del
// portal web arma con varios fetches (uno por ronda). Misma fórmula de
// interés que app/api/prestamos/express/route.ts (GET).
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireMobileUser } from "@/lib/mobile-auth";

export const runtime = "nodejs";

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export async function GET(req: NextRequest) {
  const auth = requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const { user } = auth;

  let socioId: number | null = null;
  if (user.rol === "ADMIN") {
    const qp = req.nextUrl.searchParams.get("socioId");
    socioId = qp ? Number(qp) : null;
  } else {
    socioId = user.socioId;
  }
  if (!socioId) return NextResponse.json({ error: "Falta socioId" }, { status: 400 });

  const [expressRaw, multasRaw] = await Promise.all([
    prisma.prestamoExpress.findMany({
      where: { socioId },
      include: { ronda: { select: { id: true, nombre: true, semanaActual: true } } },
      orderBy: [{ estado: "asc" }, { semana: "desc" }],
    }),
    prisma.movimientoCaja.findMany({
      where: { socioId, tipo: "MULTA" },
      include: { ronda: { select: { nombre: true } } },
      orderBy: { fecha: "desc" },
    }),
  ]);

  const express = expressRaw.map(p => {
    const semanaActual = p.ronda.semanaActual;
    const semanasVencidas = p.estado === "PENDIENTE" ? Math.max(0, semanaActual - Number(p.semanaVencimiento)) : 0;
    const interesActualizado = round2(Number(p.interesPorSemana) * Math.max(1, semanaActual - Number(p.semana)));
    const interesAcumulado = p.estado === "PENDIENTE" ? interesActualizado : Number(p.interesAcumulado);
    const total = round2(Number(p.principal) + interesAcumulado);

    return {
      id: p.id,
      rondaNombre: p.ronda.nombre,
      semana: p.semana,
      principal: Number(p.principal),
      interesAcumulado,
      total,
      estado: p.estado,
      semanasVencidas,
      createdAt: p.createdAt,
    };
  });

  const multas = multasRaw.map(m => ({
    id: m.id,
    rondaNombre: m.ronda.nombre,
    estado: m.estado,
    monto: Number(m.monto),
    semana: m.semana,
    descripcion: m.descripcion,
    fecha: m.fecha,
  }));

  return NextResponse.json({ express, multas });
}
