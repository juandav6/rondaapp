// app/api/admin/rondas/[id]/registros/route.ts
// Lista todos los ahorros y aportes de una ronda para edición admin
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const rondaId = Number((await ctx.params).id);
  const { searchParams } = new URL(req.url);
  const tipo = searchParams.get("tipo") ?? "ahorros"; // "ahorros" | "aportes"
  const semana = searchParams.get("semana"); // opcional

  if (!Number.isFinite(rondaId))
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    if (tipo === "ahorros") {
      const ahorros = await prisma.ahorro.findMany({
        where: { rondaId, ...(semana ? { semana: Number(semana) } : {}) },
        include: { socio: { select: { id: true, nombres: true, apellidos: true, numeroCuenta: true } } },
        orderBy: [{ socioId: "asc" }, { semana: "asc" }],
      });
      return NextResponse.json(ahorros.map(a => ({
        id: a.id,
        socioId: a.socioId,
        semana: a.semana,
        monto: Number(a.monto),
        nombres: a.socio.nombres,
        apellidos: a.socio.apellidos,
        numeroCuenta: a.socio.numeroCuenta,
        observaciones: a.observaciones,
        fecha: a.fecha,
      })));
    }

    if (tipo === "aportes") {
      const aportes = await prisma.aporte.findMany({
        where: { rondaId, ...(semana ? { semana: Number(semana) } : {}) },
        include: { socio: { select: { id: true, nombres: true, apellidos: true, numeroCuenta: true } } },
        orderBy: [{ socioId: "asc" }, { semana: "asc" }],
      });
      return NextResponse.json(aportes.map(a => ({
        id: a.id,
        socioId: a.socioId,
        semana: a.semana,
        monto: Number(a.monto),
        multa: Number(a.multa),
        nombres: a.socio.nombres,
        apellidos: a.socio.apellidos,
        numeroCuenta: a.socio.numeroCuenta,
        observaciones: a.observaciones,
        fecha: a.fecha,
      })));
    }

    return NextResponse.json({ error: "tipo debe ser 'ahorros' o 'aportes'" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
