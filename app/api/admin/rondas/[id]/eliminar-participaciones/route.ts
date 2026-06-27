import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { registrarBitacora } from "@/lib/bitacora";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const rondaId = Number((await ctx.params).id);
  const body = await req.json();
  const { socioIds, preview } = body as { socioIds: number[]; preview?: boolean };

  if (!Array.isArray(socioIds) || socioIds.length === 0) {
    return NextResponse.json({ error: "Se requiere al menos un socioId" }, { status: 400 });
  }

  try {
    const ronda = await prisma.ronda.findUnique({
      where: { id: rondaId },
      select: { id: true, nombre: true },
    });
    if (!ronda) return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });

    const participaciones = await prisma.participacion.findMany({
      where: { rondaId, socioId: { in: socioIds } },
      include: { socio: { select: { id: true, nombres: true, apellidos: true, numeroCuenta: true } } },
    });
    const participantIds = new Set(participaciones.map(p => p.socioId));
    const missing = socioIds.filter(id => !participantIds.has(id));

    // For socios without participacion but with investment, still allow deletion
    const inversionesSinParticipacion = await prisma.cuentaInversion.findMany({
      where: { rondaId, socioId: { in: missing } },
      include: { socio: { select: { id: true, nombres: true, apellidos: true, numeroCuenta: true } } },
    });
    const invOnlyIds = new Set(inversionesSinParticipacion.map(ci => ci.socioId));
    const reallyMissing = missing.filter(id => !invOnlyIds.has(id));
    if (reallyMissing.length > 0) {
      return NextResponse.json({ error: `Socios no encontrados en esta ronda: ${reallyMissing.join(", ")}` }, { status: 400 });
    }

    // Build all socio info map
    const socioMap = new Map<number, { nombres: string; apellidos: string; numeroCuenta: string }>();
    for (const p of participaciones) socioMap.set(p.socioId, p.socio);
    for (const ci of inversionesSinParticipacion) socioMap.set(ci.socioId, ci.socio);

    // Gather counts for preview
    const [aportes, ahorros, express, prestamos, inversiones, movCuenta, responsables, multas] = await Promise.all([
      prisma.aporte.findMany({ where: { rondaId, socioId: { in: socioIds } }, select: { id: true, socioId: true, prestamoExpressId: true } }),
      prisma.ahorro.findMany({ where: { rondaId, socioId: { in: socioIds } }, select: { id: true, socioId: true, monto: true } }),
      (prisma as any).prestamoExpress.findMany({ where: { rondaId, socioId: { in: socioIds } }, select: { id: true, socioId: true } }),
      prisma.prestamo.findMany({ where: { rondaId, socioId: { in: socioIds } }, select: { id: true, socioId: true }, include: { cuotas: { select: { id: true } } } }),
      prisma.cuentaInversion.findMany({ where: { rondaId, socioId: { in: socioIds } }, select: { id: true, socioId: true, montoInvertido: true, devuelto: true } }),
      prisma.movimientoCuenta.findMany({ where: { rondaId, socioId: { in: socioIds } }, select: { id: true, socioId: true } }),
      prisma.responsableCobroSemana.findMany({ where: { rondaId, socioId: { in: socioIds } }, select: { id: true, socioId: true } }),
      prisma.ingresoMulta.findMany({ where: { rondaId, socioId: { in: socioIds } }, select: { id: true, socioId: true } }),
    ]);

    const detalles = socioIds.map(socioId => {
      const socio = socioMap.get(socioId);
      const inv = inversiones.find(i => i.socioId === socioId);
      const ahorroTotal = ahorros.filter(a => a.socioId === socioId).reduce((s, a) => s + Number(a.monto), 0);
      return {
        socioId,
        socio: socio ? `${socio.nombres} ${socio.apellidos}` : `ID ${socioId}`,
        cuenta: socio?.numeroCuenta ?? "",
        aportes: aportes.filter(a => a.socioId === socioId).length,
        ahorros: ahorros.filter(a => a.socioId === socioId).length,
        ahorroTotal: Math.round(ahorroTotal * 100) / 100,
        express: express.filter((e: any) => e.socioId === socioId).length,
        prestamos: prestamos.filter(p => p.socioId === socioId).length,
        cuotas: prestamos.filter(p => p.socioId === socioId).reduce((s, p) => s + p.cuotas.length, 0),
        inversion: !!inv,
        inversionMonto: inv ? Number(inv.montoInvertido) : 0,
        inversionDevuelta: inv?.devuelto ?? false,
        movimientos: movCuenta.filter(m => m.socioId === socioId).length,
        responsables: responsables.filter(r => r.socioId === socioId).length,
        multas: multas.filter((m: any) => m.socioId === socioId).length,
        registrosEliminados:
          aportes.filter(a => a.socioId === socioId).length +
          ahorros.filter(a => a.socioId === socioId).length +
          express.filter((e: any) => e.socioId === socioId).length +
          prestamos.filter(p => p.socioId === socioId).reduce((s, p) => s + p.cuotas.length + 1, 0) +
          (inv ? 1 : 0) +
          movCuenta.filter(m => m.socioId === socioId).length +
          multas.filter((m: any) => m.socioId === socioId).length +
          (participantIds.has(socioId) ? 1 : 0),
      };
    });

    const efectos: string[] = [];
    const totalAhorrosRevertir = detalles.reduce((s, d) => s + d.ahorroTotal, 0);
    if (totalAhorrosRevertir > 0) efectos.push(`saldoAhorros se reducirá en $${totalAhorrosRevertir.toFixed(2)} para los socios afectados`);
    const invCount = detalles.filter(d => d.inversion).length;
    if (invCount > 0) efectos.push(`% inversión se recalculará para ${invCount} inversor(es) eliminados`);

    if (preview) {
      return NextResponse.json({ detalles, efectos });
    }

    // ── Execute deletion inside transaction ──
    await prisma.$transaction(async (tx) => {
      for (const socioId of socioIds) {
        const socioAportes = aportes.filter(a => a.socioId === socioId);
        const socioAhorros = ahorros.filter(a => a.socioId === socioId);
        const socioExpress = express.filter((e: any) => e.socioId === socioId);
        const socioPrestamos = prestamos.filter(p => p.socioId === socioId);
        const socioInv = inversiones.find(i => i.socioId === socioId);

        // 1. Clean FK prestamoExpressId on aportes
        const expressIds = socioExpress.map((e: any) => e.id);
        if (expressIds.length > 0) {
          await tx.aporte.updateMany({
            where: { prestamoExpressId: { in: expressIds } },
            data: { prestamoExpressId: null },
          });
        }

        // 2. Delete cuotas then prestamos
        const prestamoIds = socioPrestamos.map(p => p.id);
        if (prestamoIds.length > 0) {
          await tx.prestamoCuota.deleteMany({ where: { prestamoId: { in: prestamoIds } } });
          await tx.movimientoFondo.deleteMany({ where: { rondaId, prestamoId: { in: prestamoIds } } });
          await tx.prestamo.deleteMany({ where: { id: { in: prestamoIds } } });
        }

        // 3. Delete express
        if (expressIds.length > 0) {
          await (tx as any).prestamoExpress.deleteMany({ where: { id: { in: expressIds } } });
        }

        // 4. Delete aportes
        if (socioAportes.length > 0) {
          await tx.aporte.deleteMany({ where: { rondaId, socioId } });
        }

        // 5. Delete ahorros and revert saldoAhorros
        if (socioAhorros.length > 0) {
          const totalAhorro = socioAhorros.reduce((s, a) => s + Number(a.monto), 0);
          await tx.ahorro.deleteMany({ where: { rondaId, socioId } });
          if (totalAhorro > 0) {
            await tx.socio.update({
              where: { id: socioId },
              data: { saldoAhorros: { decrement: new Prisma.Decimal(totalAhorro.toFixed(2)) } },
            });
          }
        }

        // 6. Delete multas
        await (tx as any).ingresoMulta.deleteMany({ where: { rondaId, socioId } });

        // 7. Delete movimientos caja for this socio
        await (tx as any).movimientoCaja.deleteMany({ where: { rondaId, socioId } });

        // 8. Delete cuentaInversion
        if (socioInv) {
          await tx.cuentaInversion.deleteMany({ where: { rondaId, socioId } });
        }

        // 9. Delete movimientos cuenta
        await tx.movimientoCuenta.deleteMany({ where: { rondaId, socioId } });

        // 10. Delete responsables semana
        await tx.responsableCobroSemana.deleteMany({ where: { rondaId, socioId } });

        // 11. Delete participacion
        if (participantIds.has(socioId)) {
          await tx.participacion.deleteMany({ where: { rondaId, socioId } });
        }
      }

      // Recalculate investment percentages for remaining investors
      const remainingInv = await tx.cuentaInversion.findMany({ where: { rondaId } });
      const totalFondo = remainingInv.reduce((s, ci) => s + Number(ci.montoInvertido), 0);
      for (const ci of remainingInv) {
        const pct = totalFondo > 0 ? (Number(ci.montoInvertido) / totalFondo) * 100 : 0;
        await tx.cuentaInversion.update({
          where: { id: ci.id },
          data: { porcentajeParticipacion: new Prisma.Decimal(Math.round(pct * 100) / 100) },
        });
      }

      // Update ronda fondo
      await tx.ronda.update({
        where: { id: rondaId },
        data: { saldoFondoDisponible: new Prisma.Decimal(totalFondo.toFixed(2)) },
      });
    }, { timeout: 30000 });

    // Log to bitácora
    for (const d of detalles) {
      await registrarBitacora({
        tabla: "participaciones",
        registroId: d.socioId,
        accion: "ELIMINAR",
        camposCambios: {
          socio: { antes: d.socio, despues: null },
          ronda: { antes: ronda.nombre, despues: null },
        },
        efectosCadena: [{
          tabla: "rondas",
          registroId: rondaId,
          descripcion: `Eliminados: ${d.aportes} aportes, ${d.ahorros} ahorros, ${d.express} express, ${d.prestamos} préstamos, ${d.multas} multas${d.inversion ? `, inversión $${d.inversionMonto}` : ""}. saldoAhorros revertido -$${d.ahorroTotal}`,
        }],
      });
    }

    return NextResponse.json({ ok: true, detalles });
  } catch (error: any) {
    console.error("[eliminar-participaciones]", error);
    return NextResponse.json({ error: error?.message ?? "Error interno" }, { status: 500 });
  }
}
