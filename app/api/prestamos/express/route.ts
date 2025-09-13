// app/api/prestamos/express/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// GET: lista préstamos express (pendientes por defecto)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const estado = searchParams.get("estado") || "PENDIENTE"; // PENDIENTE|CANCELADO|PAGADO
  const items = await prisma.prestamoExpress.findMany({
    where: estado ? { estado: estado as any } : {},
    orderBy: { createdAt: "desc" },
    include: {
      socio: { select: { id: true, nombres: true, apellidos: true, numeroCuenta: true } },
      ronda: { select: { id: true, nombre: true } },
    },
  });
  return NextResponse.json(items);
}

// POST: crear préstamo express
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { rondaId, semana, socioId, principal, interes, observaciones } = body as {
      rondaId: number; semana: number; socioId: number; principal: number; interes?: number; observaciones?: string;
    };

    if (!rondaId || !semana || !socioId || !(principal >= 0))
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });

    const prestamo = await prisma.prestamoExpress.create({
      data: {
        rondaId,
        semana,
        socioId,
        principal: new Prisma.Decimal(Number(principal || 0)),
        interes: new Prisma.Decimal(Number(interes || 0)),
        total: new Prisma.Decimal(Number(principal || 0) + Number(interes || 0)),
        estado: "PENDIENTE",
        observaciones: observaciones || null,
      },
      select: { id: true },
    });

    return NextResponse.json({ id: prestamo.id, ok: true });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: "No se pudo crear el préstamo" }, { status: 500 });
  }
}

// PUT: cancelar (anular) préstamo express
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, revertirAporte } = body as { id: number; revertirAporte?: boolean };

    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

    // Busca préstamo
    const px = await prisma.prestamoExpress.findUnique({ where: { id } });
    if (!px) return NextResponse.json({ error: "Préstamo no encontrado" }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      // Marca préstamo como CANCELADO
      await tx.prestamoExpress.update({ where: { id }, data: { estado: "CANCELADO" } });

      // Reversión del aporte de esa semana (si así se indica y existe vínculo)
      if (revertirAporte) {
        // si tu Aporte tiene clave compuesta (rondaId, socioId, semana) y un campo prestamoExpressId
        const aporte = await tx.aporte.findUnique({
          where: { rondaId_socioId_semana: { rondaId: px.rondaId, socioId: px.socioId, semana: px.semana } },
          select: { prestamoExpressId: true },
        }).catch(() => null);

        if (aporte && (aporte as any).prestamoExpressId === id) {
          // elimina o anula el aporte
          await tx.aporte.delete({
            where: { rondaId_socioId_semana: { rondaId: px.rondaId, socioId: px.socioId, semana: px.semana } },
          });
        }
      }
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: "No se pudo cancelar el préstamo" }, { status: 500 });
  }
}
