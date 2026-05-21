// app/api/rondas/[id]/reporte/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generarExcel } from "@/lib/reportes/generarExcel";

export const runtime = "nodejs";

type Params = Promise<{ id: string }>;

export async function GET(_req: NextRequest, ctx: { params: Params }) {
  const session = await getServerSession(authOptions);
  if ((session?.user as any)?.rol !== "ADMIN")
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const { id } = await ctx.params;
  const rondaId = Number(id);
  if (!Number.isFinite(rondaId))
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  // Buscar el Excel guardado en la BD
  const ronda = await prisma.ronda.findUnique({
    where: { id: rondaId },
    select: {
      id: true,
      nombre: true,
      activa: true,
      reporteExcel: true,
      reporteGeneradoAt: true,
    },
  });

  if (!ronda) return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });

  let excelBuffer: Buffer;
  const fecha = new Date().toISOString().slice(0, 10);

  if (ronda.reporteExcel) {
    // Usar el Excel guardado al cierre
    excelBuffer = Buffer.from(ronda.reporteExcel);
  } else {
    // Generar al vuelo (ronda activa o sin Excel guardado)
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
      },
    });

    if (!rondaData) return NextResponse.json({ error: "No se pudo cargar la ronda" }, { status: 500 });
    excelBuffer = Buffer.from(await generarExcel(rondaData));
  }

  const filename = `reporte_${ronda.nombre}_${fecha}.xlsx`;

  return new NextResponse(excelBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(excelBuffer.length),
    },
  });
}
