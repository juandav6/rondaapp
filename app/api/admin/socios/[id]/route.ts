// app/api/admin/socios/[id]/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { registrarBitacora, diffObjetos, CambiosCadena } from "@/lib/bitacora";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const id = Number((await ctx.params).id);
  try {
    const socio = await prisma.socio.findUnique({
      where: { id },
      include: {
        aportes: { include: { ronda: { select: { nombre: true } } }, orderBy: { semana: "asc" } },
        ahorros: { include: { ronda: { select: { nombre: true } } }, orderBy: { semana: "asc" } },
        prestamos: { include: { cuotas: true, ronda: { select: { nombre: true } } } },
        prestamosExpress: { include: { ronda: { select: { nombre: true } } } },
        participaciones: { include: { ronda: { select: { nombre: true, activa: true } } } },
        movimientos: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });
    if (!socio) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    return NextResponse.json({
      ...socio,
      saldoAhorros: Number(socio.saldoAhorros),
      aportes: socio.aportes.map(a => ({ ...a, monto: Number(a.monto), multa: Number(a.multa) })),
      ahorros: socio.ahorros.map(a => ({ ...a, monto: Number(a.monto) })),
      prestamos: socio.prestamos.map(p => ({
        ...p, monto: Number(p.monto), saldoActual: Number(p.saldoActual),
        cuotas: p.cuotas.map(c => ({ ...c, cuota: Number(c.cuota), capital: Number(c.capital), interes: Number(c.interes), saldo: Number(c.saldo) })),
      })),
      movimientos: socio.movimientos.map(m => ({ ...m, monto: Number(m.monto) })),
    });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function PUT(req: Request, ctx: Ctx) {
  const id = Number((await ctx.params).id);
  try {
    const body = await req.json();
    const { nombres, apellidos, cedula, edad, numeroCuenta } = body;

    const antes = await prisma.socio.findUnique({ where: { id } });
    if (!antes) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    const despues = await prisma.socio.update({
      where: { id },
      data: {
        ...(nombres && { nombres: String(nombres).trim().toUpperCase() }),
        ...(apellidos && { apellidos: String(apellidos).trim().toUpperCase() }),
        ...(cedula && { cedula: String(cedula).trim() }),
        ...(edad && { edad: Number(edad) }),
        ...(numeroCuenta && { numeroCuenta: String(numeroCuenta).trim().toUpperCase() }),
      },
    });

    const cambios = diffObjetos(
      { nombres: antes.nombres, apellidos: antes.apellidos, cedula: antes.cedula, edad: antes.edad, numeroCuenta: antes.numeroCuenta },
      { nombres: despues.nombres, apellidos: despues.apellidos, cedula: despues.cedula, edad: despues.edad, numeroCuenta: despues.numeroCuenta }
    );

    await registrarBitacora({ tabla: "socios", registroId: id, accion: "EDITAR", camposCambios: cambios });

    return NextResponse.json({ ok: true, socio: despues });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const id = Number((await ctx.params).id);
  try {
    // Verificar dependencias
    const socio = await prisma.socio.findUnique({
      where: { id },
      include: {
        _count: { select: { participaciones: true, prestamos: true } },
      },
    });
    if (!socio) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    if (socio._count.participaciones > 0) return NextResponse.json({ error: `No se puede eliminar: tiene ${socio._count.participaciones} participaciones en rondas activas` }, { status: 400 });
    if (socio._count.prestamos > 0) return NextResponse.json({ error: `No se puede eliminar: tiene ${socio._count.prestamos} préstamos registrados` }, { status: 400 });

    await prisma.socio.delete({ where: { id } });
    await registrarBitacora({
      tabla: "socios", registroId: id, accion: "ELIMINAR",
      camposCambios: { nombre: { antes: `${socio.nombres} ${socio.apellidos}`, despues: null } },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
