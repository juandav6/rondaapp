// app/api/admin/movimientos-cuenta/route.ts
// GET: listar depósitos y retiros de un socio o todos
// PUT: editar monto/nota de un movimiento (recalcula saldoAhorros)
// DELETE: eliminar movimiento (recalcula saldoAhorros)

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { registrarBitacora } from "@/lib/bitacora";

export const runtime = "nodejs";
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const dec = (n: number) => new Prisma.Decimal(r2(n));

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const socioId = searchParams.get("socioId");
  const tipo    = searchParams.get("tipo");    // AHORRO | RETIRO | todos
  const page    = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit   = Math.min(100, Number(searchParams.get("limit") ?? 50));

  try {
    const where: any = {};
    if (socioId) where.socioId = Number(socioId);
    if (tipo && tipo !== "TODOS") {
      where.tipo = tipo;
    } else if (!tipo) {
      // Sin parámetro tipo → solo depósitos y retiros por defecto
      where.tipo = { in: ["AHORRO", "RETIRO"] };
    }
    // tipo=TODOS → sin filtro de tipo (muestra todos)

    const [total, movimientos] = await Promise.all([
      prisma.movimientoCuenta.count({ where }),
      prisma.movimientoCuenta.findMany({
        where,
        include: {
          socio: { select: { id: true, nombres: true, apellidos: true, numeroCuenta: true, saldoAhorros: true } },
          ronda: { select: { id: true, nombre: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      total,
      page,
      pages: Math.ceil(total / limit),
      movimientos: movimientos.map(m => ({
        id: m.id,
        socioId: m.socioId,
        tipo: m.tipo,
        monto: Number(m.monto),
        nota: m.nota,
        createdAt: m.createdAt,
        socio: { ...m.socio, saldoAhorros: Number(m.socio.saldoAhorros) },
        ronda: m.ronda,
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { id, monto, nota, fecha } = await req.json();
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    const antes = await prisma.movimientoCuenta.findUnique({
      where: { id: Number(id) },
      include: { socio: { select: { nombres: true, apellidos: true, saldoAhorros: true } } },
    });
    if (!antes) return NextResponse.json({ error: "Movimiento no encontrado" }, { status: 404 });

    // Si solo se cambia la fecha (sin monto), permitir cualquier tipo
    const soloFecha = fecha !== undefined && monto === undefined && nota === undefined;
    if (!soloFecha && !["AHORRO", "RETIRO"].includes(antes.tipo))
      return NextResponse.json({ error: "Solo se pueden editar montos de depósitos y retiros" }, { status: 400 });

    const montoAntes  = Number(antes.monto);
    const montoNuevo  = monto !== undefined ? r2(Number(monto)) : montoAntes;
    const diff        = r2(montoNuevo - montoAntes);
    const efectos: any[] = [];

    await prisma.$transaction(async (tx) => {
      await tx.movimientoCuenta.update({
        where: { id: Number(id) },
        data: {
          ...(monto !== undefined && { monto: dec(montoNuevo) }),
          ...(nota  !== undefined && { nota: String(nota).trim() || null }),
          ...(fecha !== undefined && { createdAt: new Date(fecha + "T12:00:00Z") }),
        },
      });

      if (diff !== 0 && ["AHORRO", "RETIRO"].includes(antes.tipo)) {
        const ajuste = antes.tipo === "AHORRO" ? diff : -diff;
        await tx.socio.update({
          where: { id: antes.socioId },
          data: { saldoAhorros: { increment: dec(ajuste) } },
        });
        const socioAct = await tx.socio.findUnique({ where: { id: antes.socioId }, select: { saldoAhorros: true } });
        efectos.push({
          tabla: "socios", registroId: antes.socioId,
          descripcion: `saldoAhorros recalculado por edición`,
          camposAfectados: { saldoAhorros: { antes: r2(Number(antes.socio.saldoAhorros)), despues: Number(socioAct?.saldoAhorros ?? 0) } },
        });
      }
    });

    await registrarBitacora({
      tabla: "movimientos_cuenta", registroId: Number(id), accion: "EDITAR",
      camposCambios: {
        ...(monto !== undefined && { monto: { antes: montoAntes, despues: montoNuevo } }),
        ...(nota  !== undefined && { nota:  { antes: antes.nota, despues: nota } }),
        ...(fecha !== undefined && { fecha: { antes: antes.createdAt.toISOString().slice(0,10), despues: fecha } }),
      },
      efectosCadena: efectos.length ? efectos : undefined,
    });

    return NextResponse.json({ ok: true, efectos });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    const mov = await prisma.movimientoCuenta.findUnique({
      where: { id: Number(id) },
      include: { socio: { select: { nombres: true, apellidos: true, saldoAhorros: true } }, ronda: { select: { nombre: true } } },
    });
    if (!mov) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    const monto = Number(mov.monto);
    const afectaSaldo = ["AHORRO", "RETIRO"].includes(mov.tipo);

    await prisma.$transaction(async (tx) => {
      await tx.movimientoCuenta.delete({ where: { id: Number(id) } });
      if (afectaSaldo) {
        // Revertir: si era AHORRO lo restamos, si era RETIRO lo sumamos
        const ajuste = mov.tipo === "AHORRO" ? -monto : monto;
        await tx.socio.update({
          where: { id: mov.socioId },
          data: { saldoAhorros: { increment: dec(ajuste) } },
        });
      }
    });

    const socioAct = afectaSaldo
      ? await prisma.socio.findUnique({ where: { id: mov.socioId }, select: { saldoAhorros: true } })
      : null;

    await registrarBitacora({
      tabla: "movimientos_cuenta", registroId: Number(id), accion: "ELIMINAR",
      camposCambios: {
        tipo:       { antes: mov.tipo,   despues: null },
        monto:      { antes: monto,      despues: null },
        nota:       { antes: mov.nota,   despues: null },
        socio:      { antes: `${mov.socio.nombres} ${mov.socio.apellidos}`, despues: null },
        ronda:      { antes: mov.ronda?.nombre ?? null, despues: null },
      },
      efectosCadena: afectaSaldo ? [{
        tabla: "socios", registroId: mov.socioId,
        descripcion: `saldoAhorros ajustado por eliminación de ${mov.tipo === "AHORRO" ? "depósito" : "retiro"} de $${monto.toFixed(2)}`,
        camposAfectados: {
          saldoAhorros: {
            antes: Number(mov.socio.saldoAhorros),
            despues: Number(socioAct?.saldoAhorros ?? 0),
          },
        },
      }] : undefined,
    });

    return NextResponse.json({
      ok: true,
      nuevoSaldo: Number(socioAct?.saldoAhorros ?? mov.socio.saldoAhorros),
      afectaSaldo,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
