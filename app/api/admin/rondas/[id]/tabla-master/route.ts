import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    const rondaId = Number(id);

    // ── 1. Ronda con participaciones (socios ordenados por orden) ────────────
    const ronda = await prisma.ronda.findUnique({
      where: { id: rondaId },
      include: {
        participaciones: {
          orderBy: { orden: "asc" },
          include: {
            socio: {
              select: {
                id: true,
                nombres: true,
                apellidos: true,
                numeroCuenta: true,
                saldoAhorros: true,
              },
            },
          },
        },
      },
    });

    if (!ronda) {
      return NextResponse.json(
        { error: "Ronda no encontrada" },
        { status: 404 },
      );
    }

    const totalSemanas = ronda.participaciones.length;
    // For finalized rondas with semanaActual=0, use totalSemanas so data is visible
    const semanaActual = ronda.semanaActual > 0 ? ronda.semanaActual : (!ronda.activa ? totalSemanas : 0);

    // ── 2. Fetch all per-week data in parallel ──────────────────────────────
    const [
      aportes,
      ahorros,
      prestamosExpress,
      ingresosMulta,
      movimientosCaja,
      prestamos,
      cuentasInversion,
      responsablesSemana,
      movimientosFondo,
    ] = await Promise.all([
      prisma.aporte.findMany({
        where: { rondaId },
        select: { id: true, socioId: true, semana: true, monto: true, multa: true },
      }),
      prisma.ahorro.findMany({
        where: { rondaId },
        select: { id: true, socioId: true, semana: true, monto: true },
      }),
      prisma.prestamoExpress.findMany({
        where: { rondaId },
        select: {
          id: true,
          socioId: true,
          semana: true,
          principal: true,
          estado: true,
        },
      }),
      prisma.ingresoMulta.findMany({
        where: { rondaId },
        select: { socioId: true, semana: true, monto: true },
      }),
      prisma.movimientoCaja.findMany({
        where: { rondaId },
        select: {
          id: true,
          socioId: true,
          semana: true,
          tipo: true,
          estado: true,
          monto: true,
          descripcion: true,
        },
      }),
      prisma.prestamo.findMany({
        where: { rondaId },
        include: {
          cuotas: {
            select: { pagada: true },
          },
        },
      }),
      prisma.cuentaInversion.findMany({
        where: { rondaId },
      }),
      prisma.responsableCobroSemana.findMany({
        where: { rondaId },
        include: {
          socio: { select: { nombres: true, apellidos: true } },
        },
      }),
      prisma.movimientoCuenta.findMany({
        where: { rondaId, tipo: { in: ["INVERSION", "DEVOLUCION", "INTERES"] } },
        select: { id: true, socioId: true, tipo: true, monto: true, nota: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    // ── 3. Build lookup maps ────────────────────────────────────────────────
    // Aportes: key = "socioId-semana"
    const aporteMap = new Map<string, { id: number; monto: number; multa: number }>();
    for (const a of aportes) {
      aporteMap.set(`${a.socioId}-${a.semana}`, {
        id: a.id,
        monto: Number(a.monto),
        multa: Number(a.multa),
      });
    }

    // Ahorros: key = "socioId-semana"
    const ahorroMap = new Map<string, { id: number; monto: number }>();
    for (const a of ahorros) {
      ahorroMap.set(`${a.socioId}-${a.semana}`, { id: a.id, monto: Number(a.monto) });
    }

    // Prestamos Express: key = "socioId-semana" (puede haber varios, tomamos el primero)
    const expressMap = new Map<
      string,
      { id: number; principal: number; estado: string }
    >();
    for (const pe of prestamosExpress) {
      expressMap.set(`${pe.socioId}-${pe.semana}`, {
        id: pe.id,
        principal: Number(pe.principal),
        estado: pe.estado,
      });
    }

    // Ingresos Multa: key = "socioId-semana"
    const multaMap = new Map<string, number>();
    for (const m of ingresosMulta) {
      const key = `${m.socioId}-${m.semana}`;
      multaMap.set(key, (multaMap.get(key) ?? 0) + Number(m.monto));
    }

    // Movimientos Caja: key = "socioId-semana" (array)
    const cajaMap = new Map<
      string,
      Array<{
        id: number;
        tipo: string;
        estado: string;
        monto: number;
        descripcion: string | null;
      }>
    >();
    for (const mc of movimientosCaja) {
      if (mc.socioId != null && mc.semana != null) {
        const key = `${mc.socioId}-${mc.semana}`;
        if (!cajaMap.has(key)) cajaMap.set(key, []);
        cajaMap.get(key)!.push({
          id: mc.id,
          tipo: mc.tipo,
          estado: mc.estado,
          monto: Number(mc.monto),
          descripcion: mc.descripcion,
        });
      }
    }

    // Responsables por semana
    const responsableMap = new Map<
      number,
      string
    >();
    for (const r of responsablesSemana) {
      responsableMap.set(
        r.semana,
        `${r.socio.nombres} ${r.socio.apellidos}`,
      );
    }

    // Prestamos por socio
    const prestamosBySocio = new Map<
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
      if (!prestamosBySocio.has(p.socioId)) prestamosBySocio.set(p.socioId, []);
      prestamosBySocio.get(p.socioId)!.push({
        id: p.id,
        monto: Number(p.monto),
        saldoActual: Number(p.saldoActual),
        estado: p.estado,
        cuotasPagadas: p.cuotas.filter((c) => c.pagada).length,
        cuotasTotales: p.cuotas.length,
      });
    }

    // Cuentas Inversion por socio
    const inversionMap = new Map<
      number,
      {
        id: number;
        montoInvertido: number;
        porcentaje: number;
        intereses: number;
      }
    >();
    for (const ci of cuentasInversion) {
      inversionMap.set(ci.socioId, {
        id: ci.id,
        montoInvertido: Number(ci.montoInvertido),
        porcentaje: Number(ci.porcentajeParticipacion),
        intereses: Number(ci.interesesAcumulados),
      });
    }

    // Transferencias de fondo (INVERSION/DEVOLUCION/INTERES) por socio
    // Separar inversión inicial (primera) de transferencias intermedias (subsiguientes)
    const transferenciasMap = new Map<number, {
      inversionInicial: number;
      transferenciasIntermedias: Array<{ id: number; monto: number; nota: string | null; fecha: string }>;
      totalInvertido: number;
      devolucion: number;
      intereses: number;
      historial: Array<{ id: number; tipo: string; monto: number; nota: string | null; fecha: string }>;
    }>();

    for (const m of movimientosFondo) {
      if (!transferenciasMap.has(m.socioId)) {
        transferenciasMap.set(m.socioId, {
          inversionInicial: 0, transferenciasIntermedias: [], totalInvertido: 0,
          devolucion: 0, intereses: 0, historial: [],
        });
      }
      const entry = transferenciasMap.get(m.socioId)!;
      const mov = { id: m.id, tipo: m.tipo, monto: Number(m.monto), nota: m.nota, fecha: m.createdAt.toISOString() };
      entry.historial.push(mov);

      if (m.tipo === "INVERSION") {
        if (entry.totalInvertido === 0 && entry.transferenciasIntermedias.length === 0) {
          entry.inversionInicial = Number(m.monto);
        } else {
          entry.transferenciasIntermedias.push(mov);
        }
        entry.totalInvertido += Number(m.monto);
      } else if (m.tipo === "DEVOLUCION") {
        entry.devolucion += Number(m.monto);
      } else if (m.tipo === "INTERES") {
        entry.intereses += Number(m.monto);
      }
    }

    // ── 4. Build socios array ───────────────────────────────────────────────
    const sociosResult = ronda.participaciones.map((part) => {
      const socio = part.socio;
      const semanas: Record<
        string,
        {
          aporte: number | null;
          multa: number;
          ahorro: number | null;
          express: { id: number; principal: number; estado: string } | null;
          movimientosCaja: Array<{
            id: number;
            tipo: string;
            estado: string;
            monto: number;
            descripcion: string | null;
          }>;
        }
      > = {};

      let totalAportes = 0;
      let totalAhorros = 0;
      let totalMultas = 0;

      for (let s = 1; s <= semanaActual; s++) {
        const key = `${socio.id}-${s}`;
        const aporte = aporteMap.get(key);
        const ahorro = ahorroMap.get(key);
        const express = expressMap.get(key) ?? null;
        const multa = multaMap.get(key) ?? 0;
        const caja = cajaMap.get(key) ?? [];

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
          movimientosCaja: caja,
        };
      }

      return {
        socioId: socio.id,
        nombres: socio.nombres,
        apellidos: socio.apellidos,
        numeroCuenta: socio.numeroCuenta,
        orden: part.orden,
        saldoAhorros: Number(socio.saldoAhorros),
        semanas,
        totales: {
          aportes: Math.round(totalAportes * 100) / 100,
          ahorros: Math.round(totalAhorros * 100) / 100,
          multas: Math.round(totalMultas * 100) / 100,
        },
        prestamos: prestamosBySocio.get(socio.id) ?? [],
        inversion: inversionMap.get(socio.id) ?? null,
        transferencias: transferenciasMap.get(socio.id) ?? {
          inversionInicial: 0, transferenciasIntermedias: [], totalInvertido: 0,
          devolucion: 0, intereses: 0, historial: [],
        },
      };
    });

    // ── 4b. Add investor-only socios (have cuentaInversion but no participacion)
    const participantIds = new Set(ronda.participaciones.map(p => p.socio.id));
    const investorOnlyIds = [...inversionMap.keys()].filter(id => !participantIds.has(id));

    if (investorOnlyIds.length > 0) {
      const investorSocios = await prisma.socio.findMany({
        where: { id: { in: investorOnlyIds } },
        select: { id: true, nombres: true, apellidos: true, numeroCuenta: true, saldoAhorros: true },
      });
      for (const socio of investorSocios) {
        sociosResult.push({
          socioId: socio.id,
          nombres: socio.nombres,
          apellidos: socio.apellidos,
          numeroCuenta: socio.numeroCuenta,
          orden: null,
          saldoAhorros: Number(socio.saldoAhorros),
          soloInversor: true,
          semanas: {},
          totales: { aportes: 0, ahorros: 0, multas: 0 },
          prestamos: prestamosBySocio.get(socio.id) ?? [],
          inversion: inversionMap.get(socio.id) ?? null,
          transferencias: transferenciasMap.get(socio.id) ?? {
            inversionInicial: 0, transferenciasIntermedias: [], totalInvertido: 0,
            devolucion: 0, intereses: 0, historial: [],
          },
        });
      }
    }

    // ── 5. Build per-week totals ────────────────────────────────────────────
    const semanasResult: Record<
      string,
      {
        totalAportes: number;
        totalAhorros: number;
        totalMultas: number;
        responsable: string | null;
      }
    > = {};

    for (let s = 1; s <= semanaActual; s++) {
      let sumAportes = 0;
      let sumAhorros = 0;
      let sumMultas = 0;

      for (const part of ronda.participaciones) {
        const key = `${part.socio.id}-${s}`;
        const aporte = aporteMap.get(key);
        if (aporte) sumAportes += aporte.monto;
        const ahorro = ahorroMap.get(key);
        if (ahorro !== undefined) sumAhorros += ahorro;
        sumMultas += multaMap.get(key) ?? 0;
      }

      semanasResult[String(s)] = {
        totalAportes: Math.round(sumAportes * 100) / 100,
        totalAhorros: Math.round(sumAhorros * 100) / 100,
        totalMultas: Math.round(sumMultas * 100) / 100,
        responsable: responsableMap.get(s) ?? null,
      };
    }

    // ── 6. Return response ──────────────────────────────────────────────────
    return NextResponse.json({
      ronda: {
        id: ronda.id,
        nombre: ronda.nombre,
        semanaActual: ronda.semanaActual,
        montoAporte: Number(ronda.montoAporte),
        activa: ronda.activa,
        fechaInicio: ronda.fechaInicio,
        fechaFin: ronda.fechaFin,
        intervaloDiasCobro: ronda.intervaloDiasCobro,
        ahorroObjetivoPorSocio: Number(ronda.ahorroObjetivoPorSocio),
        saldoFondoDisponible: Number(ronda.saldoFondoDisponible),
        fondoTotalHistorico: Number(ronda.fondoTotalHistorico),
      },
      socios: sociosResult,
      semanas: semanasResult,
      totalSemanas,
    });
  } catch (error) {
    console.error("Error en tabla-master:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
