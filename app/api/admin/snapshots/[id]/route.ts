// app/api/admin/snapshots/[id]/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { restaurarSnapshot } from "@/lib/snapshots";
import { registrarBitacora } from "@/lib/bitacora";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const id = Number((await ctx.params).id);
  try {
    const snapshot = await (prisma as any).snapshotRonda.findUnique({
      where: { id },
      include: { ronda: { select: { nombre: true } } },
    });
    if (!snapshot) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    const datos = snapshot.datos as any;
    const resumen = {
      participaciones: datos.participaciones?.length ?? 0,
      aportes: datos.aportes?.length ?? 0,
      ahorros: datos.ahorros?.length ?? 0,
      prestamos: datos.prestamos?.length ?? 0,
      prestamosExpress: datos.prestamosExpress?.length ?? 0,
      cuentasInversion: datos.cuentasInversion?.length ?? 0,
      movimientosCuenta: datos.movimientosCuenta?.length ?? 0,
      movimientosFondo: datos.movimientosFondo?.length ?? 0,
      movimientosCaja: datos.movimientosCaja?.length ?? 0,
      ingresosMulta: datos.ingresosMulta?.length ?? 0,
      gastosMulta: datos.gastosMulta?.length ?? 0,
      socios: datos.sociosSaldos?.length ?? 0,
    };

    return NextResponse.json({
      id: snapshot.id,
      rondaId: snapshot.rondaId,
      rondaNombre: snapshot.ronda?.nombre,
      semana: snapshot.semana,
      nombre: snapshot.nombre,
      tipo: snapshot.tipo,
      createdAt: snapshot.createdAt,
      resumen,
      datos,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}

export async function POST(req: Request, ctx: Ctx) {
  const id = Number((await ctx.params).id);
  try {
    const { accion } = await req.json();
    if (accion !== "restaurar") {
      return NextResponse.json({ error: "accion debe ser 'restaurar'" }, { status: 400 });
    }

    const snapshot = await (prisma as any).snapshotRonda.findUnique({
      where: { id },
      select: { id: true, rondaId: true, nombre: true, semana: true, datos: true },
    });
    if (!snapshot) return NextResponse.json({ error: "Snapshot no encontrado" }, { status: 404 });

    const resultado = await prisma.$transaction(async (tx) => {
      return restaurarSnapshot(tx, id);
    }, { timeout: 60000 });

    await registrarBitacora({
      tabla: "snapshots_ronda", registroId: id, accion: "RESTAURAR" as any,
      camposCambios: {
        nombre: { antes: snapshot.nombre, despues: snapshot.nombre },
        semana: { antes: snapshot.semana, despues: snapshot.semana },
      },
      efectosCadena: [{
        tabla: "rondas", registroId: snapshot.rondaId,
        descripcion: `Ronda restaurada al estado del snapshot "${snapshot.nombre}" (semana ${snapshot.semana}). Todos los datos actuales fueron reemplazados.`,
      }],
    });

    return NextResponse.json({ ok: true, ...resultado });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error restaurando" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const id = Number((await ctx.params).id);
  try {
    const snapshot = await (prisma as any).snapshotRonda.findUnique({
      where: { id },
      select: { id: true, nombre: true, semana: true },
    });
    if (!snapshot) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    await (prisma as any).snapshotRonda.delete({ where: { id } });

    await registrarBitacora({
      tabla: "snapshots_ronda", registroId: id, accion: "ELIMINAR",
      camposCambios: { nombre: { antes: snapshot.nombre, despues: null } },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
