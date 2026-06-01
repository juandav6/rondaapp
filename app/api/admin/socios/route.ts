// app/api/admin/socios/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { registrarBitacora, diffObjetos } from "@/lib/bitacora";

export const runtime = "nodejs";

export async function GET() {
  try {
    const socios = await prisma.socio.findMany({
      orderBy: { numeroCuenta: "asc" },
      select: {
        id: true, numeroCuenta: true, nombres: true, apellidos: true,
        cedula: true, edad: true, saldoAhorros: true, multas: true, activo: true,
        _count: { select: { aportes: true, ahorros: true, prestamos: true } },
      },
    });
    return NextResponse.json(socios.map(s => ({
      ...s, saldoAhorros: Number(s.saldoAhorros),
    })));
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
