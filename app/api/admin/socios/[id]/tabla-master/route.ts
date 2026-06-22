import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    const socioId = Number(id);

    // ── 1. Socio with participaciones (all rondas they joined) ──────────────
    const socio = await prisma.socio.findUnique({
      where: { id: socioId },
      include: {
        participaciones: {
          include: {
            ronda: {
              select: {
                id: true,
                nombre: true,
                activa: true,
                semanaActual: true,
                montoAporte: true,
                fechaInicio: true,
                fechaFin: true,
              },
            },
          },
        },
      },
    });

    if (!socio) {
      return NextResponse.json(
        { error: "Socio no encontrado" },
        { status: 404 },
      );
    }

    const rondaIds = socio.participaciones.map((p) => p.rondaId);

    // ── 2. Fetch all per-ronda data in parallel ─────────────────────────────
    const [
      aportes,
      ahorros,
      prestamosExpress,
      ingresosMulta,
      prestamos,
      cuentasInversion,
    ] = await Promise.all([
      prisma.aporte.findMany({
        where: { socioId, rondaId: { in: rondaIds } },
        select: { id: true, rondaId: true, semana: true, monto: true, multa: true },
      }),
      prisma.ahorro.findMany({
        where: { socioId, rondaId: { in: rondaIds } },
        select: { id: true, rondaId: true, semana: true, monto: true },
      }),
      (prisma as any).prestamoExpress.findMany({
        where: { socioId, rondaId: { in: rondaIds } },
        select: {
          id: true,
          rondaId: true,
          semana: true,
          principal: true,
          estado: true,
        },
      }),
      prisma.ingresoMulta.findMany({
        where: { socioId, rondaId: { in: rondaIds } },
        select: { rondaId: true, semana: true, monto: true },
      }),
      prisma.prestamo.findMany({
        where: { socioId, rondaId: { in: rondaIds } },
        include: {
          cuotas: {
            select: { pagada: true },
          },
        },
      }),
      prisma.cuentaInversion.findMany({
        where: { socioId, rondaId: { in: rondaIds } },
      }),
    ]);

    // ── 3. Build lookup maps (keyed by "rondaId-semana") ────────────────────
    // Aportes
    const aporteMap = new Map<string, { id: number; monto: number; multa: number }>();
    for (const a of aportes) {
      aporteMap.set(`${a.rondaId}-${a.semana}`, {
        id: a.id,
        monto: Number(a.monto),
        multa: Number(a.multa),
      });
    }

    // Ahorros
    const ahorroMap = new Map<string, { id: number; monto: number }>();
    for (const a of ahorros) {
      ahorroMap.set(`${a.rondaId}-${a.semana}`, { id: a.id, monto: Number(a.monto) });
    }

    // Prestamos Express
    const expressMap = new Map<
      string,
      { id: number; principal: number; estado: string }
    >();
    for (const pe of prestamosExpress) {
      expressMap.set(`${pe.rondaId}-${pe.semana}`, {
        id: pe.id,
        principal: Number(pe.principal),
        estado: pe.estado,
      });
    }

    // Ingresos Multa
    const multaMap = new Map<string, number>();
    for (const m of ingresosMulta) {
      const key = `${m.rondaId}-${m.semana}`;
      multaMap.set(key, (multaMap.get(key) ?? 0) + Number(m.monto));
    }

    // Prestamos by ronda
    const prestamosByRonda = new Map<
      number,
      Array<{
        id: number;
        monto: number;
        saldoActual: number;
        estado: string;
        cuotasPagadas: number;
        cuotasTotales: number;
      }>
    >();
    for (const p of prestamos) {
      if (!prestamosByRonda.has(p.rondaId)) prestamosByRonda.set(p.rondaId, []);
      prestamosByRonda.get(p.rondaId)!.push({
        id: p.id,
        monto: Number(p.monto),
        saldoActual: Number(p.saldoActual),
        estado: p.estado,
        cuotasPagadas: p.cuotas.filter((c: { pagada: boolean }) => c.pagada).length,
        cuotasTotales: p.cuotas.length,
      });
    }

    // Cuentas Inversion by ronda
    const inversionByRonda = new Map<
      number,
      {
        id: number;
        montoInvertido: number;
        porcentaje: number;
        intereses: number;
        devuelto: boolean;
      }
    >();
    for (const ci of cuentasInversion) {
      inversionByRonda.set(ci.rondaId, {
        id: ci.id,
        montoInvertido: Number(ci.montoInvertido),
        porcentaje: Number(ci.porcentajeParticipacion),
        intereses: Number(ci.interesesAcumulados),
        devuelto: ci.devuelto,
      });
    }

    // ── 4. Build rondas array ───────────────────────────────────────────────
    const rondasResult = socio.participaciones.map((part) => {
      const ronda = part.ronda;
      const semanaActual = ronda.semanaActual;
      const totalSemanas = semanaActual;

      const semanas: Record<
        string,
        {
          aporte: number | null;
          aporteId: number | null;
          multa: number;
          ahorro: number | null;
          ahorroId: number | null;
          express: { id: number; principal: number; estado: string } | null;
        }
      > = {};

      let totalAportes = 0;
      let totalAhorros = 0;
      let totalMultas = 0;

      for (let s = 1; s <= semanaActual; s++) {
        const key = `${ronda.id}-${s}`;
        const aporte = aporteMap.get(key);
        const ahorro = ahorroMap.get(key);
        const express = expressMap.get(key) ?? null;
        const multa = multaMap.get(key) ?? 0;

        const aporteVal = aporte?.monto ?? null;
        const ahorroVal = ahorro?.monto ?? null;

        if (aporteVal !== null) totalAportes += aporteVal;
        if (ahorroVal !== null) totalAhorros += ahorroVal;
        totalMultas += multa;

        semanas[String(s)] = {
          aporte: aporteVal,
          aporteId: aporte?.id ?? null,
          multa,
          ahorro: ahorroVal,
          ahorroId: ahorro?.id ?? null,
          express,
        };
      }

      return {
        rondaId: ronda.id,
        nombre: ronda.nombre,
        activa: ronda.activa,
        semanaActual: ronda.semanaActual,
        montoAporte: Number(ronda.montoAporte),
        fechaInicio: ronda.fechaInicio,
        fechaFin: ronda.fechaFin,
        totalSemanas,
        semanas,
        totales: {
          aportes: Math.round(totalAportes * 100) / 100,
          ahorros: Math.round(totalAhorros * 100) / 100,
          multas: Math.round(totalMultas * 100) / 100,
        },
        prestamos: prestamosByRonda.get(ronda.id) ?? [],
        inversion: inversionByRonda.get(ronda.id) ?? null,
      };
    });

    // ── 5. Return response ──────────────────────────────────────────────────
    return NextResponse.json({
      socio: {
        id: socio.id,
        nombres: socio.nombres,
        apellidos: socio.apellidos,
        numeroCuenta: socio.numeroCuenta,
        saldoAhorros: Number(socio.saldoAhorros),
        activo: socio.activo,
      },
      rondas: rondasResult,
    });
  } catch (error) {
    console.error("Error en tabla-master socio:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
