// app/api/rondas/[id]/semanas/resumen/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs"; // Prisma en server
// export const dynamic = "force-dynamic"; // opcional para evitar cache en dev

type Ctx = { params: Promise<{ id: string }> }; // Next 15: params es Promise

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const rondaId = Number(id);
    if (!Number.isFinite(rondaId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    // 1) Ronda + #semanas (= cantidad de participantes)
    const ronda = await prisma.ronda.findUnique({
      where: { id: rondaId },
      select: {
        id: true,
        participaciones: { select: { socioId: true } },
      },
    });
    if (!ronda) {
      return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });
    }
    const duracionSemanas = ronda.participaciones.length;

    // 2) Sumar aportes por semana
    const aportes = await prisma.aporte.groupBy({
      by: ["semana"],
      where: { rondaId },
      _sum: { monto: true },
    });
    const aportesMap = new Map<number, number>(
      aportes.map((r) => [r.semana, Number(r._sum.monto ?? 0)])
    );

    // 3) Sumar ahorros por semana
    const ahorros = await prisma.ahorro.groupBy({
      by: ["semana"],
      where: { rondaId },
      _sum: { monto: true },
    });
    const ahorrosMap = new Map<number, number>(
      ahorros.map((r) => [r.semana, Number(r._sum.monto ?? 0)])
    );

    // 4) Responsables por semana
    const responsables = await prisma.responsableCobroSemana.findMany({
      where: { rondaId },
      include: { socio: { select: { nombres: true, apellidos: true } } },
    });
    const respMap = new Map<number, string>(
      responsables.map((r) => [
        r.semana,
        [r.socio?.nombres, r.socio?.apellidos].filter(Boolean).join(" ").trim(),
      ])
    );

    // 5) Construir 1..duracionSemanas (incluye semanas sin movimiento)
    const semanas = Array.from({ length: Math.max(1, duracionSemanas) }, (_, i) => {
      const w = i + 1;
      return {
        semana: w,
        totalAportes: aportesMap.get(w) ?? 0,
        totalAhorros: ahorrosMap.get(w) ?? 0,
        responsableNombre: respMap.get(w) || null,
      };
    });

    return NextResponse.json({ semanas });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e?.message ?? "Error inesperado" }, { status: 500 });
  }
}
