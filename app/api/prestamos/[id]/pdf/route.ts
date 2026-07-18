// app/api/prestamos/[id]/pdf/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generarPDFPrestamo } from "@/lib/reportes/generarPDFPrestamo";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const id = Number((await ctx.params).id);
  if (isNaN(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    const prestamo = await prisma.prestamo.findUnique({
      where: { id },
      include: {
        socio: { select: { id: true, nombres: true, apellidos: true, numeroCuenta: true } },
        ronda: { select: { id: true, nombre: true } },
        cuotas: { orderBy: { numero: "asc" } },
      },
    });

    if (!prestamo) return NextResponse.json({ error: "Préstamo no encontrado" }, { status: 404 });

    const pdfBuffer = await generarPDFPrestamo({
      ...prestamo,
      monto:     Number(prestamo.monto),
      tasaAnual: Number(prestamo.tasaAnual),
      saldoActual: Number(prestamo.saldoActual),
      cuotas: prestamo.cuotas.map(c => ({
        ...c,
        cuota:   Number(c.cuota),
        capital: Number(c.capital),
        interes: Number(c.interes),
        saldo:   Number(c.saldo),
      })),
    });

    const nombre = `${prestamo.socio.apellidos}-${prestamo.socio.nombres}`.replace(/\s+/g, "_");
    const filename = `amortizacion-prestamo-${id}-${nombre}.pdf`;

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Content-Length": String(pdfBuffer.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    console.error("[PDF prestamo]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
