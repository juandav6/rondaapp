// app/api/rondas/[id]/reporte/regenerar/route.ts
// Endpoint para regenerar y GUARDAR el Excel de una ronda específica
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generarExcel } from "@/lib/reportes/generarExcel";

export const runtime = "nodejs";

type Params = Promise<{ id: string }>;

export async function POST(_req: NextRequest, ctx: { params: Params }) {
  const session = await getServerSession(authOptions);
  if ((session?.user as any)?.rol !== "ADMIN")
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const { id } = await ctx.params;
  const rondaId = Number(id);
  if (!Number.isFinite(rondaId))
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  // Cargar datos completos de la ronda
  const rondaData = await prisma.ronda.findUnique({
    where: { id: rondaId },
    include: {
      participaciones: {
        include: { socio: { select: { nombres: true, apellidos: true, numeroCuenta: true } } },
        orderBy: { orden: "asc" },
      },
      aportes: {
        include: { socio: { select: { nombres: true, apellidos: true, numeroCuenta: true } } },
      },
      ahorros: {
        include: { socio: { select: { nombres: true, apellidos: true, numeroCuenta: true } } },
      },
      prestamos: {
        include: {
          socio: { select: { nombres: true, apellidos: true, numeroCuenta: true } },
          cuotas: { orderBy: { numero: "asc" } },
        },
      },
      prestamosExpress: {
        include: { socio: { select: { nombres: true, apellidos: true, numeroCuenta: true } } },
      },
      cuentasInversion: {
        include: { socio: { select: { nombres: true, apellidos: true, numeroCuenta: true } } },
      },
      responsablesSemana: {
        include: { socio: { select: { nombres: true, apellidos: true } } },
      },
      movimientosCaja: {
        where: { estado: "PENDIENTE", tipo: "MULTA" },
        include: { socio: { select: { nombres: true, apellidos: true, numeroCuenta: true } } },
        orderBy: { semana: "asc" },
      },
      movimientos: {
        where: { tipo: "INTERES" },
        select: { socioId: true, monto: true, tipo: true },
      },
    },
  });

  if (!rondaData)
    return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });

  try {
    const excelBuffer = await generarExcel(rondaData);

    // Intentar con Prisma ORM primero
    try {
      await (prisma.ronda as any).update({
        where: { id: rondaId },
        data: {
          reporteExcel: Buffer.from(excelBuffer),
          reporteGeneradoAt: new Date(),
        },
      });
    } catch (saveErr: any) {
      // Fallback a SQL crudo si prisma client no está actualizado
      if (saveErr?.message?.includes("Unknown argument")) {
        await prisma.$executeRaw`
          UPDATE rondas
          SET reporte_excel = ${Buffer.from(excelBuffer)},
              reporte_generado_at = NOW()
          WHERE id = ${rondaId}
        `;
      } else {
        throw saveErr;
      }
    }

    return NextResponse.json({
      ok: true,
      ronda: rondaData.nombre,
      bytes: excelBuffer.byteLength,
      generadoAt: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Error generando Excel" },
      { status: 500 }
    );
  }
}
