// app/api/admin/responsables/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { registrarBitacora, diffObjetos, CambiosCadena } from "@/lib/bitacora";

export const runtime = "nodejs";

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const dec = (n: number) => new Prisma.Decimal(r2(n));

/* ───── GET  ?rondaId=X ───── */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const rondaId = Number(searchParams.get("rondaId"));
    if (!rondaId) return NextResponse.json({ error: "rondaId requerido" }, { status: 400 });

    const responsables = await prisma.responsableCobroSemana.findMany({
      where: { rondaId },
      include: {
        socio: { select: { id: true, nombres: true, apellidos: true, numeroCuenta: true } },
      },
      orderBy: { semana: "asc" },
    });

    return NextResponse.json({ responsables });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}

/* ───── PUT  Cambiar responsable de una semana ───── */
export async function PUT(req: Request) {
  try {
    const { id, socioId } = await req.json();
    if (!id || !socioId)
      return NextResponse.json({ error: "id y socioId son requeridos" }, { status: 400 });

    const antes = await prisma.responsableCobroSemana.findUnique({ where: { id: Number(id) } });
    if (!antes) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    // Validar que el socio es participante de la ronda
    const esParticipante = await prisma.participacion.findUnique({
      where: { rondaId_socioId: { rondaId: antes.rondaId, socioId: Number(socioId) } },
    });
    if (!esParticipante) {
      return NextResponse.json({
        error: "El socio no es participante de esta ronda",
      }, { status: 400 });
    }

    const despues = await prisma.responsableCobroSemana.update({
      where: { id: Number(id) },
      data: { socioId: Number(socioId) },
    });

    const cambios = diffObjetos(
      { socioId: antes.socioId },
      { socioId: despues.socioId },
    );

    await registrarBitacora({
      tabla: "responsables_semana",
      registroId: despues.id,
      accion: "EDITAR",
      camposCambios: cambios,
    });

    return NextResponse.json({ ok: true, responsable: despues });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}

/* ───── DELETE  Eliminar asignación ───── */
export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    const resp = await prisma.responsableCobroSemana.findUnique({ where: { id: Number(id) } });
    if (!resp) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    await prisma.responsableCobroSemana.delete({ where: { id: Number(id) } });

    await registrarBitacora({
      tabla: "responsables_semana",
      registroId: resp.id,
      accion: "ELIMINAR",
      camposCambios: {
        rondaId: { antes: resp.rondaId, despues: null },
        semana: { antes: resp.semana, despues: null },
        socioId: { antes: resp.socioId, despues: null },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
