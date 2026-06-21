// app/api/admin/rondas/[id]/revertir-semana/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { registrarBitacora } from "@/lib/bitacora";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const rondaId = Number((await ctx.params).id);

  try {
    const ronda = await prisma.ronda.findUnique({
      where: { id: rondaId },
      select: { id: true, nombre: true, activa: true, semanaActual: true, fechaFin: true },
    });

    if (!ronda) {
      return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });
    }

    const semanaRevertir = ronda.semanaActual - 1;

    if (ronda.semanaActual === 1) {
      return NextResponse.json(
        { error: "No hay semana que revertir" },
        { status: 400 }
      );
    }

    const resumen = {
      aportesEliminados: 0,
      ahorrosEliminados: 0,
      expressRevertidos: 0,
      expressCobradosRevertidos: 0,
      multasEliminadas: 0,
      inversionesRevertidas: 0,
      rondaReactivada: false,
    };

    await prisma.$transaction(async (tx) => {
      // ── a. Si la ronda estaba inactiva (cierre final) → reactivar ──────────
      if (!ronda.activa) {
        resumen.rondaReactivada = true;

        // Reactivar la ronda
        await tx.ronda.update({
          where: { id: rondaId },
          data: { activa: true, fechaFin: null },
        });

        // Revertir devolución de inversiones
        const cuentasDevueltas = await tx.cuentaInversion.findMany({
          where: { rondaId, devuelto: true },
          include: { socio: { select: { id: true } } },
        });

        for (const cuenta of cuentasDevueltas) {
          const totalDevuelto = Number(cuenta.montoInvertido) + Number(cuenta.interesesAcumulados);

          // Revertir saldoAhorros del socio (restar lo que se le devolvió)
          await tx.socio.update({
            where: { id: cuenta.socioId },
            data: {
              saldoAhorros: {
                decrement: new Prisma.Decimal(
                  Math.round(totalDevuelto * 100) / 100
                ),
              },
            },
          });

          // Marcar cuenta como no devuelta
          await tx.cuentaInversion.update({
            where: { id: cuenta.id },
            data: {
              devuelto: false,
              interesesAcumulados: new Prisma.Decimal(0),
            },
          });
        }

        resumen.inversionesRevertidas = cuentasDevueltas.length;

        // Eliminar movimientos de cuenta DEVOLUCION e INTERES de esta ronda
        await tx.movimientoCuenta.deleteMany({
          where: {
            rondaId,
            tipo: { in: ["DEVOLUCION", "INTERES"] },
          },
        });

        // Eliminar movimientos de fondo DEVOLUCION_CIERRE
        await tx.movimientoFondo.deleteMany({
          where: { rondaId, tipo: "DEVOLUCION_CIERRE" },
        });

        // Limpiar reporte Excel
        try {
          await (tx as any).ronda.update({
            where: { id: rondaId },
            data: { reporteExcel: null, reporteGeneradoAt: null },
          });
        } catch {
          // Si los campos no existen en el schema generado, ignorar
        }
      }

      // ── b. Eliminar aportes de semanaRevertir ──────────────────────────────
      // Primero limpiar FK hacia prestamoExpress
      await tx.aporte.updateMany({
        where: {
          rondaId,
          semana: semanaRevertir,
          prestamoExpressId: { not: null },
        },
        data: { prestamoExpressId: null },
      });

      const aportesResult = await tx.aporte.deleteMany({
        where: { rondaId, semana: semanaRevertir },
      });
      resumen.aportesEliminados = aportesResult.count;

      // ── c. Eliminar ahorros de semanaRevertir ──────────────────────────────
      const ahorrosSemana = await tx.ahorro.findMany({
        where: { rondaId, semana: semanaRevertir },
        select: { socioId: true, monto: true },
      });

      // Sumar montos por socio
      const deltaPorSocio = new Map<number, number>();
      ahorrosSemana.forEach((a) => {
        deltaPorSocio.set(
          a.socioId,
          (deltaPorSocio.get(a.socioId) ?? 0) + Number(a.monto)
        );
      });

      // Decrementar saldoAhorros de cada socio
      for (const [socioId, total] of deltaPorSocio) {
        await tx.socio.update({
          where: { id: socioId },
          data: {
            saldoAhorros: {
              decrement: new Prisma.Decimal(
                Math.round(total * 100) / 100
              ),
            },
          },
        });
      }

      const ahorrosResult = await tx.ahorro.deleteMany({
        where: { rondaId, semana: semanaRevertir },
      });
      resumen.ahorrosEliminados = ahorrosResult.count;

      // ── d. Eliminar MovimientoCuenta tipo AHORRO de semanaRevertir ─────────
      await tx.movimientoCuenta.deleteMany({
        where: {
          rondaId,
          tipo: "AHORRO",
          nota: { contains: `semana ${semanaRevertir}` },
        },
      });

      // ── e. Eliminar ResponsableCobroSemana de semanaRevertir ───────────────
      await tx.responsableCobroSemana.deleteMany({
        where: { rondaId, semana: semanaRevertir },
      });

      // ── f. Revertir intereses express ──────────────────────────────────────
      // Express PENDIENTES que tenían semanaVencimiento <= semanaRevertir: restar interés
      const expressPendientes = await (tx as any).prestamoExpress.findMany({
        where: {
          rondaId,
          estado: "PENDIENTE",
          semanaVencimiento: { lte: semanaRevertir },
        },
      });

      for (const exp of expressPendientes) {
        const nuevoInteres = Math.max(
          0,
          Math.round(
            (Number(exp.interesAcumulado) - Number(exp.interesPorSemana)) * 100
          ) / 100
        );
        const nuevoTotal =
          Math.round((Number(exp.principal) + nuevoInteres) * 100) / 100;

        await (tx as any).prestamoExpress.update({
          where: { id: exp.id },
          data: {
            interesAcumulado: new Prisma.Decimal(nuevoInteres),
            total: new Prisma.Decimal(nuevoTotal),
          },
        });
        resumen.expressRevertidos++;
      }

      // Express cobrados en semanaRevertir: revertir a PENDIENTE
      const expressCobrados = await (tx as any).prestamoExpress.findMany({
        where: {
          rondaId,
          estado: "COBRADO",
          semanaCobro: semanaRevertir,
        },
      });

      for (const exp of expressCobrados) {
        await (tx as any).prestamoExpress.update({
          where: { id: exp.id },
          data: {
            estado: "PENDIENTE",
            semanaCobro: null,
          },
        });

        // Eliminar MovimientoCaja INTERES_EXPRESS asociado
        await (tx as any).movimientoCaja.deleteMany({
          where: {
            rondaId,
            tipo: "INTERES_EXPRESS",
            prestamoExpressId: exp.id,
          },
        });

        resumen.expressCobradosRevertidos++;
      }

      // ── g. Eliminar multas de semanaRevertir ───────────────────────────────
      const multasResult = await (tx as any).ingresoMulta.deleteMany({
        where: { rondaId, semana: semanaRevertir },
      });
      resumen.multasEliminadas = multasResult.count;

      await (tx as any).movimientoCaja.deleteMany({
        where: { rondaId, tipo: "MULTA", semana: semanaRevertir },
      });

      // ── h. Decrementar semanaActual ────────────────────────────────────────
      await tx.ronda.update({
        where: { id: rondaId },
        data: { semanaActual: semanaRevertir },
      });
    }, {
      timeout: 30000,
    });

    // Registrar en bitácora
    await registrarBitacora({
      tabla: "rondas",
      registroId: rondaId,
      accion: "EDITAR",
      camposCambios: {
        semanaActual: { antes: ronda.semanaActual, despues: semanaRevertir },
        ...(resumen.rondaReactivada
          ? {
              activa: { antes: false, despues: true },
              fechaFin: { antes: ronda.fechaFin?.toISOString().slice(0, 10) ?? null, despues: null },
            }
          : {}),
      },
      efectosCadena: [
        {
          tabla: "rondas",
          registroId: rondaId,
          descripcion: [
            `Semana ${semanaRevertir} revertida completamente.`,
            `Aportes eliminados: ${resumen.aportesEliminados}.`,
            `Ahorros eliminados: ${resumen.ahorrosEliminados} (saldos de socios decrementados).`,
            `Express con interés revertido: ${resumen.expressRevertidos}.`,
            `Express cobrados revertidos a PENDIENTE: ${resumen.expressCobradosRevertidos}.`,
            `Multas eliminadas: ${resumen.multasEliminadas}.`,
            resumen.rondaReactivada
              ? `Ronda reactivada (cierre final revertido). Inversiones revertidas: ${resumen.inversionesRevertidas}.`
              : null,
          ]
            .filter(Boolean)
            .join(" "),
        },
      ],
    });

    return NextResponse.json({
      ok: true,
      semanaRevertida: semanaRevertir,
      resumen,
    });
  } catch (e: any) {
    console.error("[REVERTIR SEMANA]", e);
    return NextResponse.json(
      { error: e?.message ?? "Error revirtiendo semana", detail: e?.code ?? null },
      { status: 500 }
    );
  }
}
