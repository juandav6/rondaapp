// lib/snapshots.ts
import { Prisma } from "@prisma/client";

type TipoSnapshot = "MANUAL" | "AUTO_CIERRE" | "AUTO_SEMANA";

export async function crearSnapshot(
  tx: Prisma.TransactionClient,
  rondaId: number,
  nombre: string,
  tipo: TipoSnapshot = "MANUAL"
) {
  const ronda = await tx.ronda.findUnique({
    where: { id: rondaId },
    select: {
      id: true, nombre: true, montoAporte: true, activa: true,
      fechaInicio: true, fechaFin: true, semanaActual: true,
      intervaloDiasCobro: true, ahorroObjetivoPorSocio: true,
      responsableId: true, saldoFondoDisponible: true, fondoTotalHistorico: true,
    },
  });
  if (!ronda) throw new Error("Ronda no encontrada");

  const [
    participaciones, aportes, ahorros, responsables,
    prestamos, prestamosExpress, cuentasInversion,
    movimientosCuenta, movimientosFondo, movimientosCaja,
    ingresosMulta, gastosMulta,
  ] = await Promise.all([
    tx.participacion.findMany({ where: { rondaId } }),
    tx.aporte.findMany({ where: { rondaId } }),
    tx.ahorro.findMany({ where: { rondaId } }),
    tx.responsableCobroSemana.findMany({ where: { rondaId } }),
    tx.prestamo.findMany({
      where: { rondaId },
      include: { cuotas: true },
    }),
    (tx as any).prestamoExpress.findMany({ where: { rondaId } }),
    tx.cuentaInversion.findMany({ where: { rondaId } }),
    tx.movimientoCuenta.findMany({ where: { rondaId } }),
    tx.movimientoFondo.findMany({ where: { rondaId } }),
    (tx as any).movimientoCaja.findMany({ where: { rondaId } }),
    (tx as any).ingresoMulta.findMany({ where: { rondaId } }),
    (tx as any).gastoMulta.findMany({ where: { rondaId } }),
  ]);

  // Capturar saldos de socios participantes
  const socioIds = [...new Set(participaciones.map((p: any) => p.socioId))];
  const socios = await tx.socio.findMany({
    where: { id: { in: socioIds } },
    select: { id: true, saldoAhorros: true, multas: true },
  });

  const datos = {
    ronda: {
      ...ronda,
      montoAporte: Number(ronda.montoAporte),
      ahorroObjetivoPorSocio: Number(ronda.ahorroObjetivoPorSocio),
      saldoFondoDisponible: Number(ronda.saldoFondoDisponible),
      fondoTotalHistorico: Number(ronda.fondoTotalHistorico),
    },
    participaciones,
    aportes: aportes.map(a => ({ ...a, monto: Number(a.monto), multa: Number(a.multa) })),
    ahorros: ahorros.map(a => ({ ...a, monto: Number(a.monto) })),
    responsables,
    prestamos: prestamos.map((p: any) => ({
      ...p,
      monto: Number(p.monto), tasaAnual: Number(p.tasaAnual), saldoActual: Number(p.saldoActual),
      cuotas: p.cuotas.map((c: any) => ({
        ...c,
        cuota: Number(c.cuota), interes: Number(c.interes),
        capital: Number(c.capital), saldo: Number(c.saldo),
      })),
    })),
    prestamosExpress: prestamosExpress.map((e: any) => ({
      ...e,
      principal: Number(e.principal), interesPorSemana: Number(e.interesPorSemana),
      interesAcumulado: Number(e.interesAcumulado), total: Number(e.total),
    })),
    cuentasInversion: cuentasInversion.map((c: any) => ({
      ...c,
      montoInvertido: Number(c.montoInvertido),
      porcentajeParticipacion: Number(c.porcentajeParticipacion),
      interesesAcumulados: Number(c.interesesAcumulados),
    })),
    movimientosCuenta: movimientosCuenta.map((m: any) => ({ ...m, monto: Number(m.monto) })),
    movimientosFondo: movimientosFondo.map((m: any) => ({
      ...m, monto: Number(m.monto),
      saldoAntes: Number(m.saldoAntes), saldoDespues: Number(m.saldoDespues),
    })),
    movimientosCaja: movimientosCaja.map((m: any) => ({ ...m, monto: Number(m.monto) })),
    ingresosMulta: ingresosMulta.map((m: any) => ({ ...m, monto: Number(m.monto) })),
    gastosMulta: gastosMulta.map((m: any) => ({ ...m, monto: Number(m.monto) })),
    sociosSaldos: socios.map(s => ({
      socioId: s.id,
      saldoAhorros: Number(s.saldoAhorros),
      multas: s.multas,
    })),
  };

  const snapshot = await (tx as any).snapshotRonda.create({
    data: {
      rondaId,
      semana: ronda.semanaActual,
      nombre,
      datos,
      tipo,
    },
  });

  return snapshot;
}

export async function restaurarSnapshot(
  tx: Prisma.TransactionClient,
  snapshotId: number
) {
  const snapshot = await (tx as any).snapshotRonda.findUnique({
    where: { id: snapshotId },
  });
  if (!snapshot) throw new Error("Snapshot no encontrado");

  const datos = snapshot.datos as any;
  const rondaId = snapshot.rondaId;

  // 1. Eliminar todos los datos actuales de la ronda (misma lógica que DELETE ronda)
  const prestamoIds = (await tx.prestamo.findMany({
    where: { rondaId }, select: { id: true },
  })).map((p: any) => p.id);

  if (prestamoIds.length > 0) {
    const cuotaIds = (await tx.prestamoCuota.findMany({
      where: { prestamoId: { in: prestamoIds } }, select: { id: true },
    })).map((c: any) => c.id);
    if (cuotaIds.length > 0) {
      await tx.movimientoFondo.deleteMany({ where: { cuotaId: { in: cuotaIds } } });
    }
    await tx.movimientoFondo.deleteMany({ where: { prestamoId: { in: prestamoIds } } });
    await tx.prestamoCuota.deleteMany({ where: { prestamoId: { in: prestamoIds } } });
  }
  await tx.prestamo.deleteMany({ where: { rondaId } });

  await tx.aporte.updateMany({
    where: { rondaId, prestamoExpressId: { not: null } },
    data: { prestamoExpressId: null },
  });
  await (tx as any).prestamoExpress.deleteMany({ where: { rondaId } });
  await tx.aporte.deleteMany({ where: { rondaId } });
  await tx.ahorro.deleteMany({ where: { rondaId } });
  await tx.movimientoCuenta.deleteMany({ where: { rondaId } });
  await (tx as any).movimientoCaja.deleteMany({ where: { rondaId } });
  await (tx as any).ingresoMulta.deleteMany({ where: { rondaId } });
  await (tx as any).gastoMulta.deleteMany({ where: { rondaId } });
  await tx.cuentaInversion.deleteMany({ where: { rondaId } });
  await tx.movimientoFondo.deleteMany({ where: { rondaId } });
  await tx.responsableCobroSemana.deleteMany({ where: { rondaId } });
  await tx.participacion.deleteMany({ where: { rondaId } });

  // 2. Restaurar la ronda
  const r = datos.ronda;
  await tx.ronda.update({
    where: { id: rondaId },
    data: {
      nombre: r.nombre,
      montoAporte: r.montoAporte,
      activa: r.activa,
      fechaInicio: new Date(r.fechaInicio),
      fechaFin: r.fechaFin ? new Date(r.fechaFin) : null,
      semanaActual: r.semanaActual,
      intervaloDiasCobro: r.intervaloDiasCobro,
      ahorroObjetivoPorSocio: r.ahorroObjetivoPorSocio,
      responsableId: r.responsableId,
      saldoFondoDisponible: r.saldoFondoDisponible,
      fondoTotalHistorico: r.fondoTotalHistorico,
      reporteExcel: null,
      reporteGeneradoAt: null,
    },
  });

  // 3. Recrear participaciones
  if (datos.participaciones?.length > 0) {
    await tx.participacion.createMany({
      data: datos.participaciones.map((p: any) => ({
        rondaId, socioId: p.socioId, orden: p.orden, activo: p.activo,
      })),
    });
  }

  // 4. Recrear responsables
  if (datos.responsables?.length > 0) {
    await tx.responsableCobroSemana.createMany({
      data: datos.responsables.map((r: any) => ({
        rondaId, semana: r.semana, socioId: r.socioId,
        observaciones: r.observaciones ?? null,
      })),
    });
  }

  // 5. Recrear préstamos + cuotas
  for (const p of datos.prestamos ?? []) {
    const prestamo = await tx.prestamo.create({
      data: {
        rondaId, socioId: p.socioId, monto: p.monto, tasaAnual: p.tasaAnual,
        plazoMeses: p.plazoMeses, fechaInicio: new Date(p.fechaInicio),
        estado: p.estado, notaCancelacion: p.notaCancelacion ?? null,
        saldoActual: p.saldoActual,
      },
    });
    if (p.cuotas?.length > 0) {
      await tx.prestamoCuota.createMany({
        data: p.cuotas.map((c: any) => ({
          prestamoId: prestamo.id, numero: c.numero,
          fechaVenc: new Date(c.fechaVenc), cuota: c.cuota,
          interes: c.interes, capital: c.capital, saldo: c.saldo,
          pagada: c.pagada, fechaPago: c.fechaPago ? new Date(c.fechaPago) : null,
        })),
      });
    }
  }

  // 6. Recrear préstamos express
  const expressMap = new Map<number, number>();
  for (const e of datos.prestamosExpress ?? []) {
    const oldId = e.id;
    const created = await (tx as any).prestamoExpress.create({
      data: {
        rondaId, socioId: e.socioId, semana: e.semana,
        semanaVencimiento: e.semanaVencimiento, principal: e.principal,
        interesPorSemana: e.interesPorSemana, interesAcumulado: e.interesAcumulado,
        total: e.total, estado: e.estado, semanaCobro: e.semanaCobro ?? null,
        observaciones: e.observaciones ?? null,
      },
    });
    expressMap.set(oldId, created.id);
  }

  // 7. Recrear aportes (con FK express actualizada)
  if (datos.aportes?.length > 0) {
    for (const a of datos.aportes) {
      await tx.aporte.create({
        data: {
          rondaId, socioId: a.socioId, semana: a.semana,
          monto: a.monto, multa: a.multa, fecha: new Date(a.fecha),
          observaciones: a.observaciones ?? "",
          prestamoExpressId: a.prestamoExpressId ? (expressMap.get(a.prestamoExpressId) ?? null) : null,
        },
      });
    }
  }

  // 8. Recrear ahorros
  if (datos.ahorros?.length > 0) {
    await tx.ahorro.createMany({
      data: datos.ahorros.map((a: any) => ({
        rondaId, socioId: a.socioId, semana: a.semana,
        monto: a.monto, observaciones: a.observaciones ?? "",
        fecha: new Date(a.fecha),
      })),
    });
  }

  // 9. Recrear cuentas de inversión
  if (datos.cuentasInversion?.length > 0) {
    await tx.cuentaInversion.createMany({
      data: datos.cuentasInversion.map((c: any) => ({
        rondaId, socioId: c.socioId, montoInvertido: c.montoInvertido,
        porcentajeParticipacion: c.porcentajeParticipacion,
        interesesAcumulados: c.interesesAcumulados, devuelto: c.devuelto,
      })),
    });
  }

  // 10. Recrear movimientos cuenta
  if (datos.movimientosCuenta?.length > 0) {
    await tx.movimientoCuenta.createMany({
      data: datos.movimientosCuenta.map((m: any) => ({
        socioId: m.socioId, rondaId: m.rondaId,
        tipo: m.tipo, monto: m.monto, nota: m.nota ?? null,
        createdAt: new Date(m.createdAt),
      })),
    });
  }

  // 11. Recrear movimientos fondo
  if (datos.movimientosFondo?.length > 0) {
    for (const m of datos.movimientosFondo) {
      await tx.movimientoFondo.create({
        data: {
          rondaId, tipo: m.tipo, monto: m.monto,
          saldoAntes: m.saldoAntes, saldoDespues: m.saldoDespues,
          nota: m.nota ?? null,
        },
      });
    }
  }

  // 12. Recrear movimientos caja
  if (datos.movimientosCaja?.length > 0) {
    for (const m of datos.movimientosCaja) {
      await (tx as any).movimientoCaja.create({
        data: {
          rondaId, tipo: m.tipo, estado: m.estado, monto: m.monto,
          socioId: m.socioId ?? null, semana: m.semana ?? null,
          descripcion: m.descripcion ?? null, fecha: new Date(m.fecha),
        },
      });
    }
  }

  // 13. Recrear ingresos/gastos multa
  if (datos.ingresosMulta?.length > 0) {
    for (const m of datos.ingresosMulta) {
      await (tx as any).ingresoMulta.create({
        data: {
          rondaId, socioId: m.socioId, semana: m.semana,
          monto: m.monto, observaciones: m.observaciones ?? null,
          fecha: new Date(m.fecha),
        },
      });
    }
  }
  if (datos.gastosMulta?.length > 0) {
    for (const m of datos.gastosMulta) {
      await (tx as any).gastoMulta.create({
        data: {
          rondaId, descripcion: m.descripcion, monto: m.monto,
          fecha: new Date(m.fecha), creadoPor: m.creadoPor ?? null,
        },
      });
    }
  }

  // 14. Restaurar saldos de socios
  for (const s of datos.sociosSaldos ?? []) {
    await tx.socio.update({
      where: { id: s.socioId },
      data: {
        saldoAhorros: s.saldoAhorros,
        multas: s.multas,
      },
    });
  }

  return { rondaId, semanaRestaurada: datos.ronda.semanaActual };
}
