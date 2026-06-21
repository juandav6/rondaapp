// app/api/admin/relaciones/route.ts
// GET: Dado tabla + id, devuelve todos los registros relacionados

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const TABLAS_VALIDAS = ["socios", "rondas", "prestamos", "aportes", "ahorros"] as const;
type TablaValida = (typeof TABLAS_VALIDAS)[number];

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const tabla = searchParams.get("tabla") as TablaValida | null;
    const idParam = searchParams.get("id");

    if (!tabla || !idParam) {
      return NextResponse.json({ error: "Parametros 'tabla' e 'id' son requeridos" }, { status: 400 });
    }
    if (!TABLAS_VALIDAS.includes(tabla)) {
      return NextResponse.json(
        { error: `Tabla invalida. Valores permitidos: ${TABLAS_VALIDAS.join(", ")}` },
        { status: 400 }
      );
    }

    const id = Number(idParam);
    if (isNaN(id)) {
      return NextResponse.json({ error: "id debe ser un numero" }, { status: 400 });
    }

    let registro: any = null;
    const relaciones: Record<string, { count: number; registros: any[] }> = {};

    switch (tabla) {
      case "socios": {
        registro = await prisma.socio.findUnique({
          where: { id },
          select: {
            id: true, numeroCuenta: true, nombres: true, apellidos: true,
            cedula: true, edad: true, saldoAhorros: true, multas: true, activo: true,
          },
        });
        if (!registro) return NextResponse.json({ error: "Socio no encontrado" }, { status: 404 });
        registro.saldoAhorros = Number(registro.saldoAhorros);

        // Aportes
        const [aporteCount, aportes] = await Promise.all([
          prisma.aporte.count({ where: { socioId: id } }),
          prisma.aporte.findMany({
            where: { socioId: id },
            orderBy: { fecha: "desc" },
            take: 10,
            include: { ronda: { select: { id: true, nombre: true } } },
          }),
        ]);
        relaciones.aportes = {
          count: aporteCount,
          registros: aportes.map((a) => ({ ...a, monto: Number(a.monto), multa: Number(a.multa) })),
        };

        // Ahorros
        const [ahorroCount, ahorros] = await Promise.all([
          prisma.ahorro.count({ where: { socioId: id } }),
          prisma.ahorro.findMany({
            where: { socioId: id },
            orderBy: { fecha: "desc" },
            take: 10,
            include: { ronda: { select: { id: true, nombre: true } } },
          }),
        ]);
        relaciones.ahorros = {
          count: ahorroCount,
          registros: ahorros.map((a) => ({ ...a, monto: Number(a.monto) })),
        };

        // Prestamos
        const [prestamoCount, prestamos] = await Promise.all([
          prisma.prestamo.count({ where: { socioId: id } }),
          prisma.prestamo.findMany({
            where: { socioId: id },
            orderBy: { createdAt: "desc" },
            take: 10,
            include: { ronda: { select: { id: true, nombre: true } } },
          }),
        ]);
        relaciones.prestamos = {
          count: prestamoCount,
          registros: prestamos.map((p) => ({
            ...p,
            monto: Number(p.monto),
            tasaAnual: Number(p.tasaAnual),
            saldoActual: Number(p.saldoActual),
          })),
        };

        // PrestamosExpress
        const [expressCount, express] = await Promise.all([
          prisma.prestamoExpress.count({ where: { socioId: id } }),
          prisma.prestamoExpress.findMany({
            where: { socioId: id },
            orderBy: { createdAt: "desc" },
            take: 10,
          }),
        ]);
        relaciones.prestamosExpress = {
          count: expressCount,
          registros: express.map((pe) => ({
            ...pe,
            principal: Number(pe.principal),
            interesPorSemana: Number(pe.interesPorSemana),
            interesAcumulado: Number(pe.interesAcumulado),
            total: Number(pe.total),
          })),
        };

        // MovimientosCuenta
        const [movCount, movimientos] = await Promise.all([
          prisma.movimientoCuenta.count({ where: { socioId: id } }),
          prisma.movimientoCuenta.findMany({
            where: { socioId: id },
            orderBy: { createdAt: "desc" },
            take: 10,
          }),
        ]);
        relaciones.movimientosCuenta = {
          count: movCount,
          registros: movimientos.map((m) => ({ ...m, monto: Number(m.monto) })),
        };

        // CuentasInversion
        const [invCount, inversiones] = await Promise.all([
          prisma.cuentaInversion.count({ where: { socioId: id } }),
          prisma.cuentaInversion.findMany({
            where: { socioId: id },
            orderBy: { createdAt: "desc" },
            take: 10,
            include: { ronda: { select: { id: true, nombre: true } } },
          }),
        ]);
        relaciones.cuentasInversion = {
          count: invCount,
          registros: inversiones.map((ci) => ({
            ...ci,
            montoInvertido: Number(ci.montoInvertido),
            porcentajeParticipacion: Number(ci.porcentajeParticipacion),
            interesesAcumulados: Number(ci.interesesAcumulados),
          })),
        };

        // Participaciones
        const partCount = await prisma.participacion.count({ where: { socioId: id } });
        const participaciones = await prisma.participacion.findMany({
          where: { socioId: id },
          include: { ronda: { select: { id: true, nombre: true } } },
        });
        relaciones.participaciones = { count: partCount, registros: participaciones };

        // IngresosMulta
        const [multaCount, multas] = await Promise.all([
          prisma.ingresoMulta.count({ where: { socioId: id } }),
          prisma.ingresoMulta.findMany({
            where: { socioId: id },
            orderBy: { fecha: "desc" },
            take: 10,
          }),
        ]);
        relaciones.ingresosMulta = {
          count: multaCount,
          registros: multas.map((m) => ({ ...m, monto: Number(m.monto) })),
        };

        break;
      }

      case "rondas": {
        registro = await prisma.ronda.findUnique({
          where: { id },
          select: {
            id: true, nombre: true, montoAporte: true, activa: true,
            fechaInicio: true, fechaFin: true, semanaActual: true,
            saldoFondoDisponible: true, fondoTotalHistorico: true,
          },
        });
        if (!registro) return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });
        registro.montoAporte = Number(registro.montoAporte);
        registro.saldoFondoDisponible = Number(registro.saldoFondoDisponible);
        registro.fondoTotalHistorico = Number(registro.fondoTotalHistorico);

        // Contar registros hijos
        const [
          aportesC, ahorrosC, participacionesC, prestamosC,
          expressC, inversionesC, movCuentaC, movFondoC,
          gastosC, ingresosC, movCajaC, snapshotsC,
        ] = await Promise.all([
          prisma.aporte.count({ where: { rondaId: id } }),
          prisma.ahorro.count({ where: { rondaId: id } }),
          prisma.participacion.count({ where: { rondaId: id } }),
          prisma.prestamo.count({ where: { rondaId: id } }),
          prisma.prestamoExpress.count({ where: { rondaId: id } }),
          prisma.cuentaInversion.count({ where: { rondaId: id } }),
          prisma.movimientoCuenta.count({ where: { rondaId: id } }),
          prisma.movimientoFondo.count({ where: { rondaId: id } }),
          prisma.gastoMulta.count({ where: { rondaId: id } }),
          prisma.ingresoMulta.count({ where: { rondaId: id } }),
          prisma.movimientoCaja.count({ where: { rondaId: id } }),
          prisma.snapshotRonda.count({ where: { rondaId: id } }),
        ]);

        relaciones.aportes = { count: aportesC, registros: [] };
        relaciones.ahorros = { count: ahorrosC, registros: [] };
        relaciones.participaciones = { count: participacionesC, registros: [] };
        relaciones.prestamos = { count: prestamosC, registros: [] };
        relaciones.prestamosExpress = { count: expressC, registros: [] };
        relaciones.cuentasInversion = { count: inversionesC, registros: [] };
        relaciones.movimientosCuenta = { count: movCuentaC, registros: [] };
        relaciones.movimientosFondo = { count: movFondoC, registros: [] };
        relaciones.gastosMulta = { count: gastosC, registros: [] };
        relaciones.ingresosMulta = { count: ingresosC, registros: [] };
        relaciones.movimientosCaja = { count: movCajaC, registros: [] };
        relaciones.snapshots = { count: snapshotsC, registros: [] };

        break;
      }

      case "prestamos": {
        registro = await prisma.prestamo.findUnique({
          where: { id },
          include: {
            socio: { select: { id: true, nombres: true, apellidos: true, numeroCuenta: true } },
            ronda: { select: { id: true, nombre: true } },
          },
        });
        if (!registro) return NextResponse.json({ error: "Prestamo no encontrado" }, { status: 404 });
        registro = {
          ...registro,
          monto: Number(registro.monto),
          tasaAnual: Number(registro.tasaAnual),
          saldoActual: Number(registro.saldoActual),
        };

        // Cuotas
        const cuotas = await prisma.prestamoCuota.findMany({
          where: { prestamoId: id },
          orderBy: { numero: "asc" },
        });
        relaciones.cuotas = {
          count: cuotas.length,
          registros: cuotas.map((c) => ({
            ...c,
            cuota: Number(c.cuota),
            interes: Number(c.interes),
            capital: Number(c.capital),
            saldo: Number(c.saldo),
          })),
        };

        // MovimientosFondo
        const movFondo = await prisma.movimientoFondo.findMany({
          where: { prestamoId: id },
          orderBy: { createdAt: "asc" },
        });
        relaciones.movimientosFondo = {
          count: movFondo.length,
          registros: movFondo.map((m) => ({
            ...m,
            monto: Number(m.monto),
            saldoAntes: Number(m.saldoAntes),
            saldoDespues: Number(m.saldoDespues),
          })),
        };

        break;
      }

      case "aportes": {
        registro = await prisma.aporte.findUnique({
          where: { id },
          include: {
            socio: { select: { id: true, nombres: true, apellidos: true, numeroCuenta: true } },
            ronda: { select: { id: true, nombre: true } },
            prestamoExpress: true,
          },
        });
        if (!registro) return NextResponse.json({ error: "Aporte no encontrado" }, { status: 404 });
        registro = {
          ...registro,
          monto: Number(registro.monto),
          multa: Number(registro.multa),
          prestamoExpress: registro.prestamoExpress
            ? {
                ...registro.prestamoExpress,
                principal: Number(registro.prestamoExpress.principal),
                interesPorSemana: Number(registro.prestamoExpress.interesPorSemana),
                interesAcumulado: Number(registro.prestamoExpress.interesAcumulado),
                total: Number(registro.prestamoExpress.total),
              }
            : null,
        };

        relaciones.socio = { count: 1, registros: [registro.socio] };
        relaciones.ronda = { count: 1, registros: [registro.ronda] };
        if (registro.prestamoExpress) {
          relaciones.prestamoExpress = { count: 1, registros: [registro.prestamoExpress] };
        }

        break;
      }

      case "ahorros": {
        registro = await prisma.ahorro.findUnique({
          where: { id },
          include: {
            socio: { select: { id: true, nombres: true, apellidos: true, numeroCuenta: true, saldoAhorros: true } },
            ronda: { select: { id: true, nombre: true } },
          },
        });
        if (!registro) return NextResponse.json({ error: "Ahorro no encontrado" }, { status: 404 });
        registro = {
          ...registro,
          monto: Number(registro.monto),
          socio: { ...registro.socio, saldoAhorros: Number(registro.socio.saldoAhorros) },
        };

        relaciones.socio = { count: 1, registros: [registro.socio] };
        relaciones.ronda = { count: 1, registros: [registro.ronda] };

        // Buscar movimientoCuenta correspondiente (mismo socio, ronda, tipo AHORRO, semana similar)
        const movCorrespondiente = await prisma.movimientoCuenta.findFirst({
          where: {
            socioId: registro.socioId,
            rondaId: registro.rondaId,
            tipo: "AHORRO",
            monto: registro.monto,
          },
          orderBy: { createdAt: "desc" },
        });

        if (movCorrespondiente) {
          relaciones.movimientoCuenta = {
            count: 1,
            registros: [{ ...movCorrespondiente, monto: Number(movCorrespondiente.monto) }],
          };
        }

        break;
      }
    }

    return NextResponse.json({
      tabla,
      registroId: id,
      registro,
      relaciones,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
