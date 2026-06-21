// app/api/admin/movimientos/route.ts
// Edición de aportes, ahorros, préstamos y cuotas con recálculo en cascada

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { registrarBitacora, diffObjetos, CambiosCadena } from "@/lib/bitacora";

export const runtime = "nodejs";

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const dec = (n: number) => new Prisma.Decimal(r2(n));

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { tipo, id, datos } = body;
    // tipo: "aporte" | "ahorro" | "prestamo" | "cuota" | "express"

    if (!tipo || !id || !datos)
      return NextResponse.json({ error: "tipo, id y datos son requeridos" }, { status: 400 });

    const efectos: CambiosCadena[] = [];

    // ── Editar Aporte ─────────────────────────────────────────────────────────
    if (tipo === "aporte") {
      const antes = await prisma.aporte.findUnique({ where: { id: Number(id) } });
      if (!antes) return NextResponse.json({ error: "Aporte no encontrado" }, { status: 404 });

      const despues = await prisma.aporte.update({
        where: { id: Number(id) },
        data: {
          ...(datos.monto !== undefined && { monto: dec(Number(datos.monto)) }),
          ...(datos.multa !== undefined && { multa: dec(Number(datos.multa)) }),
          ...(datos.observaciones !== undefined && { observaciones: String(datos.observaciones) }),
        },
      });

      const cambios = diffObjetos(
        { monto: Number(antes.monto), multa: Number(antes.multa) },
        { monto: Number(despues.monto), multa: Number(despues.multa) }
      );
      await registrarBitacora({ tabla: "aportes", registroId: Number(id), accion: "EDITAR", camposCambios: cambios });
      return NextResponse.json({ ok: true, cambios });
    }

    // ── Editar Ahorro → recalcular saldoAhorros del socio ────────────────────
    if (tipo === "ahorro") {
      const antes = await prisma.ahorro.findUnique({ where: { id: Number(id) } });
      if (!antes) return NextResponse.json({ error: "Ahorro no encontrado" }, { status: 404 });

      const montoAntes = Number(antes.monto);
      const montoNuevo = datos.monto !== undefined ? r2(Number(datos.monto)) : montoAntes;
      const diff = r2(montoNuevo - montoAntes);

      await prisma.$transaction(async (tx) => {
        await tx.ahorro.update({
          where: { id: Number(id) },
          data: { monto: dec(montoNuevo) },
        });
        if (diff !== 0) {
          await tx.socio.update({
            where: { id: antes.socioId },
            data: { saldoAhorros: { increment: dec(diff) } },
          });
        }
      });

      if (diff !== 0) {
        const socio = await prisma.socio.findUnique({ where: { id: antes.socioId }, select: { saldoAhorros: true, nombres: true } });
        efectos.push({
          tabla: "socios", registroId: antes.socioId,
          descripcion: `saldoAhorros recalculado por cambio en ahorro semana ${antes.semana}`,
          camposAfectados: {
            saldoAhorros: {
              antes: r2(Number(socio?.saldoAhorros ?? 0) - diff),
              despues: Number(socio?.saldoAhorros ?? 0),
            },
          },
        });
      }

      const cambios = diffObjetos({ monto: montoAntes }, { monto: montoNuevo });
      await registrarBitacora({ tabla: "ahorros", registroId: Number(id), accion: "EDITAR", camposCambios: cambios, efectosCadena: efectos });
      return NextResponse.json({ ok: true, cambios, efectos });
    }

    // ── Editar Préstamo → recalcular cuotas si cambia monto/tasa/plazo ───────
    if (tipo === "prestamo") {
      const antes = await prisma.prestamo.findUnique({
        where: { id: Number(id) },
        include: { cuotas: true },
      });
      if (!antes) return NextResponse.json({ error: "Préstamo no encontrado" }, { status: 404 });

      const montoNuevo = datos.monto !== undefined ? r2(Number(datos.monto)) : Number(antes.monto);
      const tasaNueva = datos.tasaAnual !== undefined ? r2(Number(datos.tasaAnual)) : Number(antes.tasaAnual);
      const plazoNuevo = datos.plazoMeses !== undefined ? Number(datos.plazoMeses) : antes.plazoMeses;
      const recalcular = montoNuevo !== Number(antes.monto) || tasaNueva !== Number(antes.tasaAnual) || plazoNuevo !== antes.plazoMeses;

      await prisma.$transaction(async (tx) => {
        await tx.prestamo.update({
          where: { id: Number(id) },
          data: {
            ...(datos.monto !== undefined && { monto: dec(montoNuevo), saldoActual: dec(montoNuevo) }),
            ...(datos.tasaAnual !== undefined && { tasaAnual: dec(tasaNueva) }),
            ...(datos.plazoMeses !== undefined && { plazoMeses: plazoNuevo }),
          },
        });

        if (recalcular) {
          // Recalcular tabla de amortización
          const tasaMensual = tasaNueva / 100 / 12;
          const cuotaMensual = tasaMensual > 0
            ? r2(montoNuevo * tasaMensual / (1 - Math.pow(1 + tasaMensual, -plazoNuevo)))
            : r2(montoNuevo / plazoNuevo);

          // Eliminar cuotas no pagadas y reconstruir
          const cuotasPagadas = antes.cuotas.filter(c => c.pagada);
          const numerosYaPagados = new Set(cuotasPagadas.map(c => c.numero));
          await tx.prestamoCuota.deleteMany({
            where: { prestamoId: Number(id), pagada: false },
          });

          let saldo = montoNuevo;
          // Descontar capital de cuotas ya pagadas
          cuotasPagadas.forEach(c => { saldo -= Number(c.capital); });

          const fechaBase = new Date(antes.fechaInicio);
          for (let n = 1; n <= plazoNuevo; n++) {
            if (numerosYaPagados.has(n)) continue;
            const interes = r2(saldo * tasaMensual);
            const capital = r2(Math.min(cuotaMensual - interes, saldo));
            saldo = r2(saldo - capital);
            const fechaVenc = new Date(fechaBase);
            fechaVenc.setMonth(fechaVenc.getMonth() + n);
            await tx.prestamoCuota.create({
              data: {
                prestamoId: Number(id),
                numero: n,
                fechaVenc,
                cuota: dec(cuotaMensual),
                interes: dec(interes),
                capital: dec(capital),
                saldo: dec(Math.max(saldo, 0)),
                pagada: false,
              },
            });
          }
          // Actualizar saldo actual
          await tx.prestamo.update({
            where: { id: Number(id) },
            data: { saldoActual: dec(Math.max(saldo, 0)) },
          });

          efectos.push({
            tabla: "prestamo_cuotas", registroId: Number(id),
            descripcion: `${plazoNuevo - cuotasPagadas.length} cuotas recalculadas por cambio en monto/tasa/plazo`,
          });
        }
      });

      const cambios = diffObjetos(
        { monto: Number(antes.monto), tasaAnual: Number(antes.tasaAnual), plazoMeses: antes.plazoMeses },
        { monto: montoNuevo, tasaAnual: tasaNueva, plazoMeses: plazoNuevo }
      );
      await registrarBitacora({ tabla: "prestamos", registroId: Number(id), accion: "EDITAR", camposCambios: cambios, efectosCadena: efectos });
      return NextResponse.json({ ok: true, cambios, efectos });
    }

    // ── Editar CuentaInversion → recalcular % de todos los socios ────────────
    if (tipo === "cuentaInversion") {
      const cuenta = await prisma.cuentaInversion.findUnique({
        where: { id: Number(id) },
        include: { socio: { select: { nombres: true, apellidos: true } } },
      });
      if (!cuenta) return NextResponse.json({ error: "Cuenta de inversión no encontrada" }, { status: 404 });

      const montoAntes = Number(cuenta.montoInvertido);
      const montoNuevo = datos.montoInvertido !== undefined ? r2(Number(datos.montoInvertido)) : montoAntes;
      const interesesNuevo = datos.interesesAcumulados !== undefined ? r2(Number(datos.interesesAcumulados)) : Number(cuenta.interesesAcumulados);

      // Recalcular porcentajes de todos los inversores de la ronda
      await prisma.$transaction(async (tx) => {
        // Actualizar el monto de esta cuenta
        await tx.cuentaInversion.update({
          where: { id: Number(id) },
          data: {
            ...(datos.montoInvertido !== undefined && { montoInvertido: dec(montoNuevo) }),
            ...(datos.interesesAcumulados !== undefined && { interesesAcumulados: dec(interesesNuevo) }),
          },
        });

        if (datos.montoInvertido !== undefined && montoNuevo !== montoAntes) {
          // Obtener todas las cuentas actualizadas
          const todasCuentas = await tx.cuentaInversion.findMany({
            where: { rondaId: cuenta.rondaId },
          });
          const totalFondo = r2(todasCuentas.reduce((s, c) => s + Number(c.montoInvertido), 0));

          // Recalcular % de cada inversor
          for (const c of todasCuentas) {
            const pct = totalFondo > 0 ? r2((Number(c.montoInvertido) / totalFondo) * 100) : 0;
            await tx.cuentaInversion.update({
              where: { id: c.id },
              data: { porcentajeParticipacion: dec(pct) },
            });
          }

          // Actualizar saldoFondoDisponible de la ronda
          await tx.ronda.update({
            where: { id: cuenta.rondaId },
            data: { saldoFondoDisponible: dec(totalFondo) },
          });

          efectos.push({
            tabla: "cuenta_inversion",
            registroId: cuenta.rondaId,
            descripcion: `Porcentajes de participación recalculados para ${todasCuentas.length} inversores. Fondo total: $${totalFondo.toFixed(2)}`,
            camposAfectados: {
              saldoFondoDisponible: { antes: montoAntes, despues: totalFondo },
            },
          });
        }
      });

      const cambios = diffObjetos(
        { montoInvertido: montoAntes, interesesAcumulados: Number(cuenta.interesesAcumulados) },
        { montoInvertido: montoNuevo, interesesAcumulados: interesesNuevo }
      );
      await registrarBitacora({
        tabla: "cuenta_inversion", registroId: Number(id), accion: "EDITAR",
        camposCambios: cambios, efectosCadena: efectos.length ? efectos : undefined,
      });
      return NextResponse.json({ ok: true, cambios, efectos });
    }
    if (tipo === "express") {
      const antes = await (prisma as any).prestamoExpress.findUnique({ where: { id: Number(id) } });
      if (!antes) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

      const principal = datos.principal !== undefined ? r2(Number(datos.principal)) : Number(antes.principal);
      const interes = datos.interesAcumulado !== undefined ? r2(Number(datos.interesAcumulado)) : Number(antes.interesAcumulado ?? 0);
      const total = r2(principal + interes);

      await (prisma as any).prestamoExpress.update({
        where: { id: Number(id) },
        data: {
          ...(datos.principal !== undefined && { principal: dec(principal) }),
          ...(datos.interesAcumulado !== undefined && { interesAcumulado: dec(interes) }),
          total: dec(total),
          ...(datos.estado !== undefined && { estado: datos.estado }),
          ...(datos.observaciones !== undefined && { observaciones: datos.observaciones }),
        },
      });

      const cambios = diffObjetos(
        { principal: Number(antes.principal), interesAcumulado: Number(antes.interesAcumulado ?? 0), total: Number(antes.total) },
        { principal, interesAcumulado: interes, total }
      );
      await registrarBitacora({ tabla: "prestamos_express", registroId: Number(id), accion: "EDITAR", camposCambios: cambios });
      return NextResponse.json({ ok: true, cambios });
    }

    // ── Editar MovimientoCaja ─────────────────────────────────────────────────
    if (tipo === "movimientoCaja") {
      const antes = await (prisma as any).movimientoCaja.findUnique({ where: { id: Number(id) } });
      if (!antes) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

      await (prisma as any).movimientoCaja.update({
        where: { id: Number(id) },
        data: {
          ...(datos.monto !== undefined && { monto: dec(Number(datos.monto)) }),
          ...(datos.descripcion !== undefined && { descripcion: datos.descripcion }),
          ...(datos.estado !== undefined && { estado: datos.estado }),
          ...(datos.semana !== undefined && { semana: Number(datos.semana) }),
        },
      });

      const cambios = diffObjetos(
        { monto: Number(antes.monto), descripcion: antes.descripcion, estado: antes.estado },
        { monto: datos.monto ?? Number(antes.monto), descripcion: datos.descripcion ?? antes.descripcion, estado: datos.estado ?? antes.estado }
      );
      await registrarBitacora({ tabla: "movimientos_caja", registroId: Number(id), accion: "EDITAR", camposCambios: cambios });
      return NextResponse.json({ ok: true, cambios });
    }

    // ── Editar PrestamoCuota ────────────────────────────────────────────────
    if (tipo === "cuota") {
      const cuota = await prisma.prestamoCuota.findUnique({
        where: { id: Number(id) },
        include: { prestamo: true },
      });
      if (!cuota) return NextResponse.json({ error: "Cuota no encontrada" }, { status: 404 });

      // Acción especial: revertir pago
      if (datos.accion === "revertir_pago") {
        if (!cuota.pagada) return NextResponse.json({ error: "La cuota no está pagada" }, { status: 400 });

        await prisma.$transaction(async (tx) => {
          await tx.prestamoCuota.update({
            where: { id: Number(id) },
            data: { pagada: false, fechaPago: null },
          });
          await tx.prestamo.update({
            where: { id: cuota.prestamoId },
            data: {
              saldoActual: { increment: dec(Number(cuota.capital)) },
              estado: "ACTIVO",
            },
          });
          // Revertir MovimientoFondo asociado
          await tx.movimientoFondo.deleteMany({ where: { cuotaId: Number(id) } });
          // Revertir saldo fondo
          await tx.ronda.update({
            where: { id: cuota.prestamo.rondaId },
            data: { saldoFondoDisponible: { decrement: dec(Number(cuota.capital)) } },
          });
        });

        efectos.push({
          tabla: "prestamos", registroId: cuota.prestamoId,
          descripcion: `Pago revertido cuota #${cuota.numero}. Saldo préstamo incrementado en $${Number(cuota.capital).toFixed(2)}`,
        });
        await registrarBitacora({
          tabla: "prestamo_cuotas", registroId: Number(id), accion: "EDITAR",
          camposCambios: { pagada: { antes: true, despues: false }, accion: { antes: null, despues: "revertir_pago" } },
          efectosCadena: efectos,
        });
        return NextResponse.json({ ok: true, efectos });
      }

      // Edición normal de campos
      const cambiosData: any = {};
      if (datos.fechaVenc !== undefined) cambiosData.fechaVenc = new Date(datos.fechaVenc);
      if (datos.fechaPago !== undefined) cambiosData.fechaPago = datos.fechaPago ? new Date(datos.fechaPago + "T12:00:00Z") : null;
      if (datos.cuota !== undefined) cambiosData.cuota = dec(Number(datos.cuota));
      if (datos.interes !== undefined) cambiosData.interes = dec(Number(datos.interes));
      if (datos.capital !== undefined) cambiosData.capital = dec(Number(datos.capital));
      if (datos.saldo !== undefined) cambiosData.saldo = dec(Number(datos.saldo));

      if (Object.keys(cambiosData).length === 0) {
        return NextResponse.json({ error: "No hay campos para editar" }, { status: 400 });
      }

      await prisma.prestamoCuota.update({ where: { id: Number(id) }, data: cambiosData });

      const cambios = diffObjetos(
        { cuota: Number(cuota.cuota), interes: Number(cuota.interes), capital: Number(cuota.capital) },
        { cuota: datos.cuota ?? Number(cuota.cuota), interes: datos.interes ?? Number(cuota.interes), capital: datos.capital ?? Number(cuota.capital) }
      );
      await registrarBitacora({ tabla: "prestamo_cuotas", registroId: Number(id), accion: "EDITAR", camposCambios: cambios });
      return NextResponse.json({ ok: true, cambios });
    }

    return NextResponse.json({ error: `tipo '${tipo}' no reconocido` }, { status: 400 });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function DELETE(req: Request) {
  try {
    const { tipo, id } = await req.json();
    const efectos: CambiosCadena[] = [];

    if (tipo === "aporte") {
      const aporte = await prisma.aporte.findUnique({ where: { id: Number(id) } });
      if (!aporte) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
      await prisma.aporte.delete({ where: { id: Number(id) } });
      await registrarBitacora({ tabla: "aportes", registroId: Number(id), accion: "ELIMINAR", camposCambios: { monto: { antes: Number(aporte.monto), despues: null } } });
    }

    else if (tipo === "ahorro") {
      const ahorro = await prisma.ahorro.findUnique({ where: { id: Number(id) } });
      if (!ahorro) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
      const monto = Number(ahorro.monto);
      await prisma.$transaction(async (tx) => {
        await tx.ahorro.delete({ where: { id: Number(id) } });
        if (monto > 0) await tx.socio.update({ where: { id: ahorro.socioId }, data: { saldoAhorros: { decrement: new Prisma.Decimal(monto) } } });
      });
      efectos.push({ tabla: "socios", registroId: ahorro.socioId, descripcion: `saldoAhorros decrementado ${monto} por eliminación de ahorro` });
      await registrarBitacora({ tabla: "ahorros", registroId: Number(id), accion: "ELIMINAR", camposCambios: { monto: { antes: monto, despues: null } }, efectosCadena: efectos });
    }

    else if (tipo === "movimientoCaja") {
      const mov = await (prisma as any).movimientoCaja.findUnique({
        where: { id: Number(id) },
        include: { socio: { select: { nombres: true, apellidos: true, numeroCuenta: true } }, ronda: { select: { nombre: true } } },
      });
      if (!mov) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
      await (prisma as any).movimientoCaja.delete({ where: { id: Number(id) } });
      await registrarBitacora({
        tabla: "movimientos_caja", registroId: Number(id), accion: "ELIMINAR",
        camposCambios: {
          tipo: { antes: mov.tipo, despues: null },
          monto: { antes: Number(mov.monto), despues: null },
          estado: { antes: mov.estado, despues: null },
          socio: { antes: mov.socio ? `${mov.socio.nombres} ${mov.socio.apellidos} (${mov.socio.numeroCuenta})` : null, despues: null },
          semana: { antes: mov.semana, despues: null },
          descripcion: { antes: mov.descripcion, despues: null },
          ronda: { antes: mov.ronda?.nombre, despues: null },
        },
      });
    }

    else if (tipo === "cuota") {
      const cuota = await prisma.prestamoCuota.findUnique({
        where: { id: Number(id) },
        include: { prestamo: { include: { cuotas: { orderBy: { numero: "asc" } } } } },
      });
      if (!cuota) return NextResponse.json({ error: "Cuota no encontrada" }, { status: 404 });
      if (cuota.pagada) return NextResponse.json({ error: "No se puede eliminar una cuota ya pagada" }, { status: 400 });

      // Solo permitir eliminar la última cuota no pagada
      const cuotasNoPagadas = cuota.prestamo.cuotas.filter(c => !c.pagada);
      const esUltima = cuotasNoPagadas[cuotasNoPagadas.length - 1]?.id === cuota.id;
      if (!esUltima) return NextResponse.json({ error: "Solo se puede eliminar la última cuota pendiente del préstamo" }, { status: 400 });

      await prisma.$transaction(async (tx) => {
        await tx.prestamoCuota.delete({ where: { id: Number(id) } });
        // Recalcular saldo actual del préstamo
        const cuotaAnterior = cuota.prestamo.cuotas.find(c => c.numero === cuota.numero - 1);
        if (cuotaAnterior) {
          await tx.prestamo.update({
            where: { id: cuota.prestamoId },
            data: { saldoActual: cuotaAnterior.saldo },
          });
        }
      });

      efectos.push({ tabla: "prestamos", registroId: cuota.prestamoId, descripcion: `Saldo recalculado tras eliminar cuota #${cuota.numero}` });
      await registrarBitacora({
        tabla: "prestamo_cuotas", registroId: Number(id), accion: "ELIMINAR",
        camposCambios: { numero: { antes: cuota.numero, despues: null }, monto: { antes: Number(cuota.cuota), despues: null } },
        efectosCadena: efectos,
      });
    }

    else if (tipo === "express") {
      const exp = await (prisma as any).prestamoExpress.findUnique({ where: { id: Number(id) } });
      if (!exp) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
      await prisma.$transaction(async (tx) => {
        await tx.aporte.updateMany({
          where: { prestamoExpressId: Number(id) },
          data: { prestamoExpressId: null },
        });
        await (tx as any).prestamoExpress.delete({ where: { id: Number(id) } });
      });
      efectos.push({ tabla: "aportes", registroId: Number(id), descripcion: "FK prestamoExpressId limpiada en aportes vinculados" });
      await registrarBitacora({ tabla: "prestamos_express", registroId: Number(id), accion: "ELIMINAR", camposCambios: { id: { antes: id, despues: null }, principal: { antes: Number(exp.principal), despues: null }, estado: { antes: exp.estado, despues: null } }, efectosCadena: efectos });
    }

    else if (tipo === "cuentaInversion") {
      const cuenta = await prisma.cuentaInversion.findUnique({
        where: { id: Number(id) },
        include: { socio: { select: { id: true, nombres: true, apellidos: true, saldoAhorros: true } } },
      });
      if (!cuenta) return NextResponse.json({ error: "Cuenta de inversión no encontrada" }, { status: 404 });
      if (!cuenta.devuelto) {
        return NextResponse.json({ error: "No se puede eliminar una inversión no devuelta. Primero cierre la ronda o devuelva manualmente." }, { status: 400 });
      }

      await prisma.$transaction(async (tx) => {
        // Eliminar movimientos INVERSION asociados
        await tx.movimientoCuenta.deleteMany({
          where: { socioId: cuenta.socioId, rondaId: cuenta.rondaId, tipo: "INVERSION" },
        });
        // Eliminar la cuenta
        await tx.cuentaInversion.delete({ where: { id: Number(id) } });
        // Recalcular % de los demás inversores
        const restantes = await tx.cuentaInversion.findMany({ where: { rondaId: cuenta.rondaId } });
        const totalFondo = restantes.reduce((s, c) => s + Number(c.montoInvertido), 0);
        for (const c of restantes) {
          const pct = totalFondo > 0 ? r2((Number(c.montoInvertido) / totalFondo) * 100) : 0;
          await tx.cuentaInversion.update({ where: { id: c.id }, data: { porcentajeParticipacion: dec(pct) } });
        }
        await tx.ronda.update({
          where: { id: cuenta.rondaId },
          data: { saldoFondoDisponible: dec(totalFondo) },
        });
      });

      efectos.push({
        tabla: "cuenta_inversion", registroId: cuenta.rondaId,
        descripcion: `Inversión de ${cuenta.socio.nombres} ${cuenta.socio.apellidos} eliminada. Porcentajes recalculados.`,
      });
      await registrarBitacora({
        tabla: "cuenta_inversion", registroId: Number(id), accion: "ELIMINAR",
        camposCambios: {
          socio: { antes: `${cuenta.socio.nombres} ${cuenta.socio.apellidos}`, despues: null },
          montoInvertido: { antes: Number(cuenta.montoInvertido), despues: null },
        },
        efectosCadena: efectos,
      });
    }

    else {
      return NextResponse.json({ error: `tipo '${tipo}' no soportado para DELETE` }, { status: 400 });
    }

    return NextResponse.json({ ok: true, efectos });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
