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
        cuentasInversion: {
          include: { socio: { select: { id: true, nombres: true, apellidos: true, numeroCuenta: true } } },
          orderBy: { montoInvertido: "desc" },
        },
        _count: { select: { aportes: true, ahorros: true, prestamos: true, prestamosExpress: true } },
      },
    });
    if (!ronda) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    return NextResponse.json({
      ...ronda,
      montoAporte: Number(ronda.montoAporte),
      ahorroObjetivoPorSocio: Number(ronda.ahorroObjetivoPorSocio),
      saldoFondoDisponible: Number(ronda.saldoFondoDisponible),
      cuentasInversion: ronda.cuentasInversion.map(c => ({
        id: c.id,
        socioId: c.socioId,
        socio: c.socio,
        montoInvertido: Number(c.montoInvertido),
        porcentajeParticipacion: Number(c.porcentajeParticipacion),
        interesesAcumulados: Number(c.interesesAcumulados),
        devuelto: c.devuelto,
      })),
    });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function PUT(req: Request, ctx: Ctx) {
  const rondaId = Number((await ctx.params).id);
  try {
    const body = await req.json();
    const { nombre, montoAporte, ahorroObjetivoPorSocio, intervaloDiasCobro, semanaActual, fechaInicio, fechaFin } = body;

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
        ...(semanaActual !== undefined && semanaActual !== "" && { semanaActual: Number(semanaActual) }),
        ...(fechaInicio && { fechaInicio: new Date(fechaInicio) }),
        ...(fechaFin !== undefined && { fechaFin: fechaFin ? new Date(fechaFin) : null }),
      },
    });

    const cambios = diffObjetos(
      { nombre: antes.nombre, montoAporte: Number(antes.montoAporte), ahorroObjetivoPorSocio: Number(antes.ahorroObjetivoPorSocio), semanaActual: antes.semanaActual, fechaFin: antes.fechaFin?.toISOString().slice(0,10) ?? null },
      { nombre: despues.nombre, montoAporte: Number(despues.montoAporte), ahorroObjetivoPorSocio: Number(despues.ahorroObjetivoPorSocio), semanaActual: despues.semanaActual, fechaFin: despues.fechaFin?.toISOString().slice(0,10) ?? null }
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
      select: {
        id: true, nombre: true, activa: true,
        _count: {
          select: {
            aportes: true, ahorros: true, prestamos: true,
            participaciones: true, cuentasInversion: true,
          },
        },
      },
    });
    if (!ronda) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

    // Conteo total para el resumen en bitácora
    const resumen = {
      aportes: ronda._count.aportes,
      ahorros: ronda._count.ahorros,
      prestamos: ronda._count.prestamos,
      participaciones: ronda._count.participaciones,
      inversiones: ronda._count.cuentasInversion,
    };

    // Eliminar en orden para respetar FK — todo dentro de una transacción
    await prisma.$transaction(async (tx) => {

      // 1. Cuotas de préstamos
      const prestamosIds = (await tx.prestamo.findMany({
        where: { rondaId }, select: { id: true },
      })).map(p => p.id);
      if (prestamosIds.length > 0) {
        await tx.prestamoCuota.deleteMany({ where: { prestamoId: { in: prestamosIds } } });
      }

      // 2. Préstamos
      await tx.prestamo.deleteMany({ where: { rondaId } });

      // 3. Desconectar aportes de sus express (limpiar FK antes de eliminar express)
      await tx.aporte.updateMany({
        where: { rondaId, prestamoExpressId: { not: null } },
        data: { prestamoExpressId: null },
      });

      // 4. Préstamos express
      await (tx as any).prestamoExpress.deleteMany({ where: { rondaId } });

      // 5. Aportes
      await tx.aporte.deleteMany({ where: { rondaId } });

      // 6. Ahorros — revertir saldoAhorros de cada socio
      const ahorrosRonda = await tx.ahorro.findMany({
        where: { rondaId },
        select: { socioId: true, monto: true },
      });
      const deltaAhorros = new Map<number, number>();
      ahorrosRonda.forEach(a => {
        deltaAhorros.set(a.socioId, (deltaAhorros.get(a.socioId) ?? 0) + Number(a.monto));
      });
      await tx.ahorro.deleteMany({ where: { rondaId } });
      for (const [socioId, total] of deltaAhorros) {
        await tx.socio.update({
          where: { id: socioId },
          data: { saldoAhorros: { decrement: new Prisma.Decimal(total) } },
        });
      }

      // 7. Movimientos de cuenta — revertir efecto en saldoAhorros
      // AHORRO ya fue revertido en paso 6 vía tabla ahorros — excluirlo aquí para no duplicar
      // DEVOLUCION/INTERES suman al saldo, RETIRO/INVERSION restan → al eliminar hacemos lo inverso
      const movsRonda = await tx.movimientoCuenta.findMany({
        where: { rondaId, tipo: { in: ["RETIRO", "DEVOLUCION", "INTERES", "INVERSION"] } },
        select: { socioId: true, tipo: true, monto: true },
      });
      const deltaMovs = new Map<number, number>();
      movsRonda.forEach(m => {
        const efecto = ["DEVOLUCION", "INTERES"].includes(m.tipo)
          ? -Number(m.monto)  // sumó al saldo → restamos
          : +Number(m.monto); // restó del saldo → sumamos
        deltaMovs.set(m.socioId, (deltaMovs.get(m.socioId) ?? 0) + efecto);
      });
      await tx.movimientoCuenta.deleteMany({ where: { rondaId } });
      for (const [socioId, delta] of deltaMovs) {
        if (Math.abs(delta) > 0.001) {
          await tx.socio.update({
            where: { id: socioId },
            data: { saldoAhorros: { increment: new Prisma.Decimal(delta.toFixed(2)) } },
          });
        }
      }

      // 8. Movimientos de caja (multas, intereses express, gastos)
      await (tx as any).movimientoCaja.deleteMany({ where: { rondaId } });

      // 9. IngresoMulta y GastoMulta (tablas legacy de multas)
      await (tx as any).ingresoMulta.deleteMany({ where: { rondaId } });
      await (tx as any).gastoMulta.deleteMany({ where: { rondaId } });

      // 10. Cuentas de inversión + movimientos del fondo
      await tx.cuentaInversion.deleteMany({ where: { rondaId } });
      await tx.movimientoFondo.deleteMany({ where: { rondaId } });

      // 11. Responsables de semana
      await tx.responsableCobroSemana.deleteMany({ where: { rondaId } });

      // 12. Participaciones
      await tx.participacion.deleteMany({ where: { rondaId } });

      // 13. Snapshots de la ronda
      await tx.snapshotRonda.deleteMany({ where: { rondaId } });

      // 14. Si era la ronda activa, marcar la más reciente como activa
      if (ronda.activa) {
        const anterior = await tx.ronda.findFirst({
          where: { id: { not: rondaId } },
          orderBy: { id: "desc" },
        });
        if (anterior) {
          await tx.ronda.update({
            where: { id: anterior.id },
            data: { activa: true },
          });
        }
      }

      // 15. Eliminar la ronda
      await tx.ronda.delete({ where: { id: rondaId } });
    }, {
      timeout: 30000, // 30s para rondas con muchos datos
    });

    await registrarBitacora({
      tabla: "rondas", registroId: rondaId, accion: "ELIMINAR",
      camposCambios: {
        nombre:  { antes: ronda.nombre, despues: null },
        activa:  { antes: ronda.activa, despues: null },
      },
      efectosCadena: [{
        tabla: "rondas",
        registroId: rondaId,
        descripcion: `Eliminados en cascada: ${resumen.aportes} aportes, ${resumen.ahorros} ahorros, ${resumen.prestamos} préstamos, ${resumen.inversiones} cuentas de inversión, ${resumen.participaciones} participaciones. Saldos de ahorros revertidos (ahorros de ronda + intereses + devoluciones).`,
      }],
    });

    return NextResponse.json({ ok: true, resumen });
  } catch (e: any) {
    console.error("[DELETE ronda]", e);
    return NextResponse.json({
      error: e?.message ?? "Error eliminando ronda",
      detail: e?.code ?? null,
    }, { status: 500 });
  }
}
