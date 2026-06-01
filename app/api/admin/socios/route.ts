// app/api/admin/socios/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { registrarBitacora, diffObjetos } from "@/lib/bitacora";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const soloInactivos = searchParams.get("inactivos") === "1";

    const todos = await prisma.socio.findMany({
      orderBy: { numeroCuenta: "asc" },
      select: {
        id: true, numeroCuenta: true, nombres: true, apellidos: true,
        cedula: true, edad: true, saldoAhorros: true, multas: true,
        _count: { select: { aportes: true, ahorros: true, prestamos: true } },
      },
    });

    // Filtrar por activo usando el campo directo (post-query hasta que prisma generate corra)
    const socios = soloInactivos
      ? todos.filter((s: any) => s.activo === false)
      : todos.filter((s: any) => s.activo !== false);

    return NextResponse.json(socios.map((s: any) => ({
      ...s, saldoAhorros: Number(s.saldoAhorros),
    })));
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
