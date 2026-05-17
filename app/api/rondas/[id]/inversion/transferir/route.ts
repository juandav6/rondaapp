// app/api/rondas/[id]/inversion/transferir/route.ts
// Transfiere ahorros de socios al fondo de inversión y recalcula % de participación
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

function round2(n: number) { return Math.round((n + Number.EPSILON) * 100) / 100; }
function toDecimal(n: number) { return new Prisma.Decimal(round2(n)); }

// GET → Preview: ahorros actuales por socio + estado fondo actual
export async function GET(_req: Request, ctx: Context) {
  const rondaId = Number((await ctx.params).id);
  if (!Number.isFinite(rondaId))
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    const [ronda, participaciones, cuentasInversion, ahorros, transferenciasYaHechas] = await Promise.all([
      prisma.ronda.findUnique({ where: { id: rondaId }, select: { id: true, nombre: true, activa: true, semanaActual: true } }),
      prisma.participacion.findMany({
        where: { rondaId },
        include: { socio: { select: { id: true, nombres: true, apellidos: true, numeroCuenta: true, saldoAhorros: true } } },
        orderBy: { orden: "asc" },
      }),
      prisma.cuentaInversion.findMany({
        where: { rondaId },
        select: { socioId: true, montoInvertido: true, porcentajeParticipacion: true, interesesAcumulados: true },
      }),
      prisma.ahorro.groupBy({
        by: ["socioId"],
        where: { rondaId },
        _sum: { monto: true },
      }),
      // Transferencias ya realizadas en esta ronda
      prisma.movimientoCuenta.groupBy({
        by: ["socioId"],
        where: { rondaId, tipo: "INVERSION" },
        _sum: { monto: true },
      }),
    ]);

    if (!ronda) return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });

    const inversionMap = new Map(cuentasInversion.map(c => [c.socioId, c]));
    const ahorroMap = new Map(ahorros.map(a => [a.socioId, Number(a._sum.monto ?? 0)]));
    const transferidoMap = new Map(transferenciasYaHechas.map(t => [t.socioId, Number(t._sum.monto ?? 0)]));
    const fondoActual = cuentasInversion.reduce((s, c) => s + Number(c.montoInvertido), 0);

    const socios = participaciones.map(p => {
      const inv = inversionMap.get(p.socioId);
      const ahorroRonda = ahorroMap.get(p.socioId) ?? 0;
      const yaTransferido = transferidoMap.get(p.socioId) ?? 0;
      const montoInvertido = inv ? Number(inv.montoInvertido) : 0;
      const intereses = inv ? Number(inv.interesesAcumulados) : 0;
      // Solo puede transferir lo que ahorró MENOS lo que ya transfirió al fondo
      const disponibleTransferir = Math.max(0, Math.round((ahorroRonda - yaTransferido) * 100) / 100);

      return {
        socioId: p.socioId,
        socio: p.socio,
        ahorroRonda,
        yaTransferido,
        saldoAhorrosLibres: Number(p.socio.saldoAhorros),
        montoInvertidoActual: montoInvertido,
        interesesAcumulados: intereses,
        porcentajeActual: inv ? Number(inv.porcentajeParticipacion) : 0,
        tieneInversion: !!inv,
        disponibleTransferir,
      };
    });

    const totalAhorrosRonda = ahorros.reduce((s, a) => s + Number(a._sum.monto ?? 0), 0);
    const totalYaTransferido = Array.from(transferidoMap.values()).reduce((s, v) => s + v, 0);
    const totalDisponible = Math.max(0, Math.round((totalAhorrosRonda - totalYaTransferido) * 100) / 100);

    return NextResponse.json({
      ronda,
      fondoActual,
      socios,
      totalAhorrosRonda,
      totalYaTransferido,
      totalDisponible,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}

// POST → Ejecutar transferencia: { transferencias: [{ socioId, monto }] }
export async function POST(req: Request, ctx: Context) {
  const rondaId = Number((await ctx.params).id);
  if (!Number.isFinite(rondaId))
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    const body = await req.json();
    const transferencias: { socioId: number; monto: number }[] = body?.transferencias ?? [];

    if (!transferencias.length)
      return NextResponse.json({ error: "No se recibieron transferencias" }, { status: 400 });

    // Filtrar montos válidos
    const validas = transferencias.filter(t => Number(t.monto) > 0);
    if (!validas.length)
      return NextResponse.json({ error: "Todos los montos son 0" }, { status: 400 });

    const ronda = await prisma.ronda.findUnique({ where: { id: rondaId } });
    if (!ronda) return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });
    if (!ronda.activa) return NextResponse.json({ error: "La ronda no está activa" }, { status: 400 });

    // Verificar que los socios tengan ahorros suficientes en la ronda
    const ahorrosPorSocio = await prisma.ahorro.groupBy({
      by: ["socioId"],
      where: { rondaId, socioId: { in: validas.map(t => t.socioId) } },
      _sum: { monto: true },
    });
    const ahorroMap = new Map(ahorrosPorSocio.map(a => [a.socioId, Number(a._sum.monto ?? 0)]));

    for (const t of validas) {
      const ahorroDisponible = ahorroMap.get(t.socioId) ?? 0;
      if (t.monto > ahorroDisponible + 0.01) {
        return NextResponse.json({
          error: `Socio ${t.socioId} solo tiene $${ahorroDisponible.toFixed(2)} en ahorros de la ronda, pero se intenta transferir $${t.monto.toFixed(2)}.`
        }, { status: 400 });
      }
    }

    // Cargar estado actual del fondo
    const cuentasActuales = await prisma.cuentaInversion.findMany({ where: { rondaId } });
    const inversionMapActual = new Map(cuentasActuales.map(c => [c.socioId, c]));

    // Calcular nuevo fondo total después de transferencias
    let nuevoFondoTotal = cuentasActuales.reduce((s, c) => s + Number(c.montoInvertido), 0);
    const resumenTransferencias: any[] = [];

    for (const t of validas) {
      const monto = round2(t.monto);
      nuevoFondoTotal += monto;
      const cuentaActual = inversionMapActual.get(t.socioId);
      resumenTransferencias.push({
        socioId: t.socioId,
        monto,
        montoAnterior: cuentaActual ? Number(cuentaActual.montoInvertido) : 0,
        montoNuevo: cuentaActual ? round2(Number(cuentaActual.montoInvertido) + monto) : monto,
        pctAnterior: cuentaActual ? Number(cuentaActual.porcentajeParticipacion) : 0,
        esNuevoInversor: !cuentaActual,
      });
    }

    // Calcular nuevos porcentajes para TODOS (incluyendo los que no transfieren)
    const todosConMonto: { socioId: number; montoNuevo: number }[] = [];

    // Primero los que ya tenían inversión
    for (const cuenta of cuentasActuales) {
      const transferencia = validas.find(t => t.socioId === cuenta.socioId);
      const montoAdicional = transferencia ? round2(transferencia.monto) : 0;
      todosConMonto.push({
        socioId: cuenta.socioId,
        montoNuevo: round2(Number(cuenta.montoInvertido) + montoAdicional),
      });
    }

    // Nuevos inversores (no tenían cuenta)
    for (const t of validas) {
      if (!inversionMapActual.has(t.socioId)) {
        todosConMonto.push({ socioId: t.socioId, montoNuevo: round2(t.monto) });
      }
    }

    // Calcular % basado en nuevo total
    const porcentajesNuevos = todosConMonto.map((item, i) => ({
      ...item,
      pctNuevo: nuevoFondoTotal > 0
        ? round2((item.montoNuevo / nuevoFondoTotal) * 100)
        : 0,
    }));

    // Ajuste de centésimas: el total de % debe ser exactamente 100
    const sumaPct = porcentajesNuevos.reduce((s, p) => s + p.pctNuevo, 0);
    const diff = round2(100 - sumaPct);
    if (porcentajesNuevos.length > 0 && Math.abs(diff) > 0) {
      porcentajesNuevos[porcentajesNuevos.length - 1].pctNuevo = round2(porcentajesNuevos[porcentajesNuevos.length - 1].pctNuevo + diff);
    }

    // Agregar pct a resumen
    for (const r of resumenTransferencias) {
      const pctItem = porcentajesNuevos.find(p => p.socioId === r.socioId);
      r.pctNuevo = pctItem?.pctNuevo ?? 0;
    }

    // Ejecutar en transacción
    await prisma.$transaction(async (tx) => {
      for (const t of validas) {
        const monto = round2(t.monto);
        const cuentaActual = inversionMapActual.get(t.socioId);

        if (cuentaActual) {
          // Actualizar cuenta existente
          await tx.cuentaInversion.update({
            where: { id: cuentaActual.id },
            data: { montoInvertido: { increment: toDecimal(monto) } },
          });
        } else {
          // Crear nueva cuenta de inversión
          await tx.cuentaInversion.create({
            data: {
              rondaId,
              socioId: t.socioId,
              montoInvertido: toDecimal(monto),
              porcentajeParticipacion: toDecimal(0), // se actualiza abajo
              interesesAcumulados: toDecimal(0),
              devuelto: false,
            },
          });
        }

        // Descontar de saldoAhorros del socio
        await tx.socio.update({
          where: { id: t.socioId },
          data: { saldoAhorros: { decrement: toDecimal(monto) } },
        });

        // Registrar movimiento
        await tx.movimientoCuenta.create({
          data: {
            socioId: t.socioId,
            rondaId,
            tipo: "INVERSION",
            monto: toDecimal(monto),
            nota: `Transferencia de ahorros al fondo de inversión · Ronda ${ronda.nombre}`,
          },
        });
      }

      // Actualizar TODOS los porcentajes de participación
      for (const p of porcentajesNuevos) {
        await tx.cuentaInversion.updateMany({
          where: { rondaId, socioId: p.socioId },
          data: { porcentajeParticipacion: toDecimal(p.pctNuevo) },
        });
      }
    });

    return NextResponse.json({
      ok: true,
      fondoAnterior: round2(nuevoFondoTotal - validas.reduce((s, t) => s + t.monto, 0)),
      fondoNuevo: nuevoFondoTotal,
      montoTransferido: round2(validas.reduce((s, t) => s + t.monto, 0)),
      transferencias: resumenTransferencias,
      porcentajesActualizados: porcentajesNuevos,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error al transferir" }, { status: 500 });
  }
}
