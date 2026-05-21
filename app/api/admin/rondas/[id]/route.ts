// app/api/admin/rondas/[id]/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { registrarBitacora, diffObjetos, CambiosCadena } from "@/lib/bitacora";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export async function GET(_req: Request, ctx: Ctx) {
  const id = Number((await ctx.params).id);
  try {
    const ronda = await prisma.ronda.findUnique({
      where: { id },
      include: {
        participaciones: {
          include: { socio: { select: { id: true, nombres: true, apellidos: true, numeroCuenta: true } } },
          orderBy: { orden: "asc" },
        },
        responsablesSemana: { include: { socio: { select: { nombres: true, apellidos: true } } } },
        _count: { select: { aportes: true, ahorros: true, prestamos: true, prestamosExpress: true } },
      },
    });
    if (!ronda) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    return NextResponse.json({
      ...ronda,
      montoAporte: Number(ronda.montoAporte),
      ahorroObjetivoPorSocio: Number(ronda.ahorroObjetivoPorSocio),
      saldoFondoDisponible: Number(ronda.saldoFondoDisponible),
    });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function PUT(req: Request, ctx: Ctx) {
  const rondaId = Number((await ctx.params).id);
  try {
    const body = await req.json();
    const { nombre, montoAporte, ahorroObjetivoPorSocio, intervaloDiasCobro, semanaActual } = body;

    const antes = await prisma.ronda.findUnique({ where: { id: rondaId } });
    if (!antes) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

    const efectos: CambiosCadena[] = [];

    // Si cambia montoAporte → recalcular aportes express vinculados
    if (montoAporte !== undefined && Number(montoAporte) !== Number(antes.montoAporte)) {
      const expressPendientes = await (prisma as any).prestamoExpress.findMany({
        where: { rondaId, estado: "PENDIENTE" },
      });
      for (const exp of expressPendientes) {
        const nuevoPrincipal = Number(montoAporte);
        const nuevoTotal = r2(nuevoPrincipal + Number(exp.interesAcumulado ?? 1));
        await (prisma as any).prestamoExpress.update({
          where: { id: exp.id },
          data: { principal: new Prisma.Decimal(nuevoPrincipal), total: new Prisma.Decimal(nuevoTotal) },
        });
        efectos.push({
          tabla: "prestamos_express",
          registroId: exp.id,
          descripcion: `Principal recalculado por cambio de montoAporte en ronda`,
          camposAfectados: {
            principal: { antes: Number(exp.principal), despues: nuevoPrincipal },
            total: { antes: Number(exp.total), despues: nuevoTotal },
          },
        });
      }
    }

    const despues = await prisma.ronda.update({
      where: { id: rondaId },
      data: {
        ...(nombre && { nombre: String(nombre).trim() }),
        ...(montoAporte !== undefined && { montoAporte: new Prisma.Decimal(Number(montoAporte)) }),
        ...(ahorroObjetivoPorSocio !== undefined && { ahorroObjetivoPorSocio: new Prisma.Decimal(Number(ahorroObjetivoPorSocio)) }),
        ...(intervaloDiasCobro !== undefined && { intervaloDiasCobro: Number(intervaloDiasCobro) }),
        ...(semanaActual !== undefined && { semanaActual: Number(semanaActual) }),
      },
    });

    const cambios = diffObjetos(
      { nombre: antes.nombre, montoAporte: Number(antes.montoAporte), ahorroObjetivoPorSocio: Number(antes.ahorroObjetivoPorSocio), semanaActual: antes.semanaActual },
      { nombre: despues.nombre, montoAporte: Number(despues.montoAporte), ahorroObjetivoPorSocio: Number(despues.ahorroObjetivoPorSocio), semanaActual: despues.semanaActual }
    );

    await registrarBitacora({ tabla: "rondas", registroId: rondaId, accion: "EDITAR", camposCambios: cambios, efectosCadena: efectos.length ? efectos : undefined });

    return NextResponse.json({ ok: true, ronda: despues, efectos });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const rondaId = Number((await ctx.params).id);
  try {
    const ronda = await prisma.ronda.findUnique({
      where: { id: rondaId },
      select: { id: true, nombre: true, activa: true, fechaInicio: true },
    });
    if (!ronda) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

    // Verificar que no haya rondas posteriores
    const rondasPosteriores = await prisma.ronda.count({
      where: { id: { gt: rondaId } },
    });
    if (rondasPosteriores > 0)
      return NextResponse.json({
        error: `No se puede eliminar: existen ${rondasPosteriores} ronda(s) posterior(es). Elimine primero las más recientes.`,
      }, { status: 400 });

    if (ronda.activa)
      return NextResponse.json({ error: "No se puede eliminar una ronda activa. Ciérrela primero." }, { status: 400 });

    // Ejecutar el DELETE del ronda-id-route existente reutilizando su lógica
    const res = await fetch(`${process.env.NEXTAUTH_URL ?? ""}/api/rondas/${rondaId}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return NextResponse.json({ error: d.error ?? "Error eliminando ronda" }, { status: 400 });
    }

    await registrarBitacora({
      tabla: "rondas", registroId: rondaId, accion: "ELIMINAR",
      camposCambios: { nombre: { antes: ronda.nombre, despues: null } },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
