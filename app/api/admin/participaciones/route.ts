// app/api/admin/participaciones/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { registrarBitacora, diffObjetos, CambiosCadena } from "@/lib/bitacora";

export const runtime = "nodejs";

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/* ───── GET  ?rondaId=X ───── */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const rondaId = Number(searchParams.get("rondaId"));
    if (!rondaId) return NextResponse.json({ error: "rondaId requerido" }, { status: 400 });

    const participaciones = await prisma.participacion.findMany({
      where: { rondaId },
      include: {
        socio: { select: { id: true, nombres: true, apellidos: true, numeroCuenta: true } },
      },
      orderBy: { orden: "asc" },
    });

    return NextResponse.json({ participaciones });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}

/* ───── POST  Agregar socio a ronda ───── */
export async function POST(req: Request) {
  try {
    const { rondaId, socioId, orden } = await req.json();
    if (!rondaId || !socioId || orden === undefined)
      return NextResponse.json({ error: "rondaId, socioId y orden son requeridos" }, { status: 400 });

    // Verificar unicidad [rondaId, socioId]
    const existe = await prisma.participacion.findUnique({
      where: { rondaId_socioId: { rondaId: Number(rondaId), socioId: Number(socioId) } },
    });
    if (existe)
      return NextResponse.json({ error: "El socio ya participa en esta ronda" }, { status: 409 });

    const nueva = await prisma.participacion.create({
      data: {
        rondaId: Number(rondaId),
        socioId: Number(socioId),
        orden: Number(orden),
      },
    });

    await registrarBitacora({
      tabla: "participaciones",
      registroId: nueva.id,
      accion: "CREAR",
      camposCambios: {
        rondaId: { antes: null, despues: nueva.rondaId },
        socioId: { antes: null, despues: nueva.socioId },
        orden: { antes: null, despues: nueva.orden },
      },
    });

    return NextResponse.json({ ok: true, participacion: nueva });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}

/* ───── PUT  Cambiar orden ───── */
export async function PUT(req: Request) {
  try {
    const { id, orden } = await req.json();
    if (!id || orden === undefined)
      return NextResponse.json({ error: "id y orden son requeridos" }, { status: 400 });

    const antes = await prisma.participacion.findUnique({ where: { id: Number(id) } });
    if (!antes) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    const despues = await prisma.participacion.update({
      where: { id: Number(id) },
      data: { orden: Number(orden) },
    });

    const cambios = diffObjetos(
      { orden: antes.orden },
      { orden: despues.orden },
    );

    await registrarBitacora({
      tabla: "participaciones",
      registroId: despues.id,
      accion: "EDITAR",
      camposCambios: cambios,
    });

    return NextResponse.json({ ok: true, participacion: despues });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}

/* ───── DELETE  Eliminar participación ───── */
export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    const part = await prisma.participacion.findUnique({ where: { id: Number(id) } });
    if (!part) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    // Validar que no existan aportes, ahorros o préstamos para ese socio en esa ronda
    const [aportes, ahorros, prestamos] = await Promise.all([
      prisma.aporte.count({ where: { rondaId: part.rondaId, socioId: part.socioId } }),
      prisma.ahorro.count({ where: { rondaId: part.rondaId, socioId: part.socioId } }),
      prisma.prestamo.count({ where: { rondaId: part.rondaId, socioId: part.socioId } }),
    ]);

    if (aportes > 0 || ahorros > 0 || prestamos > 0) {
      return NextResponse.json({
        error: `No se puede eliminar: el socio tiene ${aportes} aporte(s), ${ahorros} ahorro(s) y ${prestamos} préstamo(s) en esta ronda.`,
      }, { status: 400 });
    }

    await prisma.participacion.delete({ where: { id: Number(id) } });

    await registrarBitacora({
      tabla: "participaciones",
      registroId: part.id,
      accion: "ELIMINAR",
      camposCambios: {
        rondaId: { antes: part.rondaId, despues: null },
        socioId: { antes: part.socioId, despues: null },
        orden: { antes: part.orden, despues: null },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
