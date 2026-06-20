// app/api/admin/sincronizar-movimientos/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const soloVer = body?.soloVer === true; // true = diagnóstico, false = aplicar cambios
    const socioIdFiltro = body?.socioId ? Number(body.socioId) : null;

    // Cargar todos los ahorros con monto > 0 de todas las rondas
    const ahorros = await prisma.ahorro.findMany({
      where: {
        monto: { gt: 0 },
        ...(socioIdFiltro ? { socioId: socioIdFiltro } : {}),
      },
      include: { ronda: { select: { id: true, nombre: true, fechaInicio: true, intervaloDiasCobro: true } } },
      orderBy: [{ rondaId: "asc" }, { socioId: "asc" }, { semana: "asc" }],
    });

    const diferencias: {
      socioId: number; rondaNombre: string; semana: number;
      montoAhorro: number; montoMovimiento: number | null; accion: string;
    }[] = [];

    let corregidos = 0;
    let saldosAjustados = 0;

    for (const ahorro of ahorros) {
      const nota1 = `semana ${ahorro.semana} ·`; // "semana 1 · RD00XX"
      const nota2 = `semana ${ahorro.semana}`; // fallback final

      // Buscar movimiento correspondiente
      const mov = await prisma.movimientoCuenta.findFirst({
        where: {
          socioId: ahorro.socioId,
          rondaId: ahorro.rondaId,
          tipo: "AHORRO",
          OR: [
            { nota: { contains: nota1 } },
            { nota: { endsWith: nota2 } },
          ],
        },
        orderBy: { id: "asc" },
      });

      const montoAhorro = Number(ahorro.monto);
      const montoMov = mov ? Number(mov.monto) : null;

      if (!mov) {
        // No existe el movimiento — hay que crearlo
        diferencias.push({
          socioId: ahorro.socioId, rondaNombre: ahorro.ronda?.nombre ?? "?",
          semana: ahorro.semana, montoAhorro, montoMovimiento: null,
          accion: "CREAR",
        });
        if (!soloVer) {
          const fechaSemana = new Date(ahorro.ronda.fechaInicio);
          fechaSemana.setUTCDate(fechaSemana.getUTCDate() + (ahorro.semana - 1) * (ahorro.ronda.intervaloDiasCobro ?? 7));
          await prisma.movimientoCuenta.create({
            data: {
              socioId: ahorro.socioId,
              rondaId: ahorro.rondaId,
              tipo: "AHORRO",
              monto: new Prisma.Decimal(montoAhorro),
              nota: `Ahorro semana ${ahorro.semana} · ${ahorro.ronda?.nombre}`,
              createdAt: fechaSemana,
            },
          });
          // Ajustar saldo
          await prisma.socio.update({
            where: { id: ahorro.socioId },
            data: { saldoAhorros: { increment: new Prisma.Decimal(montoAhorro.toFixed(2)) } },
          });
          corregidos++;
          saldosAjustados++;
        }
      } else if (Math.abs(montoAhorro - montoMov!) > 0.01) {
        // El movimiento existe pero tiene monto diferente
        const delta = montoAhorro - montoMov!;
        diferencias.push({
          socioId: ahorro.socioId, rondaNombre: ahorro.ronda?.nombre ?? "?",
          semana: ahorro.semana, montoAhorro, montoMovimiento: montoMov,
          accion: `ACTUALIZAR (${montoMov!.toFixed(2)} → ${montoAhorro.toFixed(2)})`,
        });
        if (!soloVer) {
          await prisma.movimientoCuenta.update({
            where: { id: mov.id },
            data: { monto: new Prisma.Decimal(montoAhorro) },
          });
          // Ajustar saldo por el delta
          await prisma.socio.update({
            where: { id: ahorro.socioId },
            data: { saldoAhorros: { increment: new Prisma.Decimal(delta.toFixed(2)) } },
          });
          corregidos++;
          saldosAjustados++;
        }
      }
    }

    // También buscar movimientos AHORRO huérfanos (existen en movimientos pero no en ahorros, con monto > 0)
    const movsAhorro = await prisma.movimientoCuenta.findMany({
      where: {
        tipo: "AHORRO",
        monto: { gt: 0 },
        rondaId: { not: null },
        nota: { contains: "semana" },
        ...(socioIdFiltro ? { socioId: socioIdFiltro } : {}),
      },
    });

    const huerfanos: typeof diferencias = [];
    for (const mov of movsAhorro) {
      // Extraer semana de la nota
      const match = mov.nota?.match(/semana (\d+)/);
      if (!match) continue;
      const semana = parseInt(match[1]);
      const existe = await prisma.ahorro.findUnique({
        where: { rondaId_socioId_semana: { rondaId: mov.rondaId!, socioId: mov.socioId, semana } },
      });
      if (!existe || Number(existe.monto) === 0) {
        huerfanos.push({
          socioId: mov.socioId, rondaNombre: mov.nota ?? "?",
          semana, montoAhorro: 0, montoMovimiento: Number(mov.monto),
          accion: "ELIMINAR (movimiento sin ahorro en tabla ahorros)",
        });
        if (!soloVer) {
          await prisma.movimientoCuenta.delete({ where: { id: mov.id } });
          await prisma.socio.update({
            where: { id: mov.socioId },
            data: { saldoAhorros: { increment: new Prisma.Decimal((-Number(mov.monto)).toFixed(2)) } },
          });
          corregidos++;
        }
      }
    }

    return NextResponse.json({
      ok: true,
      soloVer,
      diferencias: [...diferencias, ...huerfanos],
      totalDiferencias: diferencias.length + huerfanos.length,
      corregidos: soloVer ? 0 : corregidos,
      saldosAjustados: soloVer ? 0 : saldosAjustados,
      mensaje: soloVer
        ? `Diagnóstico: ${diferencias.length + huerfanos.length} discrepancias encontradas`
        : `Corrección aplicada: ${corregidos} movimientos, ${saldosAjustados} saldos ajustados`,
    });

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
